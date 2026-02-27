package com.truesight.sdk

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

object Serializer {

    val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        isLenient = false
        prettyPrint = false
    }

    fun serializeEvent(event: EventModel): String {
        return json.encodeToString(event)
    }

    fun deserializeEvent(jsonString: String): EventModel {
        return json.decodeFromString(jsonString)
    }

    fun serializeBatchPayload(payload: BatchPayload): String {
        return json.encodeToString(payload)
    }

    fun deserializeBatchPayload(jsonString: String): BatchPayload {
        return json.decodeFromString(jsonString)
    }

    fun serializeEventList(events: List<EventModel>): String {
        return json.encodeToString(events)
    }

    fun deserializeEventList(jsonString: String): List<EventModel> {
        return json.decodeFromString(jsonString)
    }
}
