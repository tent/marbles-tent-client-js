#= require ./marbles/http/middleware/hawk
#= require_self

TYPE_URI_REGEX = /^(.+?)\/v([^#]+)(#(.+)?)?$/
URI_TEMPLATE_REGEX = /\{([^\}]+)\}/g

class @TentClient
  @VERSION: '0.0.1'

  @middleware = [
    Marbles.HTTP.Middleware.SerializeJSON,
  ]

  @preferredServer: (server_meta_post) =>
    servers = _.sortBy(server_meta_post.content.servers, 'preference')
    servers[0]

  @namedUrl: (server, name, params = {}) ->
    server?.urls[name]?.replace URI_TEMPLATE_REGEX, (wholeMatch, firstGroup) =>
      param = params[firstGroup] || ''
      delete params[firstGroup]

      encodeURIComponent(param)

  class @PostType
    constructor: (type_uri) ->
      @version = 0
      @parseUri(type_uri) if type_uri

    parseUri: (uri) =>
      if m = uri.match(TYPE_URI_REGEX)
        [m, @base, @version, fragment_sep, @fragment] = m
        @fragment = @decodeFragment(@fragment) if @fragment
        @has_fragment = !!fragment_sep

    setFragment: (fragment) =>
      @fragment = @decodeFragment(fragment)

    assertMatch: (other_type) =>
      return false unless @base is other_type.base
      return false unless @version is other_type.version
      return false if @fragment != null && @fragment != undefined && @fragment != other_type.fragment
      true

    decodeFragment: (fragment) =>
      return fragment unless fragment
      [frag, rest...] = decodeURIComponent(fragment).split('#')
      [frag].concat(_.map(rest, (_frag) => @decodeFragment(_frag))).join('#')

    encodeFragment: (fragment) =>
      return fragment unless fragment
      parts = fragment.split('#')
      memo = null
      for i in [parts.length-1..0]
        part = parts[i]
        part += '#' + memo if memo
        memo = encodeURI(part).replace('#', '%23')
      memo

    toString: =>
      if @has_fragment
        "#{@base}/v#{@version}##{@encodeFragment(@fragment || '')}"
      else
        @toStringWithoutFragment()

    toStringWithoutFragment: =>
      "#{@base}/v#{@version}"

    toURIString: =>
      if @has_fragment
        "#{@base}/v#{@version}##{@encodeFragment(@fragment || '')}"
      else
        "#{@base}/v#{@version}"

  class @HTTP
    @MEDIA_TYPES = {
      post: "application/vnd.tent.post.v0+json"
      posts_feed: "application/vnd.tent.posts-feed.v0+json"
      mentions: "application/vnd.tent.post-mentions.v0+json"
      versions: "application/vnd.tent.post-versions.v0+json"
    }

    constructor: (@client) ->
      @servers = _.sortBy(@client.server_meta_post.content.servers, 'preference')
      @nextServer()

    nextServer: =>
      @current_server = @servers.shift()

    namedUrl: (name, params = {}) =>
      TentClient.namedUrl(@current_server, name, params)

    runRequest: (method, _url, params, body, headers, middleware, _callback) =>
      middleware ?= []
      params = _.clone(params)

      unless _url.match(/^[a-z]+:\/\//i)
        if accept_header = @constructor.MEDIA_TYPES[_url]
          headers ?= {}
          headers.Accept ?= accept_header

        url = @namedUrl(_url, params)
      else
        url = _url

      callback = (data, xhr) =>
        if @servers.length && !(xhr.status in [200...300]) && !(xhr.status in [400...500])
          @nextServer()
          @runRequest(method, _url, params, body, headers, _callback)
        else
          _callback?(arguments...)

      new Marbles.HTTP(
        method: method
        url: url
        params: params
        body: body
        headers: headers
        callback: callback
        middleware: [].concat(TentClient.middleware).concat(@client.middleware).concat(middleware)
      )

  middleware: []

  constructor: (@entity, @options = {}) ->
    @credentials = @options.credentials
    @server_meta_post = @options.server_meta_post

    @middleware = _.clone(TentClient::middleware)

    if @credentials
      @middleware.push(new Marbles.HTTP.Middleware.Hawk(credentials: @credentials))

    @post = {
      create: @createPost
      update: @updatePost
      delete: @deletePost
      get: @getPost
      mentions: @getPostMentions
      versions: @getPostVersions
      list: @listPosts
    }

    @discover = @performDiscovery

  runRequest: =>
    new @constructor.HTTP(@).runRequest(arguments...)

  mediaType: (name) =>
    @constructor.HTTP.MEDIA_TYPES[name]

  getNamedUrl: (url, params = {}) =>
    @constructor.namedUrl(@constructor.preferredServer(@server_meta_post), url, params)

  getSignedUrl: (url, params = {}) =>
    unless url.match(/^[a-z]+:\/\//i)
      url = @getNamedUrl(url, params)

    return url unless _credentials = @credentials

    bewit_params = {
      credentials: {
        id: _credentials.id,
        key: _credentials.hawk_key,
        algorithm: _credentials.hawk_algorithm
      }
    }

    if params.exp
      bewit_params.exp = params.exp
    else
      bewit_params.ttlSec = params.ttl || 86400 # 24 hours

    bewit = hawk.client.getBewit(url, bewit_params)

    uri = new Marbles.HTTP.URI(url)
    uri.mergeParams(bewit: bewit)
    uri.toString()

  createPost: (args = {}) =>
    [params, headers, body, attachments, callback] = [_.clone(args.params || {}), args.headers || {}, args.body, args.attachments || [], args.callback]

    unless body.type
      throw new Error("type member of body is required! Got \"#{body.type}\"")

    media_type = "#{@mediaType('post')}; type=\"#{body.type}\""

    if attachments.length
      # multipart
      body = attachments.unshift(['post.json', new Blob([JSON.stringify(body)], { type: media_type }), 'post.json'])
    else
      headers['Content-Type'] = media_type

    headers.Accept = media_type
    @runRequest('POST', 'new_post', params, body, headers, null, callback)

  updatePost: (args = {}) =>
    [params, headers, body, attachments, callback] = [_.clone(args.params || {}), args.headers || {}, args.body, args.attachments || [], args.callback]

    unless body.type
      throw new Error("type member of body is required! Got \"#{body.type}\"")

    unless params.hasOwnProperty('entity')
      params.entity = @entity

    unless params.hasOwnProperty('post')
      params.post = body.id

    unless params.entity && params.post
      throw new Error("entity and post members of params are required! Got \"#{params.entity}\" and \"#{params.post}\"")

    media_type = "#{@mediaType('post')}; type=\"#{body.type}\""

    if attachments.length
      # multipart
      attachments.unshift(['post', new Blob([JSON.stringify(body)], { type: media_type }), 'post.json'])
      body = attachments
    else
      headers['Content-Type'] = media_type

    headers.Accept = media_type
    @runRequest('PUT', 'post', params, body, headers, null, callback)

  deletePost: (args = {}) =>
    [params, headers, callback] = [_.clone(args.params || {}), args.headers || {}, args.callback]

    unless params.hasOwnProperty('entity')
      params.entity = @entity
    unless params.entity && params.post
      throw new Error("entity and post members of params are required! Got \"#{params.entity}\" and \"#{params.post}\"")

    @runRequest('DELETE', 'post', params, null, headers, null, callback)

  getPost: (args = {}) =>
    [params, headers, callback] = [_.clone(args.params || {}), args.headers || {}, args.callback]

    unless params.hasOwnProperty('entity')
      params.entity = @entity
    unless params.entity && params.post
      throw new Error("entity and post members of params are required! Got \"#{params.entity}\" and \"#{params.post}\"")

    if params.type
      headers.Accept = "#{@mediaType('post')}; type=\"#{params.type}\""
      delete params.type

    @runRequest('GET', 'post', params, null, headers, null, callback)

  getPostMentions: (args = {}) =>
    args.headers ?= {}
    args.headers.Accept ?= @mediaType('mentions')
    @getPost(args)

  getPostVersions: (args = {}) =>
    args.headers ?= {}
    args.headers.Accept ?= @mediaType('versions')
    @getPost(args)

  listPosts: (args = {}) =>
    [params, headers, callback] = [args.params, args.headers, args.callback]
    @runRequest(args.method || 'GET', 'posts_feed', params, null, headers, null, callback)

  performDiscovery: (args = {}) =>
    [params, headers, callback] = [_.clone(args.params || {}), args.headers || {}, args.callback]

    unless params.hasOwnProperty('entity')
      throw new Error("entity member of params is required! Got \"#{params.entity}\"")

    if params.type
      headers.Accept = "#{@mediaType('post')}; type=\"#{params.type}\""
      delete params.type

    @runRequest('GET', 'discover', params, null, headers, null, callback)

  serverInfo: (args = {}) =>
    [params, headers, callback] = [_.clone(args.params || {}), args.headers || {}, args.callback]
    @runRequest('GET', 'server_info', params, null, headers, null, callback)

