use axum::{
    body::Body,
    extract::Request,
    middleware::Next,
    response::{IntoResponse, Response},
};
use bytes::Bytes;
use truesight_common::error::AppError;

use crate::validation::validate_body_size;

/// Maximum decompressed body size (4 MB).
const MAX_DECOMPRESSED_SIZE: usize = 4 * 1024 * 1024;

/// Middleware that handles zstd-compressed request bodies.
///
/// - If `Content-Encoding: zstd` is present, the body is decompressed and the
///   decompressed size is validated against the 4 MB limit.
/// - If the header is missing or has a different value, a 415 Unsupported Media
///   Type error is returned (this API requires zstd encoding).
pub async fn zstd_decode_middleware(request: Request, next: Next) -> Response {
    let content_encoding = request
        .headers()
        .get("content-encoding")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_lowercase());

    match content_encoding.as_deref() {
        Some("zstd") => {
            // Split request into parts and body.
            let (mut parts, body) = request.into_parts();

            // Read the full compressed body.
            let compressed_bytes = match axum::body::to_bytes(body, MAX_DECOMPRESSED_SIZE).await {
                Ok(b) => b,
                Err(_) => {
                    return AppError::PayloadTooLarge(
                        "Compressed request body is too large".to_string(),
                    )
                    .into_response();
                }
            };

            // Decompress with zstd.
            let decompressed = match zstd::decode_all(compressed_bytes.as_ref()) {
                Ok(d) => d,
                Err(e) => {
                    return AppError::Validation(format!("Failed to decompress zstd body: {e}"))
                        .into_response();
                }
            };

            // Validate decompressed size.
            if let Err(e) = validate_body_size(&decompressed) {
                return e.into_response();
            }

            // Remove Content-Encoding header since the body is now decompressed.
            parts.headers.remove("content-encoding");

            // Rebuild the request with the decompressed body.
            let new_request = Request::from_parts(parts, Body::from(Bytes::from(decompressed)));
            next.run(new_request).await
        }
        // No Content-Encoding or non-zstd: pass through as-is (uncompressed JSON).
        _ => next.run(request).await,
    }
}
