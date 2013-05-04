require 'marbles-tent-client-js/version'

module MarblesTentClientJS
  module Sprockets
    ASSET_PATHS = [
      File.expand_path(File.join(File.expand_path(File.dirname(__FILE__)), '../src')),
      File.expand_path(File.join(File.expand_path(File.dirname(__FILE__)), '../vendor'))
    ].freeze

    # Append asset paths to an existing Sprockets environment
    def self.setup(environment)
      ASSET_PATHS.each do |path|
        environment.append_path(path)
      end
    end
  end
end
