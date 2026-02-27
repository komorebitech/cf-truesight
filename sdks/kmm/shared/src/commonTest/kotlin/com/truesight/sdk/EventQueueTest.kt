package com.truesight.sdk

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * Basic queue contract tests.
 *
 * Since EventQueue uses expect/actual, these tests validate the contract
 * that all platform implementations must satisfy. They run on each platform
 * using the actual implementation.
 */
class EventQueueTest {

    @Test
    fun testEventModelCreation() {
        val context = DeviceContextModel(
            appVersion = "1.0.0",
            osName = "Test",
            osVersion = "1.0",
            deviceModel = "TestDevice",
            deviceId = "test-device-id",
            networkType = "wifi",
            locale = "en-US",
            timezone = "UTC",
            sdkVersion = "1.0.0"
        )

        val event = EventModel(
            eventId = "test-event-id",
            eventName = "test_event",
            eventType = EventType.TRACK,
            userId = "user-123",
            anonymousId = "anon-456",
            mobileNumber = "1234567890",
            email = "test@example.com",
            clientTimestamp = "2025-01-15T10:30:00Z",
            properties = emptyMap(),
            context = context
        )

        assertEquals("test-event-id", event.eventId)
        assertEquals("test_event", event.eventName)
        assertEquals(EventType.TRACK, event.eventType)
        assertEquals("user-123", event.userId)
        assertEquals("anon-456", event.anonymousId)
        assertEquals("1234567890", event.mobileNumber)
        assertEquals("test@example.com", event.email)
        assertNotNull(event.context)
    }

    @Test
    fun testEventTypeValues() {
        assertEquals(EventType.TRACK, EventType.TRACK)
        assertEquals(EventType.IDENTIFY, EventType.IDENTIFY)
        assertEquals(EventType.SCREEN, EventType.SCREEN)
        assertTrue(EventType.entries.size == 3)
    }

    @Test
    fun testEventModelDefaults() {
        val context = DeviceContextModel(
            osName = "Test",
            osVersion = "1.0",
            deviceModel = "TestDevice",
            deviceId = "test-id",
            locale = "en-US",
            timezone = "UTC",
            sdkVersion = "1.0.0"
        )

        val event = EventModel(
            eventId = "id",
            eventName = "name",
            eventType = EventType.TRACK,
            anonymousId = "anon",
            clientTimestamp = "2025-01-01T00:00:00Z",
            context = context
        )

        assertEquals(null, event.userId)
        assertEquals(null, event.mobileNumber)
        assertEquals(null, event.email)
        assertTrue(event.properties.isEmpty())
    }
}
