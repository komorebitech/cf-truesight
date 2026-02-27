package com.truesight.sdk

import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class SerializerTest {

    private val testContext = DeviceContextModel(
        appVersion = "2.1.0",
        osName = "Android",
        osVersion = "14",
        deviceModel = "Samsung Galaxy S24",
        deviceId = "device-abc-123",
        networkType = "wifi",
        locale = "en-US",
        timezone = "America/New_York",
        sdkVersion = "1.0.0"
    )

    private val testEvent = EventModel(
        eventId = "evt-001",
        eventName = "button_click",
        eventType = EventType.TRACK,
        userId = "user-789",
        anonymousId = "anon-xyz",
        mobileNumber = "5551234567",
        email = "user@example.com",
        clientTimestamp = "2025-06-15T14:30:00Z",
        properties = mapOf(
            "button_name" to JsonPrimitive("submit"),
            "screen" to JsonPrimitive("checkout"),
            "value" to JsonPrimitive(42.5)
        ),
        context = testContext
    )

    @Test
    fun testEventSerializationRoundTrip() {
        val json = Serializer.serializeEvent(testEvent)
        assertNotNull(json)
        assertTrue(json.isNotEmpty())

        val deserialized = Serializer.deserializeEvent(json)
        assertEquals(testEvent.eventId, deserialized.eventId)
        assertEquals(testEvent.eventName, deserialized.eventName)
        assertEquals(testEvent.eventType, deserialized.eventType)
        assertEquals(testEvent.userId, deserialized.userId)
        assertEquals(testEvent.anonymousId, deserialized.anonymousId)
        assertEquals(testEvent.mobileNumber, deserialized.mobileNumber)
        assertEquals(testEvent.email, deserialized.email)
        assertEquals(testEvent.clientTimestamp, deserialized.clientTimestamp)
        assertEquals(testEvent.properties.size, deserialized.properties.size)
        assertEquals(testEvent.context.osName, deserialized.context.osName)
        assertEquals(testEvent.context.deviceId, deserialized.context.deviceId)
    }

    @Test
    fun testEventJsonContainsExpectedFields() {
        val json = Serializer.serializeEvent(testEvent)

        assertTrue(json.contains("\"event_id\""))
        assertTrue(json.contains("\"event_name\""))
        assertTrue(json.contains("\"event_type\""))
        assertTrue(json.contains("\"user_id\""))
        assertTrue(json.contains("\"anonymous_id\""))
        assertTrue(json.contains("\"mobile_number\""))
        assertTrue(json.contains("\"client_timestamp\""))
        assertTrue(json.contains("\"app_version\""))
        assertTrue(json.contains("\"os_name\""))
        assertTrue(json.contains("\"sdk_version\""))
    }

    @Test
    fun testEventTypeSerialNames() {
        val trackEvent = testEvent.copy(eventType = EventType.TRACK)
        val trackJson = Serializer.serializeEvent(trackEvent)
        assertTrue(trackJson.contains("\"track\""))

        val identifyEvent = testEvent.copy(eventType = EventType.IDENTIFY)
        val identifyJson = Serializer.serializeEvent(identifyEvent)
        assertTrue(identifyJson.contains("\"identify\""))

        val screenEvent = testEvent.copy(eventType = EventType.SCREEN)
        val screenJson = Serializer.serializeEvent(screenEvent)
        assertTrue(screenJson.contains("\"screen\""))
    }

    @Test
    fun testBatchPayloadSerializationRoundTrip() {
        val payload = BatchPayload(
            batch = listOf(testEvent, testEvent.copy(eventId = "evt-002")),
            sentAt = "2025-06-15T14:31:00Z"
        )

        val json = Serializer.serializeBatchPayload(payload)
        assertNotNull(json)
        assertTrue(json.isNotEmpty())

        val deserialized = Serializer.deserializeBatchPayload(json)
        assertEquals(2, deserialized.batch.size)
        assertEquals("2025-06-15T14:31:00Z", deserialized.sentAt)
        assertEquals("evt-001", deserialized.batch[0].eventId)
        assertEquals("evt-002", deserialized.batch[1].eventId)
    }

    @Test
    fun testBatchPayloadJsonStructure() {
        val payload = BatchPayload(
            batch = listOf(testEvent),
            sentAt = "2025-06-15T14:31:00Z"
        )

        val json = Serializer.serializeBatchPayload(payload)
        assertTrue(json.contains("\"batch\""))
        assertTrue(json.contains("\"sent_at\""))
    }

    @Test
    fun testEventListSerializationRoundTrip() {
        val events = listOf(
            testEvent,
            testEvent.copy(eventId = "evt-002", eventName = "page_view"),
            testEvent.copy(eventId = "evt-003", eventType = EventType.SCREEN)
        )

        val json = Serializer.serializeEventList(events)
        val deserialized = Serializer.deserializeEventList(json)

        assertEquals(3, deserialized.size)
        assertEquals("evt-001", deserialized[0].eventId)
        assertEquals("page_view", deserialized[1].eventName)
        assertEquals(EventType.SCREEN, deserialized[2].eventType)
    }

    @Test
    fun testEventWithNullOptionalFields() {
        val event = EventModel(
            eventId = "evt-null",
            eventName = "minimal_event",
            eventType = EventType.TRACK,
            userId = null,
            anonymousId = "anon-only",
            mobileNumber = null,
            email = null,
            clientTimestamp = "2025-01-01T00:00:00Z",
            properties = emptyMap(),
            context = testContext.copy(appVersion = null, networkType = null)
        )

        val json = Serializer.serializeEvent(event)
        val deserialized = Serializer.deserializeEvent(json)

        assertEquals(null, deserialized.userId)
        assertEquals(null, deserialized.mobileNumber)
        assertEquals(null, deserialized.email)
        assertEquals(null, deserialized.context.appVersion)
        assertEquals(null, deserialized.context.networkType)
        assertTrue(deserialized.properties.isEmpty())
    }

    @Test
    fun testDeviceContextModelSerialization() {
        val json = Serializer.serializeEvent(testEvent)

        // Verify context fields use serial names
        assertTrue(json.contains("\"app_version\""))
        assertTrue(json.contains("\"os_name\""))
        assertTrue(json.contains("\"os_version\""))
        assertTrue(json.contains("\"device_model\""))
        assertTrue(json.contains("\"device_id\""))
        assertTrue(json.contains("\"network_type\""))
        assertTrue(json.contains("\"sdk_version\""))
    }
}
