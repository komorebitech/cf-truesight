package com.truesight.sdk

import kotlinx.cinterop.alloc
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.reinterpret
import kotlinx.cinterop.value
import platform.CoreFoundation.CFDictionaryCreateMutable
import platform.CoreFoundation.CFDictionarySetValue
import platform.CoreFoundation.CFMutableDictionaryRef
import platform.CoreFoundation.CFRelease
import platform.CoreFoundation.kCFBooleanTrue
import platform.CoreFoundation.kCFTypeDictionaryKeyCallBacks
import platform.CoreFoundation.kCFTypeDictionaryValueCallBacks
import platform.Foundation.CFBridgingRetain
import platform.Foundation.NSData
import platform.Foundation.NSString
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.NSUUID
import platform.Foundation.create
import platform.Foundation.dataUsingEncoding
import platform.Security.SecItemAdd
import platform.Security.SecItemCopyMatching
import platform.Security.SecItemDelete
import platform.Security.errSecSuccess
import platform.Security.kSecAttrAccount
import platform.Security.kSecAttrService
import platform.Security.kSecClass
import platform.Security.kSecClassGenericPassword
import platform.Security.kSecMatchLimit
import platform.Security.kSecMatchLimitOne
import platform.Security.kSecReturnData
import platform.Security.kSecValueData

actual class AnonymousIdManager {

    companion object {
        private const val SERVICE_NAME = "com.truesight.sdk"
        private const val ACCOUNT_NAME = "anonymous_id"
    }

    actual fun getOrCreate(): String {
        val existing = readFromKeychain()
        if (existing != null) return existing

        val newId = NSUUID().UUIDString()
        saveToKeychain(newId)
        return newId
    }

    actual fun reset(): String {
        deleteFromKeychain()
        val newId = NSUUID().UUIDString()
        saveToKeychain(newId)
        return newId
    }

    private fun baseQuery(): CFMutableDictionaryRef {
        val query = CFDictionaryCreateMutable(
            null, 6,
            kCFTypeDictionaryKeyCallBacks.ptr,
            kCFTypeDictionaryValueCallBacks.ptr
        )!!
        CFDictionarySetValue(query, kSecClass, kSecClassGenericPassword)
        CFDictionarySetValue(query, kSecAttrService, CFBridgingRetain(SERVICE_NAME))
        CFDictionarySetValue(query, kSecAttrAccount, CFBridgingRetain(ACCOUNT_NAME))
        return query
    }

    private fun readFromKeychain(): String? {
        val query = baseQuery()
        CFDictionarySetValue(query, kSecReturnData, kCFBooleanTrue)
        CFDictionarySetValue(query, kSecMatchLimit, kSecMatchLimitOne)

        memScoped {
            val result = alloc<kotlinx.cinterop.ObjCObjectVar<Any?>>()
            val status = SecItemCopyMatching(query, result.ptr.reinterpret())
            CFRelease(query)
            if (status == errSecSuccess) {
                val data = result.value as? NSData ?: return null
                return NSString.create(data = data, encoding = NSUTF8StringEncoding) as? String
            }
        }
        return null
    }

    private fun saveToKeychain(value: String) {
        deleteFromKeychain()

        val nsData = (value as NSString).dataUsingEncoding(NSUTF8StringEncoding) ?: return

        val query = baseQuery()
        CFDictionarySetValue(query, kSecValueData, CFBridgingRetain(nsData))
        SecItemAdd(query, null)
        CFRelease(query)
    }

    private fun deleteFromKeychain() {
        val query = baseQuery()
        SecItemDelete(query)
        CFRelease(query)
    }
}
