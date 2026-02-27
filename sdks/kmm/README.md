# TrueSight Mobile SDK (KMM)

Kotlin Multiplatform Mobile SDK for TrueSight analytics. Shared core code with native Android and iOS builds.

## Android Integration

### Gradle (Kotlin DSL)
```kotlin
dependencies {
    implementation("com.truesight:truesight-android:0.1.0")
}
```

### Usage
```kotlin
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
pod 'TrueSightSDK', '~> 0.1.0'
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

## Features

- Encrypted local event queue (SQLCipher on Android, CryptoKit on iOS)
- Automatic batching and compression (zstd)
- Offline support with retry
- Lifecycle-aware flushing
- Anonymous ID management
- Thread-safe via Kotlin coroutines
