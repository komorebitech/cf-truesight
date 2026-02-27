package com.truesight.sdk

expect class AnonymousIdManager {
    fun getOrCreate(): String
    fun reset(): String
}
