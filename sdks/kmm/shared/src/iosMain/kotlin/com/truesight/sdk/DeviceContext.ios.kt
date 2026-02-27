package com.truesight.sdk

import platform.Foundation.NSBundle
import platform.Foundation.NSLocale
import platform.Foundation.NSTimeZone
import platform.Foundation.currentLocale
import platform.Foundation.localTimeZone
import platform.Foundation.languageCode
import platform.Foundation.countryCode
import platform.UIKit.UIDevice

actual class DeviceContextCollector {

    actual fun collect(): DeviceContextModel {
        val device = UIDevice.currentDevice
        val bundle = NSBundle.mainBundle

        val appVersion = bundle.objectForInfoDictionaryKey("CFBundleShortVersionString") as? String

        val locale = NSLocale.currentLocale.let {
            val lang = it.languageCode
            val country = it.countryCode ?: ""
            if (country.isNotEmpty()) "$lang-$country" else lang
        }

        val timezone = NSTimeZone.localTimeZone.name

        return DeviceContextModel(
            appVersion = appVersion,
            osName = "iOS",
            osVersion = device.systemVersion,
            deviceModel = device.model,
            deviceId = device.identifierForVendor?.UUIDString() ?: "",
            networkType = null, // Network type requires Reachability - omit on iOS for simplicity
            locale = locale,
            timezone = timezone,
            sdkVersion = TrueSight.SDK_VERSION
        )
    }
}
