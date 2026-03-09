# TrueSight Mobile SDK (KMM)

Kotlin Multiplatform Mobile SDK for TrueSight analytics. Shared core code with native Android and iOS builds.

## Android Integration

### Gradle (Kotlin DSL)

Add the GitHub Packages repository and dependency:

```kotlin
// settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven {
            url = uri("https://maven.pkg.github.com/komorebitech/cf-truesight")
            credentials {
                username = providers.gradleProperty("gpr.user").orNull
                    ?: System.getenv("GITHUB_ACTOR")
                password = providers.gradleProperty("gpr.key").orNull
                    ?: System.getenv("GITHUB_TOKEN")
            }
        }
    }
}
```

```kotlin
// build.gradle.kts
dependencies {
    implementation("com.truesight:truesight-sdk:1.0.0")
}
```

### Usage
```kotlin
import com.truesight.sdk.TrueSightAndroid
import com.truesight.sdk.Config
import com.truesight.sdk.TrueSight

// Initialize (in Application.onCreate)
TrueSightAndroid.init(
    context = applicationContext,
    config = Config(
        apiKey = "ts_live_...",
        endpoint = "https://your-ingestion-api.com"
    )
)

// Track events
TrueSight.track("Button Clicked", mapOf("button_id" to "checkout"))

// Identify user
TrueSight.identify("user-123", mapOf(
    "email" to "user@example.com",
    "mobile_number" to "1234567890"
))

// Screen view
TrueSight.screen("Home Screen")

// Set contact info
TrueSight.setMobileNumber("1234567890")
TrueSight.setEmail("user@example.com")

// Manual flush
TrueSight.flush()

// Reset (logout)
TrueSight.reset()
```

## iOS Integration

### CocoaPods
```ruby
pod 'TrueSightSDK', '~> 1.0.0'
```

### Usage (Swift)
```swift
import TrueSightSDK

// Initialize
TrueSight.shared.doInit(config: Config(
    apiKey: "ts_live_...",
    endpoint: "https://your-ingestion-api.com"
))

// Track events
TrueSight.shared.track(eventName: "Button Clicked", properties: ["button_id": "checkout"])

// Identify user
TrueSight.shared.identify(userId: "user-123", traits: ["email": "user@example.com"])
```

## Publishing

Publishing is automated via GitHub Actions. Push a tag to trigger a release:

```bash
git tag mobile-sdk-1.0.0
git push origin mobile-sdk-1.0.0
```

You can also trigger manually from the Actions tab using the "Publish Mobile SDK" workflow.

## Features

- Encrypted local event queue (Android Keystore AES-GCM on Android, CryptoKit on iOS)
- Automatic batching and compression (deflate)
- Offline support with retry
- Lifecycle-aware session tracking
- Anonymous ID management
- Thread-safe via Kotlin coroutines
