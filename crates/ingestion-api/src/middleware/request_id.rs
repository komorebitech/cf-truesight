use axum::{extract::Request, http::HeaderValue, middleware::Next, response::Response};
use uuid::Uuid;

/// Newtype wrapper for a request ID stored in request extensions.
#[derive(Debug, Clone)]
pub struct RequestId(pub String);

/// Middleware that ensures every request has a unique request ID.
///
/// - If the incoming request carries an `X-Request-Id` header, that value is used.
/// - Otherwise a new UUID v4 is generated.
///
/// The ID is injected into the request extensions as `RequestId` and echoed back
/// in the `X-Request-Id` response header.
pub async fn request_id_middleware(mut request: Request, next: Next) -> Response {
    let request_id = request
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    request
        .extensions_mut()
        .insert(RequestId(request_id.clone()));

    let mut response = next.run(request).await;

    if let Ok(val) = HeaderValue::from_str(&request_id) {
        response.headers_mut().insert("x-request-id", val);
    }

    response
}
