use crate::error::{AppError, AppResult};
use crate::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceRequestView {
    pub id: String,
    pub ticket_no: String,
    pub customer_id: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub product_name: String,
    pub product_serial: Option<String>,
    pub priority: String,
    pub issue_description: String,
    pub status: String,
    pub technician_name: Option<String>,
    pub scheduled_date: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SparePartView {
    pub id: String,
    pub service_request_id: String,
    pub product_id: String,
    pub product_name: String,
    pub sku: String,
    pub quantity: i64,
    pub warehouse_name: String,
    pub status: String,
}

#[tauri::command]
pub async fn get_service_requests(state: tauri::State<'_, AppState>) -> AppResult<Vec<ServiceRequestView>> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let mut stmt = conn.prepare(
        r#"SELECT s.id, s.ticket_no, s.customer_id, c.company_name, c.phone, s.product_name, s.product_serial,
                  s.priority, s.issue_description, s.status, u.name, s.scheduled_date, s.created_at
           FROM service_requests s
           JOIN customers c ON s.customer_id = c.id
           LEFT JOIN users u ON s.technician_id = u.id
           ORDER BY s.created_at DESC"#,
    )?;

    let requests = stmt.query_map([], |r| {
        Ok(ServiceRequestView {
            id: r.get(0)?,
            ticket_no: r.get(1)?,
            customer_id: r.get(2)?,
            customer_name: r.get(3)?,
            customer_phone: r.get(4)?,
            product_name: r.get(5)?,
            product_serial: r.get(6)?,
            priority: r.get(7)?,
            issue_description: r.get(8)?,
            status: r.get(9)?,
            technician_name: r.get(10)?,
            scheduled_date: r.get(11)?,
            created_at: r.get(12)?,
        })
    })?.filter_map(Result::ok).collect();

    Ok(requests)
}

#[tauri::command]
pub async fn create_service_request(
    ticket_no: String,
    customer_id: String,
    product_name: String,
    product_serial: Option<String>,
    priority: String,
    issue_description: String,
    technician_id: Option<String>,
    scheduled_date: Option<String>,
    state: tauri::State<'_, AppState>,
) -> AppResult<String> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().timestamp();
    let initial_status = if technician_id.is_some() { "Assigned" } else { "Open" };

    conn.execute(
        r#"INSERT INTO service_requests (id, ticket_no, customer_id, product_name, product_serial, priority, issue_description, status, technician_id, scheduled_date, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)"#,
        params![id, ticket_no, customer_id, product_name, product_serial, priority, issue_description, initial_status, technician_id, scheduled_date, now],
    )?;

    Ok(id)
}

#[tauri::command]
pub async fn update_service_status(
    ticket_id: String,
    new_status: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<bool> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    conn.execute(
        "UPDATE service_requests SET status = ?1 WHERE id = ?2",
        params![new_status, ticket_id],
    )?;
    Ok(true)
}

#[tauri::command]
pub async fn submit_spare_part_request(
    service_request_id: String,
    product_id: String,
    quantity: i64,
    warehouse_id: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<String> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        r#"INSERT INTO spare_part_requests (id, service_request_id, product_id, quantity, warehouse_id, status, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, 'Pending', ?6)"#,
        params![id, service_request_id, product_id, quantity, warehouse_id, now],
    )?;

    Ok(id)
}

#[tauri::command]
pub async fn approve_spare_part_request(
    request_id: String,
    approved_by: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<bool> {
    let mut conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let tx = conn.transaction()?;

    let (product_id, warehouse_id, quantity): (String, String, i64) = tx.query_row(
        "SELECT product_id, warehouse_id, quantity FROM spare_part_requests WHERE id = ?1",
        params![request_id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    )?;

    let current_stock: i64 = tx.query_row(
        "SELECT quantity_on_hand FROM inventory_stock WHERE product_id = ?1 AND warehouse_id = ?2",
        params![product_id, warehouse_id],
        |r| r.get(0),
    ).unwrap_or(0);

    if current_stock < quantity {
        return Err(AppError::validation(format!(
            "Cannot approve: Insufficient stock in godown. Available: {}, Needed: {}",
            current_stock, quantity
        )));
    }

    // Deduct stock from godown
    tx.execute(
        "UPDATE inventory_stock SET quantity_on_hand = quantity_on_hand - ?1 WHERE product_id = ?2 AND warehouse_id = ?3",
        params![quantity, product_id, warehouse_id],
    )?;

    tx.execute(
        "UPDATE spare_part_requests SET status = 'Approved', approved_by = ?1 WHERE id = ?2",
        params![approved_by, request_id],
    )?;

    tx.commit()?;
    Ok(true)
}

#[tauri::command]
pub async fn submit_service_report(
    service_request_id: String,
    diagnosis: String,
    work_performed: String,
    customer_signature_vector: String, // Vector coordinates for zero-loss compressed signature
    customer_feedback: Option<String>,
    nps_rating: i64,
    state: tauri::State<'_, AppState>,
) -> AppResult<String> {
    let mut conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let tx = conn.transaction()?;

    let report_id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().timestamp();

    tx.execute(
        r#"INSERT INTO service_reports (id, service_request_id, diagnosis, work_performed, customer_signature_vector, customer_feedback, nps_rating, completed_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"#,
        params![report_id, service_request_id, diagnosis, work_performed, customer_signature_vector, customer_feedback, nps_rating, now],
    )?;

    // Transition ticket status to Closed
    tx.execute(
        "UPDATE service_requests SET status = 'Closed' WHERE id = ?1",
        params![service_request_id],
    )?;

    tx.commit()?;
    Ok(report_id)
}
