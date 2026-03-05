package com.truesight.sdk

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.util.UUID

actual class SessionManager actual constructor() {

    companion object {
        private const val PREF_FILE = "truesight_session"
        private const val KEY_SESSION_ID = "session_id"
        private const val KEY_LAST_ACTIVITY = "last_activity_time"
        private var appContext: Context? = null
        private var timeoutMs: Long = 30 * 60 * 1000L

        fun initialize(context: Context, sessionTimeoutMs: Long = 30 * 60 * 1000L) {
            require(sessionTimeoutMs > 0) { "sessionTimeoutMs must be > 0" }
            appContext = context.applicationContext
            timeoutMs = sessionTimeoutMs
        }
    }

    private val prefs: SharedPreferences by lazy {
        val context = appContext
            ?: throw IllegalStateException(
                "SessionManager not initialized. Call SessionManager.initialize(context) first."
            )
        try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            EncryptedSharedPreferences.create(
                context,
                PREF_FILE,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
        }
    }

    actual fun getOrStartSession(): String {
        val existing = prefs.getString(KEY_SESSION_ID, null)
        val lastActivity = prefs.getLong(KEY_LAST_ACTIVITY, 0L)
        val now = System.currentTimeMillis()

        if (existing != null && now - lastActivity < timeoutMs) {
            prefs.edit().putLong(KEY_LAST_ACTIVITY, now).apply()
            return existing
        }

        val newId = UUID.randomUUID().toString()
        prefs.edit()
            .putString(KEY_SESSION_ID, newId)
            .putLong(KEY_LAST_ACTIVITY, now)
            .apply()
        return newId
    }

    actual fun onBackground() {
        prefs.edit().putLong(KEY_LAST_ACTIVITY, System.currentTimeMillis()).apply()
    }

    actual fun onForeground(): Pair<String, Boolean> {
        val existing = prefs.getString(KEY_SESSION_ID, null)
        val lastActivity = prefs.getLong(KEY_LAST_ACTIVITY, 0L)
        val now = System.currentTimeMillis()

        if (existing != null && now - lastActivity < timeoutMs) {
            prefs.edit().putLong(KEY_LAST_ACTIVITY, now).apply()
            return Pair(existing, false)
        }

        val newId = UUID.randomUUID().toString()
        prefs.edit()
            .putString(KEY_SESSION_ID, newId)
            .putLong(KEY_LAST_ACTIVITY, now)
            .apply()
        return Pair(newId, true)
    }

    actual fun currentSessionId(): String? {
        return prefs.getString(KEY_SESSION_ID, null)
    }

    actual fun reset() {
        val newId = UUID.randomUUID().toString()
        prefs.edit()
            .putString(KEY_SESSION_ID, newId)
            .putLong(KEY_LAST_ACTIVITY, System.currentTimeMillis())
            .apply()
    }
}
