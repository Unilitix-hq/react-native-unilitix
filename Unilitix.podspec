require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "Unilitix"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/Unilitix-hq/react-native-unilitix.git", :tag => "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.swift_version = "5.9"
  s.private_header_files = "ios/**/*.h"
  # Apple privacy manifest for the SDK (required-reason APIs and collected
  # data types), merged into the host app's privacy report by Xcode.
  s.resource_bundles = { "unilitix_privacy" => ["ios/PrivacyInfo.xcprivacy"] }

  install_modules_dependencies(s)
end
