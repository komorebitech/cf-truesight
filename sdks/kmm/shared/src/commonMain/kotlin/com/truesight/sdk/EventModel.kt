package com.truesight.sdk

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class EventModel(
    @SerialName("event_id") val eventId: String,
    @SerialName("event_name") val eventName: String,
    @SerialName("event_type") val eventType: EventType,
    @SerialName("user_id") val userId: String? = null,
    @SerialName("anonymous_id") val anonymousId: String,
    @SerialName("mobile_number") val mobileNumber: String? = null,
    @SerialName("email") val email: String? = null,
    @SerialName("client_timestamp") val clientTimestamp: String,
    val properties: Map<String, JsonElement> = emptyMap(),
    val context: DeviceContextModel
)

@Serializable
enum class EventType {
    @SerialName("track") TRACK,
    @SerialName("identify") IDENTIFY,
    @SerialName("screen") SCREEN
}
