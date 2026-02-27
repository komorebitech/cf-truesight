package com.truesight.sdk

import platform.Foundation.NSLog

actual class Logger {

    actual fun debug(tag: String, message: String) {
        NSLog("[$tag] DEBUG: %@", message)
    }

    actual fun info(tag: String, message: String) {
        NSLog("[$tag] INFO: %@", message)
    }

    actual fun warn(tag: String, message: String) {
        NSLog("[$tag] WARN: %@", message)
    }

    actual fun error(tag: String, message: String, throwable: Throwable?) {
        if (throwable != null) {
            NSLog("[$tag] ERROR: %@ - %@", message, throwable.message ?: "Unknown error")
        } else {
            NSLog("[$tag] ERROR: %@", message)
        }
    }
}
