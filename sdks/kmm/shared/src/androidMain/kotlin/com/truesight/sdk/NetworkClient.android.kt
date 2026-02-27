package com.truesight.sdk

import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import java.io.ByteArrayOutputStream
import java.util.zip.Deflater

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
            val compressed = compressDeflate(jsonString.encodeToByteArray())

            val response = client.post("$endpoint/v1/batch") {
                header("X-API-Key", apiKey)
                header("Content-Encoding", "deflate")
                header("User-Agent", "TrueSight-KMM/${TrueSight.SDK_VERSION}")
                contentType(ContentType.Application.Json)
                setBody(compressed)
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

    private fun compressDeflate(data: ByteArray): ByteArray {
        val deflater = Deflater(Deflater.DEFAULT_COMPRESSION)
        deflater.setInput(data)
        deflater.finish()

        val outputStream = ByteArrayOutputStream(data.size)
        val buffer = ByteArray(1024)
        while (!deflater.finished()) {
            val count = deflater.deflate(buffer)
            outputStream.write(buffer, 0, count)
        }
        deflater.end()
        return outputStream.toByteArray()
    }
}
