use anyhow::{Context, Result};
use diesel::PgConnection;
use diesel::r2d2::{ConnectionManager, Pool, PooledConnection};

/// Type alias for the database connection pool.
pub type DbPool = Pool<ConnectionManager<PgConnection>>;

/// Type alias for a pooled database connection.
pub type DbConn = PooledConnection<ConnectionManager<PgConnection>>;

/// Creates an r2d2 connection pool with a maximum of 10 connections.
pub fn create_pool(database_url: &str) -> Result<DbPool> {
    let manager = ConnectionManager::<PgConnection>::new(database_url);
    Pool::builder()
        .max_size(10)
        .build(manager)
        .context("Failed to create database connection pool")
}

/// Retrieves a connection from the pool.
pub fn get_conn(pool: &DbPool) -> Result<DbConn> {
    pool.get()
        .context("Failed to get database connection from pool")
}
