(function () {

	function HTTP (client) {
		this.client = client;
		this.nextIndex = 0;
		this.nextServer();
	}

	TentClient.HTTP = HTTP;

	HTTP.Adapter = Marbles.HTTP;

	HTTP.prototype.nextServer = function () {
		this.server = this.client.servers[this.nextIndex];
		this.nextIndex++;
	};

	HTTP.prototype.runRequest = function (options) {
		if (!options) {
			throw Error("TentClient.HTTP.runRequest: ArgumentError: " + JSON.stringify(arguments));
		}

		var method = options.method || 'GET',
				params = options.params || [{}],
				url = options.url || this.client.getNamedURL(options.endpoint, params),
				body = options.body,
				headers = options.headers || {},
				callback = options.callback,
				middleware = options.middleware || [];

		middleware = [].concat(TentClient.middleware).concat(this.client.middleware).concat(middleware);

		if (!url) {
			throw Error("TentClient.HTTP.runRequest: ArgumentError: missing url/endpoint option: " + JSON.stringify(options));
		}

		var _callback = function (res, xhr) {
			if (!(xhr.status >= 200 && xhr.status < 300) && !(xhr.status >= 400 && xhr.status < 500) && this.client.servers[this.nextIndex]) {
				this.nextServer();
				this.runRequest({
					method: method,
					url: url,
					params: params,
					body: body,
					headers: headers,
					callback: callback
				});
			} else {
				if (!callback) {
					return;
				}

				if (typeof callback === 'function') {
					callback(res, xhr);
				} else {
					if (xhr.status <= 200 && xhr.status < 400) {
						if (typeof callback.success === 'function') {
							callback.success(res, xhr);
						}
					} else {
						if (typeof callback.failure === 'function') {
							if (typeof res === 'string') {
								// handle middleware reported error
								res = { error: res };
							}
							callback.failure(res, xhr);
						}
					}

					if (typeof callback.complete === 'function') {
						callback.complete(res, xhr);
					}
				}
			}
		}.bind(this);

		HTTP.Adapter({
			method: method,
			url: url,
			params: params,
			body: body,
			headers: headers,
			callback: _callback,
			middleware: middleware
		});
	};

})();
