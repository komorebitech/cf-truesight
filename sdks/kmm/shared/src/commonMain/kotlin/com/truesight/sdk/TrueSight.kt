package com.truesight.sdk

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.datetime.Clock
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive

object TrueSight {

    private const val TAG = "TrueSight"
    internal const val SDK_VERSION = "1.0.0"

    private var initialized = false
    private lateinit var config: Config
    private lateinit var eventQueue: EventQueue
    private lateinit var networkClient: NetworkClient
    private lateinit var flushScheduler: FlushScheduler
    private lateinit var anonymousIdManager: AnonymousIdManager
    private lateinit var deviceContextCollector: DeviceContextCollector
    private lateinit var logger: Logger

    private var userId: String? = null
    private var anonymousId: String = ""
    private var mobileNumber: String? = null
    private var email: String? = null
    private var traits: Map<String, Any?> = emptyMap()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val mutex = Mutex()
    private var flushing = false

    fun init(config: Config) {
        init(
            config = config,
            eventQueue = EventQueue(),
            networkClient = NetworkClient(),
            flushScheduler = FlushScheduler(),
            anonymousIdManager = AnonymousIdManager(),
            deviceContextCollector = DeviceContextCollector(),
            logger = Logger()
        )
    }

    internal fun init(
        config: Config,
        eventQueue: EventQueue,
        networkClient: NetworkClient,
        flushScheduler: FlushScheduler,
        anonymousIdManager: AnonymousIdManager,
        deviceContextCollector: DeviceContextCollector,
        logger: Logger
    ) {
        if (initialized) {
            logger.warn(TAG, "TrueSight SDK already initialized")
            return
        }

        this.config = config
        this.eventQueue = eventQueue
        this.networkClient = networkClient
        this.flushScheduler = flushScheduler
        this.anonymousIdManager = anonymousIdManager
        this.deviceContextCollector = deviceContextCollector
        this.logger = logger

        anonymousId = anonymousIdManager.getOrCreate()

        flushScheduler.start(config.flushInterval) {
            performFlush()
        }

        initialized = true

        if (config.debug) {
            logger.debug(TAG, "TrueSight SDK initialized with endpoint: ${config.endpoint}")
            logger.debug(TAG, "Anonymous ID: $anonymousId")
        }
    }

    fun track(eventName: String, properties: Map<String, Any?> = emptyMap()) {
        ensureInitialized()
        val event = buildEvent(
            eventName = eventName,
            eventType = EventType.TRACK,
            properties = properties
        )
        enqueueEvent(event)
    }

    fun identify(userId: String, traits: Map<String, Any?> = emptyMap()) {
        ensureInitialized()
        this.userId = userId
        this.traits = traits

        // Auto-promote mobile_number and email from traits
        traits["mobile_number"]?.let { value ->
            if (value is String) {
                val cleaned = value.replace(Regex("[^0-9]"), "")
                if (cleaned.length == 10) {
                    mobileNumber = cleaned
                }
            }
        }
        traits["email"]?.let { value ->
            if (value is String && value.contains("@")) {
                email = value
            }
        }

        val event = buildEvent(
            eventName = "identify",
            eventType = EventType.IDENTIFY,
            properties = traits
        )
        enqueueEvent(event)

        if (config.debug) {
            logger.debug(TAG, "User identified: $userId")
        }
    }

    fun screen(screenName: String, properties: Map<String, Any?> = emptyMap()) {
        ensureInitialized()
        val mergedProperties = properties.toMutableMap().apply {
            put("screen_name", screenName)
        }
        val event = buildEvent(
            eventName = screenName,
            eventType = EventType.SCREEN,
            properties = mergedProperties
        )
        enqueueEvent(event)
    }

    fun flush() {
        ensureInitialized()
        scope.launch {
            performFlush()
        }
    }

    fun reset() {
        ensureInitialized()
        userId = null
        mobileNumber = null
        email = null
        traits = emptyMap()
        anonymousId = anonymousIdManager.reset()
        scope.launch {
            eventQueue.clear()
        }
        if (config.debug) {
            logger.debug(TAG, "SDK state reset. New anonymous ID: $anonymousId")
        }
    }

    fun setMobileNumber(number: String) {
        ensureInitialized()
        val cleaned = number.replace(Regex("[^0-9]"), "")
        if (cleaned.length != 10) {
            logger.warn(TAG, "Invalid mobile number: must be exactly 10 digits, got ${cleaned.length}")
            return
        }
        mobileNumber = cleaned
        if (config.debug) {
            logger.debug(TAG, "Mobile number set: ${cleaned.take(3)}***${cleaned.takeLast(2)}")
        }
    }

