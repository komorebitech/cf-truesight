package com.truesight.sdk

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.provider.Settings

actual class DeviceContextCollector {

    companion object {
        private var appContext: Context? = null

        fun initialize(context: Context) {
            appContext = context.applicationContext
        }
    }

    actual fun collect(): DeviceContextModel {
        val context = appContext
            ?: return fallbackContext()

        val appVersion = try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            packageInfo.versionName
        } catch (e: Exception) {
            null
        }

        val networkType = try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            val network = cm?.activeNetwork
            val capabilities = cm?.getNetworkCapabilities(network)
            when {
                capabilities == null -> "unknown"
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
                else -> "unknown"
            }
        } catch (e: Exception) {
            "unknown"
        }

        val deviceId = try {
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: ""
        } catch (e: Exception) {
            ""
        }

        val locale = java.util.Locale.getDefault().let { "${it.language}-${it.country}" }
        val timezone = java.util.TimeZone.getDefault().id

        return DeviceContextModel(
            appVersion = appVersion,
            osName = "Android",
            osVersion = Build.VERSION.RELEASE,
            deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}",
            deviceId = deviceId,
            networkType = networkType,
            locale = locale,
            timezone = timezone,
            sdkVersion = TrueSight.SDK_VERSION
        )
    }

    private fun fallbackContext(): DeviceContextModel {
        return DeviceContextModel(
            appVersion = null,
            osName = "Android",
            osVersion = Build.VERSION.RELEASE,
            deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}",
            deviceId = "",
            networkType = "unknown",
            locale = java.util.Locale.getDefault().let { "${it.language}-${it.country}" },
            timezone = java.util.TimeZone.getDefault().id,
            sdkVersion = TrueSight.SDK_VERSION
        )
    }
}
