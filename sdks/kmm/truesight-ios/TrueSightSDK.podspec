Pod::Spec.new do |spec|
  spec.name                     = 'TrueSightSDK'
  spec.version                  = '1.0.0'
  spec.homepage                 = 'https://github.com/truesight/truesight-kmm'
  spec.source                   = {
                                    :http => "https://github.com/truesight/truesight-kmm/releases/download/v#{spec.version}/TrueSightSDK.xcframework.zip"
                                  }
  spec.authors                  = 'TrueSight'
  spec.license                  = { :type => 'MIT' }
  spec.summary                  = 'TrueSight Analytics SDK for iOS (KMM)'
  spec.description              = <<-DESC
    TrueSight is a cross-platform analytics SDK built with Kotlin Multiplatform Mobile (KMM).
    This pod provides the iOS framework for event tracking, user identification,
    and screen tracking with automatic device context collection.
  DESC

  spec.ios.deployment_target    = '14.0'

  spec.vendored_frameworks      = 'shared/build/XCFrameworks/release/TrueSightSDK.xcframework'

  spec.libraries                = 'c++'

  spec.pod_target_xcconfig      = {
    'KOTLIN_PROJECT_PATH' => ':shared',
    'PRODUCT_MODULE_NAME' => 'TrueSightSDK'
  }

  spec.swift_versions           = ['5.0', '5.5', '5.9']

  spec.preserve_paths           = '**/*'

  # Framework dependencies
  spec.frameworks               = 'Foundation', 'UIKit', 'Security'
end
