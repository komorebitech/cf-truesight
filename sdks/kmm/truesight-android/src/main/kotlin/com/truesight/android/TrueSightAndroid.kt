package com.truesight.android

import android.app.Application
import android.content.Context
import com.truesight.sdk.AnonymousIdManager
import com.truesight.sdk.Config
import com.truesight.sdk.DeviceContextCollector
import com.truesight.sdk.EventQueue
import com.truesight.sdk.TrueSight

/**
 * Android-specific wrapper for TrueSight SDK initialization.
 *
 * This class handles Android Context initialization that the platform-specific
 * actual implementations require before the shared SDK can be used.
 *
 * Usage:
 * ```kotlin
 * // In your Application.onCreate() or Activity
 * TrueSightAndroid.init(
 *     context = applicationContext,
 *     config = Config(
 *         apiKey = "your-api-key",
 *         endpoint = "https://api.truesight.dev"
 *     )
 * )
 *
 * // Then use shared SDK API
 * TrueSight.track("button_click", mapOf("button" to "submit"))
 * TrueSight.identify("user-123", mapOf("email" to "user@example.com"))
 * ```
 */
object TrueSightAndroid {

    private var initialized = false

    /**
     * Initialize the TrueSight SDK for Android.
     *
     * This must be called before any other TrueSight SDK methods.
     * Typically called in [Application.onCreate].
     *
     * @param context Application context. Will be converted to application context internally.
     * @param config SDK configuration including API key and endpoint.
     */
    fun init(context: Context, config: Config) {
        if (initialized) return

        val appContext = context.applicationContext

        // Initialize platform-specific components that require Android Context
        EventQueue.initialize(appContext)
        AnonymousIdManager.initialize(appContext)
        DeviceContextCollector.initialize(appContext)

        // Initialize the shared SDK
        TrueSight.init(config)

        initialized = true
    }

    /**
     * Check if the Android SDK wrapper has been initialized.
     */
    fun isInitialized(): Boolean = initialized
}
