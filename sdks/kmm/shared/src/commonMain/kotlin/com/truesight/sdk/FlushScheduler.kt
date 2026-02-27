package com.truesight.sdk

expect class FlushScheduler {
    fun start(intervalMs: Long, flushAction: suspend () -> Unit)
    fun stop()
    fun triggerFlush()
}
