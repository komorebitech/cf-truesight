package com.truesight.sdk

data class Config(
    val apiKey: String,
    val endpoint: String,
    val flushInterval: Long = 30_000L,
    val maxBatchSize: Int = 50,
    val maxQueueSize: Int = 1000,
    val maxEventSize: Int = 32768,
    val debug: Boolean = false,
    val sessionTimeoutMs: Long = 30 * 60 * 1000L,
    val sessionTrackingEnabled: Boolean = true
)
