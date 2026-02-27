package com.truesight.sdk

expect class NetworkClient {
    suspend fun sendBatch(endpoint: String, apiKey: String, payload: BatchPayload): NetworkResult
}

sealed class NetworkResult {
    data class Success(val accepted: Int) : NetworkResult()
    data class ClientError(val code: Int, val message: String) : NetworkResult()
    data class ServerError(val code: Int, val message: String) : NetworkResult()
    data class NetworkFailure(val cause: Throwable) : NetworkResult()
}
