package com.truesight.sdk

import kotlinx.cinterop.alloc
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.value
import platform.CoreFoundation.CFDictionaryRef
import platform.Foundation.CFBridgingRelease
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
import platform.Security.SecItemUpdate
import platform.Security.errSecSuccess
import platform.Security.errSecItemNotFound
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

    private fun readFromKeychain(): String? {
        val query = mapOf<Any?, Any?>(
            kSecClass to kSecClassGenericPassword,
            kSecAttrService to SERVICE_NAME,
            kSecAttrAccount to ACCOUNT_NAME,
            kSecReturnData to true,
            kSecMatchLimit to kSecMatchLimitOne
        )

        memScoped {
            val result = alloc<kotlinx.cinterop.ObjCObjectVar<Any?>>()
            @Suppress("UNCHECKED_CAST")
            val status = SecItemCopyMatching(
                query as CFDictionaryRef,
                result.ptr
            )
            if (status == errSecSuccess) {
                val data = result.value as? NSData ?: return null
                return NSString.create(data = data, encoding = NSUTF8StringEncoding) as? String
            }
        }
        return null
    }

    private fun saveToKeychain(value: String) {
        // Delete existing entry first
        deleteFromKeychain()

        val nsData = (value as NSString).dataUsingEncoding(NSUTF8StringEncoding) ?: return

        val query = mapOf<Any?, Any?>(
            kSecClass to kSecClassGenericPassword,
            kSecAttrService to SERVICE_NAME,
            kSecAttrAccount to ACCOUNT_NAME,
            kSecValueData to nsData
        )

        @Suppress("UNCHECKED_CAST")
        SecItemAdd(query as CFDictionaryRef, null)
    }

    private fun deleteFromKeychain() {
        val query = mapOf<Any?, Any?>(
            kSecClass to kSecClassGenericPassword,
            kSecAttrService to SERVICE_NAME,
            kSecAttrAccount to ACCOUNT_NAME
        )

        @Suppress("UNCHECKED_CAST")
        SecItemDelete(query as CFDictionaryRef)
    }
}
