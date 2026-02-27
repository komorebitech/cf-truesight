package com.truesight.sdk

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import platform.Foundation.NSCachesDirectory
import platform.Foundation.NSFileManager
import platform.Foundation.NSSearchPathForDirectoriesInDomains
import platform.Foundation.NSString
import platform.Foundation.NSURL
import platform.Foundation.NSUserDomainMask
import platform.Foundation.create
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.writeToURL
import platform.Foundation.stringWithContentsOfURL

actual class EventQueue {

    private val mutex = Mutex()
    private val encryption = Encryption()
    private val fileManager = NSFileManager.defaultManager
    private val queueDirectory: String

    init {
        val cachesDir = NSSearchPathForDirectoriesInDomains(
            NSCachesDirectory,
            NSUserDomainMask,
            true
        ).firstOrNull() as? String ?: ""
        queueDirectory = "$cachesDir/truesight_events"

        if (!fileManager.fileExistsAtPath(queueDirectory)) {
            fileManager.createDirectoryAtPath(
                queueDirectory,
                withIntermediateDirectories = true,
                attributes = null,
                error = null
            )
        }
    }

    actual suspend fun enqueue(event: EventModel) {
        mutex.withLock {
            val jsonString = Serializer.serializeEvent(event)
            val encrypted = encryption.encrypt(jsonString.encodeToByteArray())
            val timestamp = platform.Foundation.NSDate().timeIntervalSince1970
            val fileName = "${timestamp}_${event.eventId}"
            val filePath = "$queueDirectory/$fileName"

            val nsData = platform.Foundation.NSData.create(
                bytes = encrypted.toNSData().bytes,
                length = encrypted.toNSData().length
            )
            nsData.writeToFile(filePath, atomically = true)
        }
    }

    actual suspend fun dequeue(count: Int): List<EventModel> {
        mutex.withLock {
            val events = mutableListOf<EventModel>()
            val files = fileManager.contentsOfDirectoryAtPath(queueDirectory, error = null)
                ?.mapNotNull { it as? String }
                ?.sorted()
                ?.take(count) ?: return emptyList()

            for (fileName in files) {
                try {
                    val filePath = "$queueDirectory/$fileName"
                    val nsData = platform.Foundation.NSData.create(
                        contentsOfFile = filePath
                    ) ?: continue
                    val encrypted = nsData.toByteArray()
                    val decrypted = encryption.decrypt(encrypted)
                    val jsonString = decrypted.decodeToString()
                    val event = Serializer.deserializeEvent(jsonString)
                    events.add(event)
                } catch (e: Exception) {
                    // Remove corrupted event files
                    fileManager.removeItemAtPath("$queueDirectory/$fileName", error = null)
                }
            }
            return events
        }
    }

    actual suspend fun remove(ids: List<String>) {
        if (ids.isEmpty()) return
        mutex.withLock {
            val idSet = ids.toSet()
            val files = fileManager.contentsOfDirectoryAtPath(queueDirectory, error = null)
                ?.mapNotNull { it as? String } ?: return

            for (fileName in files) {
                // File name format: timestamp_eventId
                val eventId = fileName.substringAfter("_")
                if (eventId in idSet) {
                    fileManager.removeItemAtPath("$queueDirectory/$fileName", error = null)
                }
            }
        }
    }

    actual suspend fun size(): Int {
        mutex.withLock {
            val files = fileManager.contentsOfDirectoryAtPath(queueDirectory, error = null)
            return files?.count?.toInt() ?: 0
        }
    }

    actual suspend fun clear() {
        mutex.withLock {
            val files = fileManager.contentsOfDirectoryAtPath(queueDirectory, error = null)
                ?.mapNotNull { it as? String } ?: return

            for (fileName in files) {
                fileManager.removeItemAtPath("$queueDirectory/$fileName", error = null)
            }
        }
    }
}

// Extension functions for NSData <-> ByteArray conversion
@Suppress("CAST_NEVER_SUCCEEDS")
internal fun ByteArray.toNSData(): platform.Foundation.NSData {
    return kotlinx.cinterop.memScoped {
        platform.Foundation.NSData.create(
            bytes = kotlinx.cinterop.allocArrayOf(this@toNSData),
            length = this@toNSData.size.toULong()
        )
    }
}

@Suppress("CAST_NEVER_SUCCEEDS")
internal fun platform.Foundation.NSData.toByteArray(): ByteArray {
    val size = this.length.toInt()
    val bytes = ByteArray(size)
    if (size > 0) {
        kotlinx.cinterop.memScoped {
            val ptr = this@toByteArray.bytes?.reinterpret<kotlinx.cinterop.ByteVar>()
            if (ptr != null) {
                for (i in 0 until size) {
                    bytes[i] = ptr[i]
                }
            }
        }
    }
    return bytes
}
