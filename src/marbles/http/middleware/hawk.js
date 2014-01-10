//= require hawk

(function () {

	function Hawk (options) {
		if (!options) {
			options = {};
		}

		if (!options.credentials) {
			throw Error("HawkMiddleware: missing credentials: " + JSON.stringify(options));
		}

		this.options = options;
	}

	Marbles.HTTP.Middleware.Hawk = Hawk;

	Hawk.prototype.processRequest = function (http) {
		var options = {};
		for (var k in this.options) {
			options[k] = this.options[k];
		}

		if (http.body && !http.multipart) {
			options.payload = http.body;
		}
		options.contentType = http.getRequestHeader('Content-Type');

		var header = hawk.client.header(http.url, http.method, options).field;

		if (!header) {
			return;
		}

		http.setRequestHeader('Authorization', header);
	};

	Hawk.prototype.processResponse = function (http, xhr, options) {
		var header = http.getResponseHeader('WWW-Authenticate');
		if (!header || header === 'Hawk') {
			return;
		}

		// Verify tsm and get ts skew offset
		var res = { headers: { 'www-authenticate': header } };
		if (!hawk.client.authenticate(res, this.options.credentials)) {
			options.setError("Invalid WWW-Authenticate: " + JSON.stringify(header));
			return;
		}

		options.retry();
	};

})();
