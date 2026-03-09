package com.truesight.sdk

import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType

actual class NetworkClient {

    private val client = HttpClient(OkHttp) {
        engine {
            config {
                retryOnConnectionFailure(true)
                connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
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

            val response = client.post("$endpoint/v1/events/batch") {
                header("X-API-Key", apiKey)
                header("User-Agent", "TrueSight-KMM/${TrueSight.SDK_VERSION}")
                contentType(ContentType.Application.Json)
                setBody(jsonString)
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
