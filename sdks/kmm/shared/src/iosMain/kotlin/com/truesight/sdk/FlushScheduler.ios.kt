package com.truesight.sdk

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import platform.Foundation.NSNotificationCenter
import platform.Foundation.NSOperationQueue
import platform.UIKit.UIApplicationDidEnterBackgroundNotification
import platform.darwin.NSObject

actual class FlushScheduler {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var timerJob: Job? = null
    private var flushAction: (suspend () -> Unit)? = null
    private var backgroundObserver: NSObject? = null

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

        // Register for background notification to flush events before app goes to background
        backgroundObserver = NSNotificationCenter.defaultCenter.addObserverForName(
            name = UIApplicationDidEnterBackgroundNotification,
            `object` = null,
            queue = NSOperationQueue.mainQueue
        ) { _ ->
            this.flushAction?.let { action ->
                scope.launch { action() }
            }
        } as? NSObject
    }

    actual fun stop() {
        timerJob?.cancel()
        timerJob = null
        flushAction = null

        backgroundObserver?.let {
            NSNotificationCenter.defaultCenter.removeObserver(it)
        }
        backgroundObserver = null
    }

    actual fun triggerFlush() {
        flushAction?.let { action ->
            scope.launch { action() }
        }
    }
}
