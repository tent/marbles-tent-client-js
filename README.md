# MarblesTentClient.js

JavaScript 0.3 Tent client built on the HTTP component of [Marbles.js](https://github.com/jvatic/marbles-js) for the browser.

## Installation

Add these lines to your application's Gemfile:

    gem 'marbles-js', :git => 'git://github.com/jvatic/marbles-js.git', :branch => 'master'
    gem 'marbles-tent-client-js', :git => 'git://github.com/tent/marbles-tent-client-js.git', :branch => 'master'

And then execute:

    $ bundle

## Usage

This gem is meant to be used in conjunction with Sprockets. Download and compile the coffee-script source files you need otherwise.

```ruby
# Assuming you have an existing Sprockets environment assigned to `environment`
MarblesJS::Sprockets.setup(environment)
MarblesTentClientJS::Sprockets.setup(environment)
```

### If you're using the Marbles.js framework

```javascript
//= require marbles
//= require tent-client
```

### Otherwise

```javascript
//= require marbles/http
//= require marbles/http/middleware
//= require tent-client
```

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request
