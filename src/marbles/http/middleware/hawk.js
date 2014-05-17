//= require hawk

(function () {
	"use strict";

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

	Hawk.prototype.willSendRequest = function (request) {
		var options = {};
		for (var k in this.options) {
			if (this.options.hasOwnProperty(k)) {
				options[k] = this.options[k];
			}
		}

		if (request.requestBody && !request.multipart) {
			options.payload = request.requestBody;
		}
		options.contentType = request.getRequestHeader('Content-Type');

		var header = hawk.client.header(request.uri.toString(), request.method, options).field;

		if (!header) {
			return;
		}

		request.setRequestHeader('Authorization', header);
	};

	Hawk.prototype.didReceiveResponse = function (request) {
		var header = request.getResponseHeader('WWW-Authenticate');
		if (!header || header === 'Hawk') {
			return;
		}

		// Verify tsm and get ts skew offset
		var res = { headers: { 'www-authenticate': header } };
		if (!hawk.client.authenticate(res, this.options.credentials)) {
			request.terminate("Invalid WWW-Authenticate: " + JSON.stringify(header));
			return;
		}

		request.resend();
	};

})();
