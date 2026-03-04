package com.truesight.sdk

import platform.Foundation.NSLog

actual class Logger {

    actual fun debug(tag: String, message: String) {
        NSLog("[$tag] DEBUG: $message")
    }

    actual fun info(tag: String, message: String) {
        NSLog("[$tag] INFO: $message")
    }

    actual fun warn(tag: String, message: String) {
        NSLog("[$tag] WARN: $message")
    }

    actual fun error(tag: String, message: String, throwable: Throwable?) {
        val errorDetail = if (throwable != null) "$message - ${throwable.message ?: "Unknown error"}" else message
        NSLog("[$tag] ERROR: $errorDetail")
    }
}
