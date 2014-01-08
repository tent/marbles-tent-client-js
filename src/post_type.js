(function () {

	var TYPE_URI_REGEX = /^(.+?)\/v([^#]+)(#(.+)?)?$/;

	function PostType (typeURI) {
		this.version = '0';
		this.parseURI(typeURI);

		return this;
	}

	TentClient.PostType = PostType;

	PostType.prototype.parseURI = function (typeURI) {
		var m = typeURI.match(TYPE_URI_REGEX);
		if (m) {
			this.base = m[1];
			this.version = m[2];
			this.hasFragment = !!m[3];
			this.setFragment(m[4]);
		}
	};

	PostType.prototype.setFragment = function (fragment) {
		this.fragment = this.decodeFragment(fragment);
	};

	PostType.prototype.decodeFragment = function (fragment) {
		if (!fragment) {
			return '';
		}

		var _parts = decodeURIComponent(fragment).split('#');
		var _frag = [_parts.shift()];

		for (var i = 0, _len = _parts.length; i < _len; i++) {
			_frag.push(this.decodeFragment(_parts[i]));
		}

		return _frag.join('#');
	};

	PostType.prototype.encodeFragment = function (fragment) {
		if (!fragment) {
			return '';
		}

		var _parts = fragment.split('#');
		var _frag = null;
		for (var i = _parts.length-1; i >= 0; i--) {
			var part = _parts[i];
			if (_frag) {
				part += '#' + _frag;
			}
			_frag = encodeURI(part).replace('#', '%23');
		}
		return _frag;
	};

	PostType.prototype.toString = function () {
		if (this.hasFragment) {
			return this.base + '/v' + this.version + '#' + this.fragment;
		} else {
			return this.toStringWithoutFragment();
		}
	};

	PostType.prototype.toStringWithoutFragment = function () {
		return this.base + '/v' + this.version;
	};

	PostType.prototype.toURIString = function () {
		if (this.hasFragment) {
			return this.base + '/v' + this.version + '#' + this.encodeFragment(this.fragment);
		} else {
			return this.toStringWithoutFragment();
		}
	};

	PostType.prototype.assertMatch = function (other) {
		if (this.base !== other.base) {
			return false;
		}

		if (this.version !== other.version) {
			return false;
		}

		if (this.fragment !== other.fragment) {
			return false;
		}

		return true;
	};

})();
