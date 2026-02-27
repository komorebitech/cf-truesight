package com.truesight.sdk

expect class EventQueue {
    suspend fun enqueue(event: EventModel)
    suspend fun dequeue(count: Int): List<EventModel>
    suspend fun remove(ids: List<String>)
    suspend fun size(): Int
    suspend fun clear()
}
