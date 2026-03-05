use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct JwtClaims {
    pub sub: String, // user UUID
    pub email: String,
    pub name: String,
    pub exp: usize, // expiration timestamp
    pub iat: usize, // issued at
}

pub fn create_jwt(
    secret: &str,
    user_id: Uuid,
    email: &str,
    name: &str,
    ttl_seconds: u64,
) -> anyhow::Result<String> {
    let now = chrono::Utc::now().timestamp() as usize;
    let claims = JwtClaims {
        sub: user_id.to_string(),
        email: email.to_string(),
        name: name.to_string(),
        exp: now + ttl_seconds as usize,
        iat: now,
    };

    let token = jsonwebtoken::encode(
        &Header::default(), // HS256
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;

    Ok(token)
}

pub fn verify_jwt(secret: &str, token: &str) -> anyhow::Result<JwtClaims> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;

    let token_data = jsonwebtoken::decode::<JwtClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )?;

    Ok(token_data.claims)
}
