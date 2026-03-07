use anyhow::{Context, Result};
use diesel::PgConnection;
use diesel::r2d2::{ConnectionManager, Pool, PooledConnection};

use crate::error::AppError;

/// Type alias for the database connection pool.
pub type DbPool = Pool<ConnectionManager<PgConnection>>;

/// Type alias for a pooled database connection.
pub type DbConn = PooledConnection<ConnectionManager<PgConnection>>;

/// Creates an r2d2 connection pool with a maximum of 10 connections.
pub fn create_pool(database_url: &str) -> Result<DbPool> {
    create_pool_with_size(database_url, 10)
}

/// Creates an r2d2 connection pool with a configurable maximum size.
pub fn create_pool_with_size(database_url: &str, max_size: u32) -> Result<DbPool> {
    let manager = ConnectionManager::<PgConnection>::new(database_url);
    Pool::builder()
        .max_size(max_size)
        .build(manager)
        .context("Failed to create database connection pool")
}

/// Retrieves a connection from the pool.
pub fn get_conn(pool: &DbPool) -> Result<DbConn> {
    pool.get()
        .context("Failed to get database connection from pool")
}

/// Runs a closure with a pooled connection, mapping pool errors to `diesel::result::Error`.
pub fn with_conn<T, F>(pool: &DbPool, f: F) -> Result<T, diesel::result::Error>
where
    F: FnOnce(&mut PgConnection) -> Result<T, diesel::result::Error>,
{
    let mut conn = pool.get().map_err(|e| {
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::Unknown,
            Box::new(e.to_string()),
        )
    })?;
    f(&mut conn)
}

/// Runs a closure with a pooled connection, mapping pool errors to `AppError`.
pub fn with_conn_app<T, F>(pool: &DbPool, f: F) -> Result<T, AppError>
where
    F: FnOnce(&mut PgConnection) -> Result<T, AppError>,
{
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    f(&mut conn)
}
