package com.truesight.sdk

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class DeviceContextModel(
    @SerialName("app_version") val appVersion: String? = null,
    @SerialName("os_name") val osName: String,
    @SerialName("os_version") val osVersion: String,
    @SerialName("device_model") val deviceModel: String,
    @SerialName("device_id") val deviceId: String,
    @SerialName("network_type") val networkType: String? = null,
    val locale: String,
    val timezone: String,
    @SerialName("sdk_version") val sdkVersion: String
)

expect class DeviceContextCollector {
    fun collect(): DeviceContextModel
}
