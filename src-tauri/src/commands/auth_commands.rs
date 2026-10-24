use crate::error::{AppError, AppResult};
use crate::AppState;
use argon2::{
    password_hash::{PasswordHash, PasswordVerifier},
    Argon2,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserProfile {
    pub id: String,
    pub name: String,
    pub email: String,
    pub role_id: String,
    pub role_name: String,
    pub department: String,
    pub is_active: bool,
    pub last_login_at: Option<i64>,
    pub permissions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Role {
    pub id: String,
    pub name: String,
    pub department: String,
    pub description: Option<String>,
    pub permissions_json: String,
}

#[tauri::command]
pub async fn login_with_password(
    email: String,
    password: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<UserProfile> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;

    let row = conn.query_row(
        r#"SELECT u.id, u.name, u.email, u.password_hash, u.role_id, r.name, u.department, u.is_active, u.last_login_at, r.permissions_json
           FROM users u
           JOIN roles r ON u.role_id = r.id
           WHERE u.email = ?1 AND u.is_active = 1"#,
        params![email.trim()],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, Option<i64>>(8)?,
                row.get::<_, String>(9)?,
            ))
        },
    ).map_err(|_| AppError::auth("Invalid email or user is inactive"))?;

    let (id, name, email, pass_hash, role_id, role_name, dept, is_active, _last_login, perms_json) = row;

    let parsed_hash = PasswordHash::new(&pass_hash)
        .map_err(|e| AppError::auth(format!("Password hash format error: {}", e)))?;
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::auth("Incorrect password"))?;

    let perms: Vec<String> = serde_json::from_str(&perms_json).unwrap_or_else(|_| vec!["*".to_string()]);

    let now = chrono::Utc::now().timestamp();
    let _ = conn.execute(
        "UPDATE users SET last_login_at = ?1 WHERE id = ?2",
        params![now, id],
    );

    Ok(UserProfile {
        id,
        name,
        email,
        role_id,
        role_name,
        department: dept,
        is_active: is_active == 1,
        last_login_at: Some(now),
        permissions: perms,
    })
}

#[tauri::command]
pub async fn login_with_pin(
    pin: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<UserProfile> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;

    let mut stmt = conn.prepare(
        r#"SELECT u.id, u.name, u.email, u.pin_hash, u.role_id, r.name, u.department, u.is_active, u.last_login_at, r.permissions_json
           FROM users u
           JOIN roles r ON u.role_id = r.id
           WHERE u.pin_hash IS NOT NULL AND u.is_active = 1"#,
    )?;

    let users_iter = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, String>(6)?,
            row.get::<_, i64>(7)?,
            row.get::<_, Option<i64>>(8)?,
            row.get::<_, String>(9)?,
        ))
    })?;

    for user_res in users_iter {
        if let Ok((id, name, email, Some(pin_hash), role_id, role_name, dept, is_active, _last_login, perms_json)) = user_res {
            if let Ok(parsed_hash) = PasswordHash::new(&pin_hash) {
                if Argon2::default().verify_password(pin.as_bytes(), &parsed_hash).is_ok() {
                    let perms: Vec<String> = serde_json::from_str(&perms_json).unwrap_or_else(|_| vec!["*".to_string()]);
                    let now = chrono::Utc::now().timestamp();
                    let _ = conn.execute(
                        "UPDATE users SET last_login_at = ?1 WHERE id = ?2",
                        params![now, id],
                    );
                    return Ok(UserProfile {
                        id,
                        name,
                        email,
                        role_id,
                        role_name,
                        department: dept,
                        is_active: is_active == 1,
                        last_login_at: Some(now),
                        permissions: perms,
                    });
                }
            }
        }
    }

    Err(AppError::auth("Invalid PIN code"))
}

#[tauri::command]
pub async fn get_roles(state: tauri::State<'_, AppState>) -> AppResult<Vec<Role>> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let mut stmt = conn.prepare("SELECT id, name, department, description, permissions_json FROM roles ORDER BY name ASC")?;
    let roles = stmt.query_map([], |r| {
        Ok(Role {
            id: r.get(0)?,
            name: r.get(1)?,
            department: r.get(2)?,
            description: r.get(3)?,
            permissions_json: r.get(4)?,
        })
    })?.filter_map(Result::ok).collect();
    Ok(roles)
}

