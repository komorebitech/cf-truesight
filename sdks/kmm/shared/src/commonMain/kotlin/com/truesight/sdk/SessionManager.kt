package com.truesight.sdk

expect class SessionManager() {
    fun getOrStartSession(): String
    fun onBackground()
    fun onForeground(): Pair<String, Boolean>
    fun currentSessionId(): String?
    fun reset()
}
