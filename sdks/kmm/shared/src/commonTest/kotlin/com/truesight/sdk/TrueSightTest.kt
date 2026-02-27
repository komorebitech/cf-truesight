package com.truesight.sdk

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class TrueSightTest {

    private val testConfig = Config(
        apiKey = "test-api-key",
        endpoint = "https://api.test.truesight.dev",
        flushInterval = 60_000L,
        maxBatchSize = 10,
        maxQueueSize = 100,
        debug = true
    )

    @Test
    fun testNotInitializedThrows() {
        TrueSight.tearDown()
        assertFailsWith<IllegalStateException> {
            TrueSight.track("test_event")
        }
    }

    @Test
    fun testInitSetsInitializedFlag() {
        TrueSight.tearDown()
        assertFalse(TrueSight.isInitialized())
        // Note: Full init test requires platform-specific actual classes
        // This test validates the pre-init state
    }

    @Test
    fun testConfigDefaults() {
        val config = Config(
            apiKey = "key",
            endpoint = "https://api.example.com"
        )
        assertEquals(30_000L, config.flushInterval)
        assertEquals(50, config.maxBatchSize)
        assertEquals(1000, config.maxQueueSize)
        assertEquals(32768, config.maxEventSize)
        assertFalse(config.debug)
    }

    @Test
    fun testConfigCustomValues() {
        assertEquals("test-api-key", testConfig.apiKey)
        assertEquals("https://api.test.truesight.dev", testConfig.endpoint)
        assertEquals(60_000L, testConfig.flushInterval)
        assertEquals(10, testConfig.maxBatchSize)
        assertEquals(100, testConfig.maxQueueSize)
        assertTrue(testConfig.debug)
    }
}
