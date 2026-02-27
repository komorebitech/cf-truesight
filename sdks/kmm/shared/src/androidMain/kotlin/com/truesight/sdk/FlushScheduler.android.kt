package com.truesight.sdk

import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

actual class FlushScheduler {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var timerJob: Job? = null
    private var flushAction: (suspend () -> Unit)? = null

    private val lifecycleObserver = object : DefaultLifecycleObserver {
        override fun onStop(owner: LifecycleOwner) {
            // App going to background - trigger a flush
            flushAction?.let { action ->
                scope.launch { action() }
            }
        }
    }

    actual fun start(intervalMs: Long, flushAction: suspend () -> Unit) {
        this.flushAction = flushAction

        timerJob?.cancel()
        timerJob = scope.launch {
            while (isActive) {
                delay(intervalMs)
                try {
                    flushAction()
                } catch (e: Exception) {
                    // Swallow flush errors to keep the scheduler running
                }
            }
        }

        // Register lifecycle observer on main thread
        try {
            val mainScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
            mainScope.launch {
                ProcessLifecycleOwner.get().lifecycle.addObserver(lifecycleObserver)
            }
        } catch (e: Exception) {
            // ProcessLifecycleOwner may not be available in all contexts
        }
    }

    actual fun stop() {
        timerJob?.cancel()
        timerJob = null
        flushAction = null

        try {
            val mainScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
            mainScope.launch {
                ProcessLifecycleOwner.get().lifecycle.removeObserver(lifecycleObserver)
            }
        } catch (e: Exception) {
            // Ignore cleanup errors
        }
    }

    actual fun triggerFlush() {
        flushAction?.let { action ->
            scope.launch { action() }
        }
    }
}
