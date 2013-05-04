# -*- encoding: utf-8 -*-
lib = File.expand_path('../lib', __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'marbles-tent-client-js/version'

Gem::Specification.new do |gem|
  gem.name          = "marbles-tent-client-js"
  gem.version       = MarblesTentClientJS::VERSION
  gem.authors       = ["Jesse Stuart"]
  gem.email         = ["jesse@jessestuart.ca"]
  gem.description   = %q{JavaScript 0.3 Tent client built on the HTTP component of Marbles.js for the browser.}
  gem.summary       = %q{JavaScript 0.3 Tent client built on the HTTP component of Marbles.js for the browser.}
  gem.homepage      = ""

  gem.files         = `git ls-files`.split($/)
  gem.executables   = gem.files.grep(%r{^bin/}).map{ |f| File.basename(f) }
  gem.test_files    = gem.files.grep(%r{^(test|spec|features)/})
  gem.require_paths = ["lib"]
end
