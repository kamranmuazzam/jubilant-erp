pub mod schema;
pub mod seed;

use crate::error::AppResult;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct DbState {
    pub conn: Arc<Mutex<Connection>>,
    pub db_path: PathBuf,
}

pub fn init_database(app_dir: PathBuf) -> AppResult<DbState> {
    std::fs::create_dir_all(&app_dir).map_err(|e| {
        crate::error::AppError::new("FS_ERROR", format!("Failed to create app data directory: {}", e))
    })?;

    let db_path = app_dir.join("jubilant_erp.db");
    let conn = Connection::open(&db_path)?;

    // Configure Enterprise High-Performance PRAGMAs
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;
        PRAGMA cache_size = -64000;
        PRAGMA temp_store = MEMORY;
        "#,
    )?;

    // Run Migrations & Seeding
    conn.execute_batch(schema::CREATE_TABLES_SQL)?;
    seed::seed_initial_data(&conn)?;

    Ok(DbState {
        conn: Arc::new(Mutex::new(conn)),
        db_path,
    })
}
