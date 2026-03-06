package com.truesight.sdk

import platform.Foundation.NSUserDefaults
import platform.Foundation.NSUUID

actual class SessionManager actual constructor() {

    companion object {
        private const val KEY_SESSION_ID = "truesight_session_id"
        private const val KEY_LAST_ACTIVITY = "truesight_last_activity"
        private var timeoutMs: Long = 30 * 60 * 1000L

        fun configure(sessionTimeoutMs: Long = 30 * 60 * 1000L) {
            timeoutMs = sessionTimeoutMs
        }
    }

    private val defaults = NSUserDefaults.standardUserDefaults

    private fun currentTimeMillis(): Long {
        return (platform.Foundation.NSDate().timeIntervalSince1970 * 1000).toLong()
    }

    actual fun getOrStartSession(): String {
        val existing = defaults.stringForKey(KEY_SESSION_ID)
        val lastActivity = defaults.doubleForKey(KEY_LAST_ACTIVITY).toLong()
        val now = currentTimeMillis()

        if (existing != null && now - lastActivity < timeoutMs) {
            defaults.setDouble(now.toDouble(), KEY_LAST_ACTIVITY)
            return existing
        }

        val newId = NSUUID().UUIDString
        defaults.setObject(newId, KEY_SESSION_ID)
        defaults.setDouble(now.toDouble(), KEY_LAST_ACTIVITY)
        return newId
    }

    actual fun onBackground() {
        defaults.setDouble(currentTimeMillis().toDouble(), KEY_LAST_ACTIVITY)
    }

    actual fun onForeground(): Pair<String, Boolean> {
        val existing = defaults.stringForKey(KEY_SESSION_ID)
        val lastActivity = defaults.doubleForKey(KEY_LAST_ACTIVITY).toLong()
        val now = currentTimeMillis()

        if (existing != null && now - lastActivity < timeoutMs) {
            defaults.setDouble(now.toDouble(), KEY_LAST_ACTIVITY)
            return Pair(existing, false)
        }

        val newId = NSUUID().UUIDString
        defaults.setObject(newId, KEY_SESSION_ID)
        defaults.setDouble(now.toDouble(), KEY_LAST_ACTIVITY)
        return Pair(newId, true)
    }

    actual fun currentSessionId(): String? {
        return defaults.stringForKey(KEY_SESSION_ID)
    }

    actual fun reset() {
        val newId = NSUUID().UUIDString
        defaults.setObject(newId, KEY_SESSION_ID)
        defaults.setDouble(currentTimeMillis().toDouble(), KEY_LAST_ACTIVITY)
    }
}
