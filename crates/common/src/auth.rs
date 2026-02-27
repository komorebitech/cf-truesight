use anyhow::Result;
use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString, rand_core::OsRng},
};
use dashmap::DashMap;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use std::time::{Duration, Instant};
use uuid::Uuid;

/// Hashes an API key using Argon2id.
pub fn hash_api_key(key: &str) -> Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(key.as_bytes(), &salt)
        .map_err(|e| anyhow::anyhow!("Failed to hash API key: {}", e))?;
    Ok(hash.to_string())
}

/// Verifies an API key against an Argon2id hash.
pub fn verify_api_key(key: &str, hash: &str) -> Result<bool> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| anyhow::anyhow!("Failed to parse password hash: {}", e))?;
    let argon2 = Argon2::default();
    Ok(argon2.verify_password(key.as_bytes(), &parsed_hash).is_ok())
}

/// Returns a SHA-256 hex digest of the key, used as a cache lookup key.
pub fn cache_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    hex::encode(hasher.finalize())
}

#[derive(Debug, Clone)]
pub struct CacheEntry {
    pub project_id: Uuid,
    pub expires_at: Instant,
}

#[derive(Debug, Clone)]
pub struct ApiKeyCache {
    inner: Arc<DashMap<String, CacheEntry>>,
}

impl ApiKeyCache {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(DashMap::new()),
        }
    }

    /// Returns the cached project_id if the key is cached and has not expired.
    pub fn get(&self, key: &str) -> Option<Uuid> {
        let cache_k = cache_key(key);
        let entry = self.inner.get(&cache_k)?;
        if entry.expires_at > Instant::now() {
            Some(entry.project_id)
        } else {
            // Expired - remove it
            drop(entry);
            self.inner.remove(&cache_k);
            None
        }
    }

    /// Inserts a key into the cache with the given TTL.
    pub fn insert(&self, key: &str, project_id: Uuid, ttl: Duration) {
        let cache_k = cache_key(key);
        self.inner.insert(
            cache_k,
            CacheEntry {
                project_id,
                expires_at: Instant::now() + ttl,
            },
        );
    }

    /// Removes a key from the cache.
    pub fn remove(&self, key: &str) {
        let cache_k = cache_key(key);
        self.inner.remove(&cache_k);
    }
}

impl Default for ApiKeyCache {
    fn default() -> Self {
        Self::new()
    }
}
