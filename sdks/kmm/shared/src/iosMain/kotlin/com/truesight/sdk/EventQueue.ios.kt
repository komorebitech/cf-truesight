package com.truesight.sdk

import kotlinx.cinterop.addressOf
import kotlinx.cinterop.allocArrayOf
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.usePinned
import platform.posix.memcpy
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import platform.Foundation.NSCachesDirectory
import platform.Foundation.NSData
import platform.Foundation.NSDate
import platform.Foundation.NSFileManager
import platform.Foundation.NSSearchPathForDirectoriesInDomains
import platform.Foundation.NSUserDomainMask
import platform.Foundation.create
import platform.Foundation.dataWithContentsOfFile
import platform.Foundation.timeIntervalSince1970
import platform.Foundation.writeToFile

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
            val timestamp = NSDate().timeIntervalSince1970
            val fileName = "${timestamp}_${event.eventId}"
            val filePath = "$queueDirectory/$fileName"

            val nsData = encrypted.toNSData()
            nsData.writeToFile(filePath, true)
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
                    val nsData = NSData.dataWithContentsOfFile(filePath) ?: continue
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
            return (files as? List<*>)?.size ?: 0
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
internal fun ByteArray.toNSData(): NSData {
    return memScoped {
        NSData.create(
            bytes = allocArrayOf(this@toNSData),
            length = this@toNSData.size.toULong()
        )
    }
}

internal fun NSData.toByteArray(): ByteArray {
    val size = this.length.toInt()
    if (size == 0) return ByteArray(0)
    val bytes = ByteArray(size)
    bytes.usePinned { pinned ->
        memcpy(pinned.addressOf(0), this.bytes, this.length)
    }
    return bytes
}