#[tauri::command]
pub async fn get_users(state: tauri::State<'_, AppState>) -> AppResult<Vec<UserProfile>> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let mut stmt = conn.prepare(
        r#"SELECT u.id, u.name, u.email, u.role_id, r.name, u.department, u.is_active, u.last_login_at, r.permissions_json
           FROM users u
           JOIN roles r ON u.role_id = r.id
           ORDER BY u.name ASC"#,
    )?;
    let users = stmt.query_map([], |r| {
        let is_active: i64 = r.get(6)?;
        let last_login: Option<i64> = r.get(7)?;
        let perms_json: String = r.get(8)?;
        let perms: Vec<String> = serde_json::from_str(&perms_json).unwrap_or_default();
        Ok(UserProfile {
            id: r.get(0)?,
            name: r.get(1)?,
            email: r.get(2)?,
            role_id: r.get(3)?,
            role_name: r.get(4)?,
            department: r.get(5)?,
            is_active: is_active == 1,
            last_login_at: last_login,
            permissions: perms,
        })
    })?.filter_map(Result::ok).collect();
    Ok(users)
}

#[tauri::command]
pub async fn create_user(
    name: String,
    email: String,
    password: String,
    pin: Option<String>,
    role_id: String,
    department: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<String> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let id = Uuid::now_v7().to_string();
    let pass_hash = crate::db::seed::hash_secret(&password);
    let pin_hash = pin.filter(|p| !p.trim().is_empty()).map(|p| crate::db::seed::hash_secret(&p));
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        r#"INSERT INTO users (id, name, email, password_hash, pin_hash, role_id, department, is_active, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8)"#,
        params![id, name.trim(), email.trim(), pass_hash, pin_hash, role_id, department, now],
    ).map_err(|e| AppError::db(format!("Failed to create user: {}", e)))?;

    Ok(id)
}

#[tauri::command]
pub async fn update_user(
    id: String,
    name: String,
    email: String,
    role_id: String,
    department: String,
    is_active: bool,
    state: tauri::State<'_, AppState>,
) -> AppResult<bool> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    conn.execute(
        "UPDATE users SET name = ?1, email = ?2, role_id = ?3, department = ?4, is_active = ?5 WHERE id = ?6",
        params![name.trim(), email.trim(), role_id, department, if is_active { 1 } else { 0 }, id],
    ).map_err(|e| AppError::db(format!("Failed to update user: {}", e)))?;
    Ok(true)
}

#[tauri::command]
pub async fn reset_user_password(
    id: String,
    new_password: Option<String>,
    new_pin: Option<String>,
    state: tauri::State<'_, AppState>,
) -> AppResult<bool> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    if let Some(pass) = new_password {
        if !pass.trim().is_empty() {
            let pass_hash = crate::db::seed::hash_secret(&pass);
            conn.execute("UPDATE users SET password_hash = ?1 WHERE id = ?2", params![pass_hash, id])
                .map_err(|e| AppError::db(format!("Failed to reset password: {}", e)))?;
        }
    }
    if let Some(pin) = new_pin {
        if !pin.trim().is_empty() {
            let pin_hash = crate::db::seed::hash_secret(&pin);
            conn.execute("UPDATE users SET pin_hash = ?1 WHERE id = ?2", params![pin_hash, id])
                .map_err(|e| AppError::db(format!("Failed to reset PIN: {}", e)))?;
        }
    }
    Ok(true)
}

#[tauri::command]
pub async fn toggle_user_status(
    id: String,
    is_active: bool,
    state: tauri::State<'_, AppState>,
) -> AppResult<bool> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    conn.execute(
        "UPDATE users SET is_active = ?1 WHERE id = ?2",
        params![if is_active { 1 } else { 0 }, id],
    ).map_err(|e| AppError::db(format!("Failed to toggle user status: {}", e)))?;
    Ok(true)
}
