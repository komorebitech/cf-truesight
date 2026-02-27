package com.truesight.sdk

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class BatchPayload(
    val batch: List<EventModel>,
    @SerialName("sent_at") val sentAt: String
)
