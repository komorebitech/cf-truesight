package com.truesight.sdk

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.content.ContentValues
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

actual class EventQueue {

    private lateinit var dbHelper: EventDatabaseHelper
    private lateinit var encryption: Encryption
    private val mutex = Mutex()

    companion object {
        private var appContext: Context? = null

        fun initialize(context: Context) {
            appContext = context.applicationContext
        }
    }

    init {
        val context = appContext
            ?: throw IllegalStateException("EventQueue not initialized. Call EventQueue.initialize(context) first.")
        dbHelper = EventDatabaseHelper(context)
        encryption = Encryption()
    }

    actual suspend fun enqueue(event: EventModel) {
        mutex.withLock {
            val db = dbHelper.writableDatabase
            val jsonString = Serializer.serializeEvent(event)
            val encrypted = encryption.encrypt(jsonString.encodeToByteArray())
            val values = ContentValues().apply {
                put("event_id", event.eventId)
                put("event_data", encrypted)
                put("created_at", System.currentTimeMillis())
            }
            db.insert("events", null, values)
        }
    }

    actual suspend fun dequeue(count: Int): List<EventModel> {
        mutex.withLock {
            val db = dbHelper.readableDatabase
            val events = mutableListOf<EventModel>()
            val cursor = db.query(
                "events",
                arrayOf("event_id", "event_data"),
                null, null, null, null,
                "created_at ASC",
                count.toString()
            )
            cursor.use {
                while (it.moveToNext()) {
                    try {
                        val encryptedData = it.getBlob(it.getColumnIndexOrThrow("event_data"))
                        val decrypted = encryption.decrypt(encryptedData)
                        val jsonString = decrypted.decodeToString()
                        val event = Serializer.deserializeEvent(jsonString)
                        events.add(event)
                    } catch (e: Exception) {
                        // Skip corrupted events
                        val eventId = it.getString(it.getColumnIndexOrThrow("event_id"))
                        dbHelper.writableDatabase.delete("events", "event_id = ?", arrayOf(eventId))
                    }
                }
            }
            return events
        }
    }

    actual suspend fun remove(ids: List<String>) {
        if (ids.isEmpty()) return
        mutex.withLock {
            val db = dbHelper.writableDatabase
            val placeholders = ids.joinToString(",") { "?" }
            db.delete("events", "event_id IN ($placeholders)", ids.toTypedArray())
        }
    }

    actual suspend fun size(): Int {
        mutex.withLock {
            val db = dbHelper.readableDatabase
            val cursor = db.rawQuery("SELECT COUNT(*) FROM events", null)
            cursor.use {
                return if (it.moveToFirst()) it.getInt(0) else 0
            }
        }
    }

    actual suspend fun clear() {
        mutex.withLock {
            val db = dbHelper.writableDatabase
            db.delete("events", null, null)
        }
    }
}

private class EventDatabaseHelper(context: Context) :
    SQLiteOpenHelper(context, "truesight_events.db", null, 1) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE events (
                event_id TEXT PRIMARY KEY,
                event_data BLOB NOT NULL,
                created_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX idx_events_created_at ON events(created_at)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS events")
        onCreate(db)
    }
}
