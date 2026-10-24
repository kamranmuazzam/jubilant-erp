use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub is_fatal: bool,
}

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            is_fatal: false,
        }
    }

    pub fn db(err: impl fmt::Display) -> Self {
        Self::new("DB_ERROR", err.to_string())
    }

    pub fn auth(msg: impl Into<String>) -> Self {
        Self::new("AUTH_FAILED", msg)
    }

    pub fn validation(msg: impl Into<String>) -> Self {
        Self::new("VALIDATION_ERROR", msg)
    }

    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::new("NOT_FOUND", msg)
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for AppError {}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        Self::db(err)
    }
}

pub type AppResult<T> = Result<T, AppError>;
