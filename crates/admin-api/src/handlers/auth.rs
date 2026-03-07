use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use serde::{Deserialize, Serialize};
use tracing::info;

use truesight_common::error::AppError;
use truesight_common::jwt::create_jwt;
use truesight_common::team::TeamRole;

use crate::db;
use crate::middleware::admin_auth::AuthUser;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Google JWKS types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct GoogleJwks {
    keys: Vec<GoogleJwk>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct GoogleJwk {
    kid: String,
    n: String,
    e: String,
    #[serde(default)]
    alg: Option<String>,
}

/// Google ID token claims we care about.
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct GoogleIdTokenClaims {
    sub: String,
    email: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    picture: Option<String>,
    aud: String,
    iss: String,
}

// ---------------------------------------------------------------------------
// POST /v1/auth/google
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct GoogleLoginRequest {
    pub credential: String,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: String,
    pub email: String,
    pub name: String,
    pub picture_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GoogleLoginResponse {
    pub token: String,
    pub user: UserResponse,
}

pub async fn google_login(
    State(state): State<AppState>,
    Json(body): Json<GoogleLoginRequest>,
) -> Result<impl IntoResponse, AppError> {
    let google_client_id = state
        .config
        .google_client_id
        .as_ref()
        .ok_or_else(|| AppError::Internal("Google SSO not configured".to_string()))?;

    let jwt_secret = state
        .config
        .jwt_secret
        .as_ref()
        .ok_or_else(|| AppError::Internal("JWT secret not configured".to_string()))?;

    // Decode the Google ID token header to get `kid`
    let header = jsonwebtoken::decode_header(&body.credential)
        .map_err(|e| AppError::Unauthorized(format!("Invalid token header: {e}")))?;

    let kid = header
        .kid
        .ok_or_else(|| AppError::Unauthorized("Token missing kid header".to_string()))?;

    // Fetch Google's JWKS
    let jwks = fetch_google_jwks(&state).await?;

    // Find the matching key
    let jwk = jwks
        .keys
        .iter()
        .find(|k| k.kid == kid)
        .ok_or_else(|| AppError::Unauthorized("No matching Google signing key".to_string()))?;

    // Build decoding key from RSA components
    let decoding_key = jsonwebtoken::DecodingKey::from_rsa_components(&jwk.n, &jwk.e)
        .map_err(|e| AppError::Internal(format!("Failed to build decoding key: {e}")))?;

    // Validate the token
    let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::RS256);
    validation.set_audience(&[google_client_id.as_str()]);
    validation.set_issuer(&["accounts.google.com", "https://accounts.google.com"]);

    let token_data =
        jsonwebtoken::decode::<GoogleIdTokenClaims>(&body.credential, &decoding_key, &validation)
            .map_err(|e| AppError::Unauthorized(format!("Token verification failed: {e}")))?;

    let claims = token_data.claims;

    // Verify issuer (belt and suspenders)
    if claims.iss != "accounts.google.com" && claims.iss != "https://accounts.google.com" {
        return Err(AppError::Unauthorized("Invalid token issuer".to_string()));
    }

    // Upsert user
    let name = claims.name.unwrap_or_else(|| claims.email.clone());
    let user = db::users::upsert_user_by_google_sub(
        &state.db_pool,
        &claims.sub,
        &claims.email,
        &name,
        claims.picture.as_deref(),
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    info!("User logged in: {} ({})", user.email, user.id);

    // Check allowed_domains for auto-join
    if let Some(domain) = claims.email.split('@').nth(1) {
        let matching = db::invitations::find_matching_domains(&state.db_pool, domain)
            .map_err(|e| AppError::Database(e.to_string()))?;

        for ad in matching {
            // Try to add as member; ignore if already exists
            let _ = db::teams::add_member(
                &state.db_pool,
                truesight_common::team::NewTeamMember {
                    team_id: ad.team_id,
                    user_id: user.id,
                    role: ad.default_role,
                },
            );
        }
    }

    // Issue TrueSight JWT
    let ttl = state.config.jwt_ttl_seconds.unwrap_or(7 * 86400);
    let token = create_jwt(jwt_secret, user.id, &user.email, &user.name, ttl)
        .map_err(|e| AppError::Internal(format!("Failed to create JWT: {e}")))?;

    Ok((
        StatusCode::OK,
        Json(GoogleLoginResponse {
            token,
            user: UserResponse {
                id: user.id.to_string(),
                email: user.email,
                name: user.name,
                picture_url: user.picture_url,
            },
        }),
    ))
}

/// Fetch Google's JWKS. Uses a simple in-memory cache on AppState.
async fn fetch_google_jwks(state: &AppState) -> Result<GoogleJwks, AppError> {
    // Check cache
    {
        let cache = state.google_jwks.read().await;
        if let Some(ref cached) = *cache {
            let age = chrono::Utc::now() - cached.fetched_at;
            if age.num_minutes() < 60 {
                return Ok(GoogleJwks {
                    keys: cached
                        .keys
                        .iter()
                        .map(|k| GoogleJwk {
                            kid: k.kid.clone(),
                            n: k.n.clone(),
                            e: k.e.clone(),
                            alg: None,
                        })
                        .collect(),
                });
            }
        }
    }

    // Fetch fresh
    let resp = reqwest::get("https://www.googleapis.com/oauth2/v3/certs")
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch Google JWKS: {e}")))?;

    let jwks: GoogleJwks = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse Google JWKS: {e}")))?;

    // Update cache
    {
        let mut cache = state.google_jwks.write().await;
        *cache = Some(crate::state::CachedJwks {
            keys: jwks
                .keys
                .iter()
                .map(|k| crate::state::JwkEntry {
                    kid: k.kid.clone(),
                    n: k.n.clone(),
                    e: k.e.clone(),
                })
                .collect(),
            fetched_at: chrono::Utc::now(),
        });
    }

    Ok(jwks)
}

// ---------------------------------------------------------------------------
// GET /v1/auth/me
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct MeResponse {
    pub user: UserResponse,
    pub teams: Vec<TeamSummary>,
}

#[derive(Debug, Serialize)]
pub struct TeamSummary {
    pub id: String,
    pub name: String,
    pub role: TeamRole,
}

pub async fn me(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    if auth.is_static_token {
        return Err(AppError::Unauthorized(
            "Static token does not have user identity".to_string(),
        ));
    }

    let user_id = auth
        .user_id
        .ok_or_else(|| AppError::Unauthorized("No user ID in token".to_string()))?;

    let user = db::users::find_user_by_id(&state.db_pool, user_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    // Get teams with roles
    let teams = db::teams::list_teams_for_user(&state.db_pool, user_id)
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut team_summaries = Vec::new();
    for team in teams {
        if let Ok(Some(role)) = db::teams::get_user_role_in_team(&state.db_pool, user_id, team.id) {
            team_summaries.push(TeamSummary {
                id: team.id.to_string(),
                name: team.name,
                role,
            });
        }
    }

    Ok(Json(MeResponse {
        user: UserResponse {
            id: user.id.to_string(),
            email: user.email,
            name: user.name,
            picture_url: user.picture_url,
        },
        teams: team_summaries,
    }))
}
