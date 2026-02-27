package com.truesight.sdk

import io.ktor.client.HttpClient
import io.ktor.client.engine.darwin.Darwin
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import platform.Foundation.NSData
import platform.Foundation.create
import platform.Foundation.NSMutableData
import platform.Foundation.appendBytes

actual class NetworkClient {

    private val client = HttpClient(Darwin) {
        engine {
            configureRequest {
                setTimeoutInterval(30.0)
            }
        }
    }

    actual suspend fun sendBatch(
        endpoint: String,
        apiKey: String,
        payload: BatchPayload
    ): NetworkResult {
        return try {
            val jsonString = Serializer.serializeBatchPayload(payload)
            val jsonBytes = jsonString.encodeToByteArray()
            // Send uncompressed on iOS (NSData compression requires iOS 13+)
            // In production, use platform compression APIs for zstd

            val response = client.post("$endpoint/v1/batch") {
                header("X-API-Key", apiKey)
                header("User-Agent", "TrueSight-KMM/${TrueSight.SDK_VERSION}")
                contentType(ContentType.Application.Json)
                setBody(jsonBytes)
            }

            when (response.status.value) {
                in 200..299 -> {
                    NetworkResult.Success(accepted = payload.batch.size)
                }
                in 400..499 -> {
                    val body = response.bodyAsText()
                    NetworkResult.ClientError(response.status.value, body)
                }
                else -> {
                    val body = response.bodyAsText()
                    NetworkResult.ServerError(response.status.value, body)
                }
            }
        } catch (e: Exception) {
            NetworkResult.NetworkFailure(e)
        }
    }
}