    fun setEmail(email: String) {
        ensureInitialized()
        if (!email.contains("@") || !email.contains(".")) {
            logger.warn(TAG, "Invalid email format: $email")
            return
        }
        this.email = email
        if (config.debug) {
            logger.debug(TAG, "Email set: $email")
        }
    }

    // -- Internal helpers --

    internal fun isInitialized(): Boolean = initialized

    internal fun getCurrentUserId(): String? = userId

    internal fun getAnonymousId(): String = anonymousId

    internal fun getMobileNumber(): String? = mobileNumber

    internal fun getEmail(): String? = email

    private fun ensureInitialized() {
        check(initialized) { "TrueSight SDK not initialized. Call TrueSight.init(config) first." }
    }

    private fun buildEvent(
        eventName: String,
        eventType: EventType,
        properties: Map<String, Any?>
    ): EventModel {
        val now = Clock.System.now()
        val timestamp = now.toLocalDateTime(TimeZone.UTC).toString() + "Z"

        return EventModel(
            eventId = generateUUID(),
            eventName = eventName,
            eventType = eventType,
            userId = userId,
            anonymousId = anonymousId,
            mobileNumber = mobileNumber,
            email = email,
            clientTimestamp = timestamp,
            properties = convertProperties(properties),
            context = deviceContextCollector.collect()
        )
    }

    private fun convertProperties(properties: Map<String, Any?>): Map<String, JsonElement> {
        return properties.mapValues { (_, value) ->
            when (value) {
                null -> JsonNull
                is String -> JsonPrimitive(value)
                is Number -> JsonPrimitive(value)
                is Boolean -> JsonPrimitive(value)
                else -> JsonPrimitive(value.toString())
            }
        }
    }

    private fun enqueueEvent(event: EventModel) {
        scope.launch {
            try {
                val serialized = Serializer.serializeEvent(event)
                if (serialized.length > config.maxEventSize) {
                    logger.warn(TAG, "Event exceeds max size (${serialized.length} > ${config.maxEventSize}), dropping")
                    return@launch
                }

                val currentSize = eventQueue.size()
                if (currentSize >= config.maxQueueSize) {
                    logger.warn(TAG, "Event queue full ($currentSize events), dropping oldest")
                    val oldest = eventQueue.dequeue(1)
                    if (oldest.isNotEmpty()) {
                        eventQueue.remove(oldest.map { it.eventId })
                    }
                }

                eventQueue.enqueue(event)

                if (config.debug) {
                    logger.debug(TAG, "Event enqueued: ${event.eventName} (${event.eventType})")
                }

                // Auto-flush if batch size reached
                if (eventQueue.size() >= config.maxBatchSize) {
                    performFlush()
                }
            } catch (e: Exception) {
                logger.error(TAG, "Failed to enqueue event: ${event.eventName}", e)
            }
        }
    }

    private suspend fun performFlush() {
        mutex.withLock {
            if (flushing) return
            flushing = true
        }

        try {
            while (true) {
                val events = eventQueue.dequeue(config.maxBatchSize)
                if (events.isEmpty()) break

                val now = Clock.System.now()
                val sentAt = now.toLocalDateTime(TimeZone.UTC).toString() + "Z"
                val payload = BatchPayload(batch = events, sentAt = sentAt)

                when (val result = networkClient.sendBatch(config.endpoint, config.apiKey, payload)) {
                    is NetworkResult.Success -> {
                        eventQueue.remove(events.map { it.eventId })
                        if (config.debug) {
                            logger.debug(TAG, "Flush successful: ${result.accepted} events accepted")
                        }
                    }
                    is NetworkResult.ClientError -> {
                        logger.error(TAG, "Client error ${result.code}: ${result.message}")
                        // Drop events on client error (4xx) - they won't succeed on retry
                        eventQueue.remove(events.map { it.eventId })
                        break
                    }
                    is NetworkResult.ServerError -> {
                        logger.warn(TAG, "Server error ${result.code}: ${result.message}, will retry")
                        // Keep events in queue for retry
                        break
                    }
                    is NetworkResult.NetworkFailure -> {
                        logger.warn(TAG, "Network failure, will retry: ${result.cause.message}")
                        // Keep events in queue for retry
                        break
                    }
                }
            }
        } catch (e: Exception) {
            logger.error(TAG, "Flush failed unexpectedly", e)
        } finally {
            mutex.withLock {
                flushing = false
            }
        }
    }

    /**
     * Resets internal state for testing purposes.
     */
    internal fun tearDown() {
        if (initialized) {
            flushScheduler.stop()
        }
        initialized = false
        userId = null
        mobileNumber = null
        email = null
        traits = emptyMap()
        anonymousId = ""
        flushing = false
    }
}

/**
 * Platform-specific UUID generation.
 */
expect fun generateUUID(): String
