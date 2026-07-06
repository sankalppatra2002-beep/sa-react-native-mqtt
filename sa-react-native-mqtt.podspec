require "json"

json = File.read(File.join(__dir__, "package.json"))
package = JSON.parse(json).deep_symbolize_keys

Pod::Spec.new do |s|
  s.name = package[:name]
  s.version = package[:version]
  s.license = { type: "MIT" }
  s.homepage = "https://github.com/sankalppatra2002-beep/sa-react-native-mqtt"
  s.authors = package[:author] && package[:author][:name] ? package[:author][:name] : "Sankalp Patra"
  s.summary = package[:description]
  s.source = { git: package[:repository] && package[:repository][:url] ? package[:repository][:url] : "https://github.com/sankalppatra2002-beep/sa-react-native-mqtt.git" }
  s.source_files = "ios/*.{h,m,swift}"
  s.platform = :ios, "8.0"
  s.swift_version = "5.0"
  
  s.dependency "React"
end