# TrueSight SDK ProGuard Rules

# Keep SDK public API
-keep class com.truesight.sdk.TrueSight { *; }
-keep class com.truesight.sdk.Config { *; }
-keep class com.truesight.sdk.Config$Builder { *; }

# Keep all public enums
-keep enum com.truesight.sdk.EventType { *; }

# Keep model classes used in the public API
-keep class com.truesight.sdk.EventModel { *; }
-keep class com.truesight.sdk.BatchPayload { *; }
-keep class com.truesight.sdk.DeviceContextModel { *; }
-keep class com.truesight.sdk.NetworkResult { *; }
-keep class com.truesight.sdk.NetworkResult$* { *; }

# Keep Android wrapper
-keep class com.truesight.android.** { *; }

# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

-keep,includedescriptorclasses class com.truesight.sdk.**$$serializer { *; }
-keepclassmembers class com.truesight.sdk.** {
    *** Companion;
}
-keepclasseswithmembers class com.truesight.sdk.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Ktor
-keep class io.ktor.** { *; }
-dontwarn io.ktor.**

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

# Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** {
    volatile <fields>;
}
