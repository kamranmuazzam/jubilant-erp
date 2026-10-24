use crate::error::{AppError, AppResult};
use crate::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct EmployeeView {
    pub id: String,
    pub employee_code: String,
    pub name: String,
    pub citizenship_no: Option<String>,
    pub department: String,
    pub designation: String,
    pub basic_salary_paisa: i64,
    pub bank_account_no: Option<String>,
    pub joining_date: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AttendanceView {
    pub id: String,
    pub employee_id: String,
    pub employee_name: String,
    pub date: String,
    pub in_time: Option<String>,
    pub out_time: Option<String>,
    pub hours_worked: f64,
    pub is_late: bool,
    pub source: String,
}

#[tauri::command]
pub async fn get_employees(state: tauri::State<'_, AppState>) -> AppResult<Vec<EmployeeView>> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let mut stmt = conn.prepare(
        "SELECT id, employee_code, name, citizenship_no, department, designation, basic_salary_paisa, bank_account_no, joining_date FROM employees ORDER BY name ASC"
    )?;
    let employees = stmt.query_map([], |r| {
        Ok(EmployeeView {
            id: r.get(0)?,
            employee_code: r.get(1)?,
            name: r.get(2)?,
            citizenship_no: r.get(3)?,
            department: r.get(4)?,
            designation: r.get(5)?,
            basic_salary_paisa: r.get(6)?,
            bank_account_no: r.get(7)?,
            joining_date: r.get(8)?,
        })
    })?.filter_map(Result::ok).collect();
    Ok(employees)
}

#[tauri::command]
pub async fn create_employee(
    employee_code: String,
    name: String,
    citizenship_no: Option<String>,
    department: String,
    designation: String,
    basic_salary_paisa: i64,
    bank_account_no: Option<String>,
    joining_date: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<String> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        r#"INSERT INTO employees (id, employee_code, name, citizenship_no, department, designation, basic_salary_paisa, bank_account_no, joining_date, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"#,
        params![id, employee_code, name, citizenship_no, department, designation, basic_salary_paisa, bank_account_no, joining_date, now],
    )?;

    Ok(id)
}

#[tauri::command]
pub async fn mark_attendance(
    employee_id: String,
    date: String,
    in_time: Option<String>,
    out_time: Option<String>,
    hours_worked: f64,
    is_late: bool,
    source: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<String> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        r#"INSERT INTO attendance_records (id, employee_id, date, in_time, out_time, hours_worked, is_late, source, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
           ON CONFLICT(employee_id, date) DO UPDATE SET in_time = ?4, out_time = ?5, hours_worked = ?6, is_late = ?7, source = ?8"#,
        params![id, employee_id, date, in_time, out_time, hours_worked, is_late as i64, source, now],
    )?;

    Ok(id)
}

#[tauri::command]
pub async fn get_attendance_records(state: tauri::State<'_, AppState>) -> AppResult<Vec<AttendanceView>> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let mut stmt = conn.prepare(
        r#"SELECT a.id, a.employee_id, e.name, a.date, a.in_time, a.out_time, a.hours_worked, a.is_late, a.source
           FROM attendance_records a
           JOIN employees e ON a.employee_id = e.id
           ORDER BY a.date DESC, e.name ASC"#,
    )?;

    let records = stmt.query_map([], |r| {
        Ok(AttendanceView {
            id: r.get(0)?,
            employee_id: r.get(1)?,
            employee_name: r.get(2)?,
            date: r.get(3)?,
            in_time: r.get(4)?,
            out_time: r.get(5)?,
            hours_worked: r.get(6)?,
            is_late: r.get::<_, i64>(7)? == 1,
            source: r.get(8)?,
        })
    })?.filter_map(Result::ok).collect();

    Ok(records)
}
