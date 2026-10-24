use crate::error::{AppError, AppResult};
use crate::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductView {
    pub id: String,
    pub sku: String,
    pub barcode: Option<String>,
    pub name: String,
    pub category: String,
    pub unit: String,
    pub purchase_cost_paisa: i64,
    pub selling_price_paisa: i64,
    pub is_vat_exempt: bool,
    pub min_stock_alert: i64,
    pub total_stock: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WarehouseView {
    pub id: String,
    pub name: String,
    pub location: String,
    pub is_primary: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WarehouseStock {
    pub product_id: String,
    pub product_name: String,
    pub sku: String,
    pub warehouse_id: String,
    pub warehouse_name: String,
    pub quantity: i64,
}

#[tauri::command]
pub async fn get_products(state: tauri::State<'_, AppState>) -> AppResult<Vec<ProductView>> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let mut stmt = conn.prepare(
        r#"SELECT p.id, p.sku, p.barcode, p.name, p.category, p.unit, p.purchase_cost_paisa, p.selling_price_paisa,
                  p.is_vat_exempt, p.min_stock_alert, COALESCE(SUM(s.quantity_on_hand), 0)
           FROM products p
           LEFT JOIN inventory_stock s ON p.id = s.product_id
           GROUP BY p.id
           ORDER BY p.name ASC"#,
    )?;

    let products = stmt.query_map([], |r| {
        Ok(ProductView {
            id: r.get(0)?,
            sku: r.get(1)?,
            barcode: r.get(2)?,
            name: r.get(3)?,
            category: r.get(4)?,
            unit: r.get(5)?,
            purchase_cost_paisa: r.get(6)?,
            selling_price_paisa: r.get(7)?,
            is_vat_exempt: r.get::<_, i64>(8)? == 1,
            min_stock_alert: r.get(9)?,
            total_stock: r.get(10)?,
        })
    })?.filter_map(Result::ok).collect();

    Ok(products)
}

#[tauri::command]
pub async fn create_product(
    sku: String,
    barcode: Option<String>,
    name: String,
    category: String,
    unit: String,
    purchase_cost_paisa: i64,
    selling_price_paisa: i64,
    is_vat_exempt: bool,
    min_stock_alert: i64,
    state: tauri::State<'_, AppState>,
) -> AppResult<String> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        r#"INSERT INTO products (id, sku, barcode, name, category, unit, purchase_cost_paisa, selling_price_paisa, is_vat_exempt, min_stock_alert, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)"#,
        params![id, sku, barcode, name, category, unit, purchase_cost_paisa, selling_price_paisa, is_vat_exempt as i64, min_stock_alert, now],
    )?;

    Ok(id)
}

#[tauri::command]
pub async fn get_warehouses(state: tauri::State<'_, AppState>) -> AppResult<Vec<WarehouseView>> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let mut stmt = conn.prepare("SELECT id, name, location, is_primary FROM warehouses ORDER BY is_primary DESC, name ASC")?;
    let warehouses = stmt.query_map([], |r| {
        Ok(WarehouseView {
            id: r.get(0)?,
            name: r.get(1)?,
            location: r.get(2)?,
            is_primary: r.get::<_, i64>(3)? == 1,
        })
    })?.filter_map(Result::ok).collect();
    Ok(warehouses)
}

#[tauri::command]
pub async fn create_warehouse(
    name: String,
    location: String,
    is_primary: bool,
    state: tauri::State<'_, AppState>,
) -> AppResult<String> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let id = Uuid::now_v7().to_string();

    conn.execute(
        "INSERT INTO warehouses (id, name, location, is_primary) VALUES (?1, ?2, ?3, ?4)",
        params![id, name, location, is_primary as i64],
    )?;

    Ok(id)
}

#[tauri::command]
pub async fn get_stock_levels(state: tauri::State<'_, AppState>) -> AppResult<Vec<WarehouseStock>> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let mut stmt = conn.prepare(
        r#"SELECT p.id, p.name, p.sku, w.id, w.name, s.quantity_on_hand
           FROM inventory_stock s
           JOIN products p ON s.product_id = p.id
           JOIN warehouses w ON s.warehouse_id = w.id
           ORDER BY w.name ASC, p.name ASC"#,
    )?;

    let stock = stmt.query_map([], |r| {
        Ok(WarehouseStock {
            product_id: r.get(0)?,
            product_name: r.get(1)?,
            sku: r.get(2)?,
            warehouse_id: r.get(3)?,
            warehouse_name: r.get(4)?,
            quantity: r.get(5)?,
        })
    })?.filter_map(Result::ok).collect();

    Ok(stock)
}

#[tauri::command]
pub async fn create_stock_transfer(
    transfer_no: String,
    from_warehouse_id: String,
    to_warehouse_id: String,
    transfer_date: String,
    product_id: String,
    quantity: i64,
    notes: Option<String>,
    state: tauri::State<'_, AppState>,
) -> AppResult<String> {
    if from_warehouse_id == to_warehouse_id {
        return Err(AppError::validation("Source and destination godowns cannot be identical"));
    }

    let mut conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let tx = conn.transaction()?;

    let current_stock: i64 = tx.query_row(
        "SELECT quantity_on_hand FROM inventory_stock WHERE product_id = ?1 AND warehouse_id = ?2",
        params![product_id, from_warehouse_id],
        |r| r.get(0),
    ).unwrap_or(0);

    if current_stock < quantity {
        return Err(AppError::validation(format!(
            "Insufficient inventory in source warehouse. Available: {}, Requested: {}",
            current_stock, quantity
        )));
    }

    let transfer_id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().timestamp();

    tx.execute(
        r#"INSERT INTO stock_transfers (id, transfer_no, from_warehouse_id, to_warehouse_id, transfer_date, status, notes, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, 'Transferred', ?6, ?7)"#,
        params![transfer_id, transfer_no, from_warehouse_id, to_warehouse_id, transfer_date, notes, now],
    )?;

    tx.execute(
        "INSERT INTO stock_transfer_items (id, transfer_id, product_id, quantity) VALUES (?1, ?2, ?3, ?4)",
        params![Uuid::now_v7().to_string(), transfer_id, product_id, quantity],
    )?;

    // Deduct from Source
    tx.execute(
        "UPDATE inventory_stock SET quantity_on_hand = quantity_on_hand - ?1 WHERE product_id = ?2 AND warehouse_id = ?3",
        params![quantity, product_id, from_warehouse_id],
    )?;

    // Add to Destination
    tx.execute(
        r#"INSERT INTO inventory_stock (id, product_id, warehouse_id, quantity_on_hand)
           VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity_on_hand = quantity_on_hand + ?4"#,
        params![Uuid::now_v7().to_string(), product_id, to_warehouse_id, quantity],
    )?;

    tx.commit()?;
    Ok(transfer_id)
}
