package com.truesight.sdk

actual fun generateUUID(): String = java.util.UUID.randomUUID().toString()
