//= require_self
//= require ./post_type
//= require ./http
//= require ./marbles/http/middleware/hawk

(function (expose) {
	"use strict";

	var URI_TEMPLATE_REGEX = /\{([^\}]+)\}/g;

	var TentClient = expose.TentClient = function TentClient (entityURI, options) {
		if (!options) {
			options = {};
		}

		this.serverMetaPost = options.serverMetaPost;
		if (!this.serverMetaPost) {
			throw new Error("TentClient: ArgumentError: Missing options.serverMetaPost");
		}

		this.entity = entityURI;

		this.servers = TentClient.sortServers(this.serverMetaPost.content.servers);

		this.middleware = options.middleware || [];

		this.credentials = options.credentials;

		if (this.credentials) {
			this.middleware.push(new Marbles.HTTP.Middleware.Hawk({
				credentials: {
					id: this.credentials.id,
					key: this.credentials.hawk_key,
					algorithm: this.credentials.hawk_algorithm
				}
			}));
		}

		return this;
	};

	TentClient.VERSION = "0.2.0";

	TentClient.middleware = [
		Marbles.HTTP.Middleware.SerializeJSON
	];

	TentClient.MEDIA_TYPES = {
		post: "application/vnd.tent.post.v0+json",
		posts_feed: "application/vnd.tent.posts-feed.v0+json",
		mentions: "application/vnd.tent.post-mentions.v0+json",
		versions: "application/vnd.tent.post-versions.v0+json"
	};

	TentClient.sortServers = function (servers) {
		return servers.sort(function (a, b) {
			a = a.preference;
			b = b.preference;

			if (a < b) {
				return -1;
			}

			if (a > b) {
				return 1;
			}

			return 0;
		});
	};

	TentClient.lookupParamObject = function (key, params) {
		for (var i = 0, _len = params.length; i < _len; i++) {
			if (params[i].hasOwnProperty(key)) {
				return params[i];
			}
		}
		return null;
	};

	TentClient.lookupParam = function (key, params) {
		var paramObj = TentClient.lookupParamObject(key, params);
		if (!paramObj) {
			return null;
		}
		return paramObj[key];
	};

	TentClient.namedURL = function (server, name, params) {
		if (!params) {
			params = [{}];
		}

		if (!server || !server.urls) {
			throw new Error("TentClient: Invalid server: " + JSON.stringify(server));
		}

		var _template = server.urls[name];
		if (!_template) {
			throw new Error("TentClient: Endpoint "+ JSON.stringify(name) + " not found in " + JSON.stringify(server.urls));
		}

		var url = _template.replace(URI_TEMPLATE_REGEX, function (m, key) {
			var paramObj = TentClient.lookupParamObject(key, params) || {};
			var param = paramObj[key];
			delete paramObj[key];

			return encodeURIComponent(param);
		});

		if (URI_TEMPLATE_REGEX.test(url)) {
			var missing = url.match(URI_TEMPLATE_REGEX);
			throw new Error("TentClient: Missing params " + missing.join(',') + ": " + JSON.stringify(params));
		}

		return url;
	};

	TentClient.signURL = function (url, options) {
		if (!options.credentials) {
			throw new Error("TentClient: Can't sign URL without credentials!");
		}

		var credentials = options.credentials;
		var bewitParams = {
			credentials: {
				id: credentials.id,
				key: credentials.hawk_key,
				algorithm: credentials.hawk_algorithm
			}
		};

		if (options.exp) {
			bewitParams.exp = options.exp;
		} else {
			bewitParams.ttlSec = options.ttl || 86400; // 24 hours in seconds
		}

		var bewit = hawk.client.getBewit(url, bewitParams);

		var hash;
		if (url.indexOf('#') !== -1) {
			var _ref = url.split('#');
			url = _ref[0];
			hash = _ref[1];
		}
		if (url.indexOf('?') === -1) {
			url += "?";
		} else {
			url += "&";
		}
		url += "bewit=" + encodeURIComponent(bewit);
		if (hash) {
			url += hash;
		}

		return url;
	};

	TentClient.prototype.getPreferredServer = function () {
		return this.servers[0];
	};

	TentClient.prototype.getNamedURL = function (url, params, options) {
		var server;
		if (options && options.server) {
			server = options.server;
		} else {
			server = this.getPreferredServer();
		}

		return TentClient.namedURL(server, url, params);
	};

	TentClient.prototype.getSignedURL = function (url, params, options) {
		if (!options) {
			options = {};
		}
		options.credentials = options.credentials || this.credentials;

		url = this.getNamedURL.apply(this, arguments);
		return TentClient.signURL(url, options);
	};

	TentClient.prototype.runRequest = function (options) {
		var http = new TentClient.HTTP(this);
		http.runRequest(options);
	};

	TentClient.prototype.createPost = function (data, options) {
		if (!data.type) {
			throw new Error("TentClient: createPost: missing type: " + JSON.stringify(data));
		}

		if (!options) {
			options = {};
		}

		var headers = options.headers || [],
				params = options.params || [{}],
				callback = options.callback,
				middleware = options.middleware || [];

		var mediaType = TentClient.MEDIA_TYPES.post + '; type="' + data.type + '"';

		if (options.attachments && options.attachments.length) {
			// multipart
			data = [['post', new Blob([JSON.stringify(data)], { type: mediaType }), 'post.json']];
			data = data.concat(options.attachments);
		} else {
			headers['Content-Type'] = mediaType;
		}

		headers.Accept = mediaType;

		return this.runRequest({
			method: 'POST',
			endpoint: 'new_post',
			params: params,
			body: data,
			headers: headers,
			middleware: middleware,
			callback: callback
		});
	};

	TentClient.prototype.updatePost = function (data, options) {
		if (!data.type) {
			throw new Error("TentClient: updatePost: missing type: " + JSON.stringify(data));
		}

		if (!options) {
			options = {};
		}

		var headers = options.headers || [],
				params = options.params || [{}],
				callback = options.callback,
				middleware = options.middleware || [];

		var mediaType = TentClient.MEDIA_TYPES.post + '; type="' + data.type + '"';

		if (!TentClient.lookupParamObject('entity', params)) {
			params[0].entity = this.entity;
		}

		if (!TentClient.lookupParamObject('post', params)) {
			params[0].post = data.id;
		}

		if (!TentClient.lookupParam('entity', params) || !TentClient.lookupParam('post', params)) {
			throw new Error("TentClient: updatePost: missing entity and/or post params: " + JSON.stringify(params));
		}

		if (options.attachments && options.attachments.length) {
			// multipart
			data = [['post', new Blob([JSON.stringify(data)], { type: mediaType }), 'post.json']];
			data = data.concat(options.attachments);
		} else {
			headers['Content-Type'] = mediaType;
		}

		headers.Accept = mediaType;

		return this.runRequest({
			method: 'PUT',
			endpoint: 'post',
			params: params,
			body: data,
			headers: headers,
			middleware: middleware,
			callback: callback
		});
	};

	TentClient.prototype.deletePost = function (options) {
		if (!options) {
			options = {};
		}

		var headers = options.headers || [],
				params = options.params || [{}],
				callback = options.callback,
				middleware = options.middleware || [];

		if (!TentClient.lookupParamObject('entity', params)) {
			params[0].entity = this.entity;
		}

		if (!TentClient.lookupParam('entity', params) || !TentClient.lookupParam('post', params)) {
			throw new Error("TentClient: deletePost: missing entity and/or post params: " + JSON.stringify(params));
		}

		return this.runRequest({
			method: 'DELETE',
			endpoint: 'post',
			params: params,
			headers: headers,
			middleware: middleware,
			callback: callback
		});
	};

	TentClient.prototype.getPost = function (options) {
		if (!options) {
			options = {};
		}

		var headers = options.headers || [],
				params = options.params || [{}],
				callback = options.callback,
				middleware = options.middleware || [];

		if (!TentClient.lookupParamObject('entity', params)) {
			params[0].entity = this.entity;
		}

		if (!TentClient.lookupParam('entity', params) || !TentClient.lookupParam('post', params)) {
			throw new Error("TentClient: getPost: missing entity and/or post params: " + JSON.stringify(params));
		}

		return this.runRequest({
			method: 'GET',
			endpoint: 'post',
			params: params,
			headers: headers,
			middleware: middleware,
			callback: callback
		});
	};

	TentClient.prototype.getPostMentions = function (options) {
		if (!options) {
			options = {};
		}

		options.headers = options.headers || {};
		options.headers.Accept = TentClient.MEDIA_TYPES.mentions;

		return this.getPost(options);
	};

	TentClient.prototype.getPostVersions = function (options) {
		if (!options) {
			options = {};
		}

		options.headers = options.headers || {};
		options.headers.Accept = TentClient.MEDIA_TYPES.versions;

		return this.getPost(options);
	};

	TentClient.prototype.getPostsFeed = function (options) {
		if (!options) {
			options = {};
		}

		var headers = options.headers || [],
				params = options.params || [{}],
				callback = options.callback,
				middleware = options.middleware || [];

		headers.Accept = TentClient.MEDIA_TYPES.posts_feed;

		return this.runRequest({
			method: 'GET',
			endpoint: 'posts_feed',
			params: params,
			headers: headers,
			middleware: middleware,
			callback: callback
		});
	};

	TentClient.prototype.discoverEntity = function (options) {
		if (!options) {
			options = {};
		}

		var headers = options.headers || [],
				params = options.params || [{}],
				callback = options.callback,
				middleware = options.middleware || [];

		if (!TentClient.lookupParam('entity', params)) {
			throw new Error("TentClient: performDiscovery: missing entity param: " + JSON.stringify(params));
		}

		headers.Accept = TentClient.MEDIA_TYPES + '; type="https://tent.io/types/post/meta/v0"';

		return this.runRequest({
			method: 'GET',
			endpoint: 'discover',
			params: params,
			headers: headers,
			middleware: middleware,
			callback: callback
		});
	};

	TentClient.prototype.serverInfo = function (options) {
		if (!options) {
			options = {};
		}

		var headers = options.headers || [],
				params = options.params || [{}],
				callback = options.callback,
				middleware = options.middleware || [];

		return this.runRequest({
			method: 'GET',
			endpoint: 'server_info',
			params: params,
			headers: headers,
			middleware: middleware,
			callback: callback
		});
	};

})(this);
