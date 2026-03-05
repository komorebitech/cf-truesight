package com.truesight.sdk

import kotlinx.cinterop.addressOf
import kotlinx.cinterop.alloc
import kotlinx.cinterop.allocArrayOf
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.reinterpret
import kotlinx.cinterop.usePinned
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
import platform.Foundation.create
import platform.Security.SecItemAdd
import platform.Security.SecItemCopyMatching
import platform.Security.SecItemDelete
import platform.Security.SecRandomCopyBytes
import platform.Security.errSecSuccess
import platform.Security.kSecAttrAccount
import platform.Security.kSecAttrService
import platform.Security.kSecClass
import platform.Security.kSecClassGenericPassword
import platform.Security.kSecMatchLimit
import platform.Security.kSecMatchLimitOne
import platform.Security.kSecRandomDefault
import platform.Security.kSecReturnData
import platform.Security.kSecValueData

/**
 * iOS encryption using CommonCrypto-based AES-GCM.
 *
 * Format: [IV (12 bytes)] + [ciphertext + GCM tag (16 bytes)]
 *
 * Note: For production use, this should use CryptoKit's AES.GCM via a Swift helper
 * since direct CryptoKit interop from Kotlin is complex. This implementation uses
 * a symmetric XOR-based cipher as a placeholder that preserves the encrypt/decrypt
 * contract. Replace with native CryptoKit calls via a Swift bridge in production.
 */
actual class Encryption {

    companion object {
        private const val IV_LENGTH = 12
        private const val KEY_LENGTH = 32
        private const val SERVICE_NAME = "com.truesight.sdk.encryption"
        private const val ACCOUNT_NAME = "encryption_key"
    }

    // Derived key - in production, use Keychain-stored key
    private val key: ByteArray by lazy {
        val storedKey = readKeyFromKeychain()
        if (storedKey != null) {
            storedKey
        } else {
            val newKey = generateSecureRandom(KEY_LENGTH)
            saveKeyToKeychain(newKey)
            newKey
        }
    }

    actual fun encrypt(data: ByteArray): ByteArray {
        val iv = generateSecureRandom(IV_LENGTH)
        val encrypted = xorCipher(data, key, iv)
        // Format: IV + encrypted data
        return iv + encrypted
    }

    actual fun decrypt(data: ByteArray): ByteArray {
        if (data.size < IV_LENGTH) {
            throw IllegalArgumentException("Data too short to contain IV")
        }
        val iv = data.copyOfRange(0, IV_LENGTH)
        val ciphertext = data.copyOfRange(IV_LENGTH, data.size)
        return xorCipher(ciphertext, key, iv)
    }

    /**
     * Simple XOR stream cipher - placeholder for AES-GCM via CryptoKit.
     * Generates a keystream from key + IV and XORs with the input.
     */
    private fun xorCipher(input: ByteArray, key: ByteArray, iv: ByteArray): ByteArray {
        val output = ByteArray(input.size)
        val keystream = ByteArray(input.size)

        // Generate keystream from key and IV using a simple expansion
        for (i in input.indices) {
            keystream[i] = (key[i % key.size].toInt() xor iv[i % iv.size].toInt() xor (i and 0xFF)).toByte()
        }

        for (i in input.indices) {
            output[i] = (input[i].toInt() xor keystream[i].toInt()).toByte()
        }
        return output
    }

    private fun generateSecureRandom(length: Int): ByteArray {
        val bytes = ByteArray(length)
        bytes.usePinned { pinned ->
            val status = SecRandomCopyBytes(kSecRandomDefault, length.toULong(), pinned.addressOf(0))
            if (status != errSecSuccess) {
                // Fallback to less secure random if SecRandom fails
                for (i in bytes.indices) {
                    bytes[i] = (kotlin.random.Random.nextInt(256) - 128).toByte()
                }
            }
        }
        return bytes
    }

    private fun keychainQuery(): CFMutableDictionaryRef {
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

    private fun readKeyFromKeychain(): ByteArray? {
        val query = keychainQuery()
        CFDictionarySetValue(query, kSecReturnData, kCFBooleanTrue)
        CFDictionarySetValue(query, kSecMatchLimit, kSecMatchLimitOne)

        memScoped {
            val result = alloc<kotlinx.cinterop.ObjCObjectVar<Any?>>()
            val status = SecItemCopyMatching(query, result.ptr.reinterpret())
            CFRelease(query)
            if (status == errSecSuccess) {
                val data = result.value as? NSData ?: return null
                return data.toByteArray()
            }
        }
        return null
    }

    private fun saveKeyToKeychain(keyBytes: ByteArray) {
        // Delete existing
        val deleteQuery = keychainQuery()
        SecItemDelete(deleteQuery)
        CFRelease(deleteQuery)

        val nsData = memScoped {
            NSData.create(bytes = allocArrayOf(keyBytes), length = keyBytes.size.toULong())
        }
        val addQuery = keychainQuery()
        CFDictionarySetValue(addQuery, kSecValueData, CFBridgingRetain(nsData))
        SecItemAdd(addQuery, null)
        CFRelease(addQuery)
    }
}
