package com.truesight.sdk

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.util.UUID

actual class AnonymousIdManager {

    companion object {
        private const val PREF_FILE = "truesight_identity"
        private const val KEY_ANONYMOUS_ID = "anonymous_id"
        private var appContext: Context? = null

        fun initialize(context: Context) {
            appContext = context.applicationContext
        }
    }

    private val prefs: SharedPreferences by lazy {
        val context = appContext
            ?: throw IllegalStateException(
                "AnonymousIdManager not initialized. Call AnonymousIdManager.initialize(context) first."
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
            // Fall back to regular SharedPreferences if encryption is unavailable
            context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
        }
    }

    actual fun getOrCreate(): String {
        val existing = prefs.getString(KEY_ANONYMOUS_ID, null)
        if (existing != null) return existing

        val newId = UUID.randomUUID().toString()
        prefs.edit().putString(KEY_ANONYMOUS_ID, newId).apply()
        return newId
    }

    actual fun reset(): String {
        val newId = UUID.randomUUID().toString()
        prefs.edit().putString(KEY_ANONYMOUS_ID, newId).apply()
        return newId
    }
}
