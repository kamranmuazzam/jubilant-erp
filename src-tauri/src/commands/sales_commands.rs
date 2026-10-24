use crate::error::{AppError, AppResult};
use crate::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Customer {
    pub id: String,
    pub customer_type: String,
    pub company_name: String,
    pub contact_person: String,
    pub phone: String,
    pub email: Option<String>,
    pub pan_number: Option<String>,
    pub credit_limit_paisa: i64,
    pub address: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InvoiceItemInput {
    pub product_id: String,
    pub quantity: i64,
    pub unit_price_paisa: i64,
    pub is_exempt: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SalesBookRow {
    pub id: String,
    pub invoice_no: String,
    pub invoice_date: String,
    pub customer_name: String,
    pub pan_number: Option<String>,
    pub taxable_amount_paisa: i64,
    pub exempt_amount_paisa: i64,
    pub vat_13_paisa: i64,
    pub grand_total_paisa: i64,
    pub payment_status: String,
}

#[tauri::command]
pub async fn get_customers(state: tauri::State<'_, AppState>) -> AppResult<Vec<Customer>> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let mut stmt = conn.prepare(
        "SELECT id, customer_type, company_name, contact_person, phone, email, pan_number, credit_limit_paisa, address FROM customers ORDER BY company_name ASC"
    )?;
    let customers = stmt.query_map([], |r| {
        Ok(Customer {
            id: r.get(0)?,
            customer_type: r.get(1)?,
            company_name: r.get(2)?,
            contact_person: r.get(3)?,
            phone: r.get(4)?,
            email: r.get(5)?,
            pan_number: r.get(6)?,
            credit_limit_paisa: r.get(7)?,
            address: r.get(8)?,
        })
    })?.filter_map(Result::ok).collect();
    Ok(customers)
}

#[tauri::command]
pub async fn create_customer(
    customer_type: String,
    company_name: String,
    contact_person: String,
    phone: String,
    email: Option<String>,
    pan_number: Option<String>,
    credit_limit_paisa: i64,
    address: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<String> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        r#"INSERT INTO customers (id, customer_type, company_name, contact_person, phone, email, pan_number, credit_limit_paisa, address, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"#,
        params![id, customer_type, company_name, contact_person, phone, email, pan_number, credit_limit_paisa, address, now],
    )?;

    Ok(id)
}

#[tauri::command]
pub async fn get_sales_book(state: tauri::State<'_, AppState>) -> AppResult<Vec<SalesBookRow>> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let mut stmt = conn.prepare(
        r#"SELECT i.id, i.invoice_no, i.invoice_date, c.company_name, c.pan_number,
                  i.taxable_amount_paisa, i.exempt_amount_paisa, i.vat_13_paisa, i.grand_total_paisa, i.payment_status
           FROM invoices i
           JOIN customers c ON i.customer_id = c.id
           ORDER BY i.invoice_date DESC, i.created_at DESC"#,
    )?;

    let rows = stmt.query_map([], |r| {
        Ok(SalesBookRow {
            id: r.get(0)?,
            invoice_no: r.get(1)?,
            invoice_date: r.get(2)?,
            customer_name: r.get(3)?,
            pan_number: r.get(4)?,
            taxable_amount_paisa: r.get(5)?,
            exempt_amount_paisa: r.get(6)?,
            vat_13_paisa: r.get(7)?,
            grand_total_paisa: r.get(8)?,
            payment_status: r.get(9)?,
        })
    })?.filter_map(Result::ok).collect();

    Ok(rows)
}

#[tauri::command]
pub async fn create_tax_invoice(
    invoice_no: String,
    customer_id: String,
    invoice_date: String,
    items: Vec<InvoiceItemInput>,
    warehouse_id: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<String> {
    if items.is_empty() {
        return Err(AppError::validation("Invoice must contain at least one product"));
    }

    let mut taxable_paisa: i64 = 0;
    let mut exempt_paisa: i64 = 0;

    for it in &items {
        let line_gross = it.quantity * it.unit_price_paisa;
        if it.is_exempt {
            exempt_paisa += line_gross;
        } else {
            taxable_paisa += line_gross;
        }
    }

    // 13% Standard Nepal VAT (1300 basis points)
    let vat_13_paisa = (taxable_paisa * 13) / 100;
    let grand_total_paisa = taxable_paisa + exempt_paisa + vat_13_paisa;

    let mut conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let tx = conn.transaction()?;

    let invoice_id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().timestamp();

    tx.execute(
        r#"INSERT INTO invoices (id, invoice_no, customer_id, invoice_date, taxable_amount_paisa, exempt_amount_paisa, vat_13_paisa, grand_total_paisa, payment_status, ird_sync_status, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'Unpaid', 'Pending', ?9)"#,
        params![invoice_id, invoice_no, customer_id, invoice_date, taxable_paisa, exempt_paisa, vat_13_paisa, grand_total_paisa, now],
    )?;

    for it in items {
        let line_gross = it.quantity * it.unit_price_paisa;
        let line_vat = if it.is_exempt { 0 } else { (line_gross * 13) / 100 };
        let line_total = line_gross + line_vat;

        let item_id = Uuid::now_v7().to_string();
        tx.execute(
            r#"INSERT INTO invoice_items (id, invoice_id, product_id, quantity, unit_price_paisa, is_exempt, vat_paisa, line_total_paisa)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"#,
            params![item_id, invoice_id, it.product_id, it.quantity, it.unit_price_paisa, it.is_exempt as i64, line_vat, line_total],
        )?;

        // Deduct inventory stock from godown
        tx.execute(
            r#"UPDATE inventory_stock
               SET quantity_on_hand = quantity_on_hand - ?1
               WHERE product_id = ?2 AND warehouse_id = ?3"#,
            params![it.quantity, it.product_id, warehouse_id],
        )?;
    }

    // Post Double-Entry Journal Entry automatically:
    // Debit: Accounts Receivable (1030) = Grand Total
    // Credit: Sales Revenue (4010) = Taxable + Exempt
    // Credit: VAT Payable (2020) = VAT 13%
    let ar_account_id: String = tx.query_row("SELECT id FROM coa_accounts WHERE code = 1030", [], |r| r.get(0))?;
    let sales_account_id: String = tx.query_row("SELECT id FROM coa_accounts WHERE code = 4010", [], |r| r.get(0))?;
    let vat_account_id: String = tx.query_row("SELECT id FROM coa_accounts WHERE code = 2020", [], |r| r.get(0))?;
    let fy_id: String = tx.query_row("SELECT id FROM fiscal_years WHERE is_locked = 0 ORDER BY start_date DESC LIMIT 1", [], |r| r.get(0))?;

    let journal_id = Uuid::now_v7().to_string();
    let voucher_no = format!("JV-INV-{}", invoice_no);
    let narration = format!("Auto-posted Tax Invoice {}", invoice_no);

    tx.execute(
        r#"INSERT INTO journal_entries (id, voucher_no, entry_date, narration, fiscal_year_id, created_by, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, 'system', ?6)"#,
        params![journal_id, voucher_no, invoice_date, narration, fy_id, now],
    )?;

    // Debit AR
    tx.execute(
        "INSERT INTO journal_items (id, journal_id, account_id, debit_paisa, credit_paisa, memo) VALUES (?1, ?2, ?3, ?4, 0, 'Accounts Receivable')",
        params![Uuid::now_v7().to_string(), journal_id, ar_account_id, grand_total_paisa],
    )?;

    // Credit Sales Revenue
    let total_revenue = taxable_paisa + exempt_paisa;
    tx.execute(
        "INSERT INTO journal_items (id, journal_id, account_id, debit_paisa, credit_paisa, memo) VALUES (?1, ?2, ?3, 0, ?4, 'Sales Revenue')",
        params![Uuid::now_v7().to_string(), journal_id, sales_account_id, total_revenue],
    )?;

    // Credit VAT Payable (if any)
    if vat_13_paisa > 0 {
        tx.execute(
            "INSERT INTO journal_items (id, journal_id, account_id, debit_paisa, credit_paisa, memo) VALUES (?1, ?2, ?3, 0, ?4, 'Output VAT 13%')",
            params![Uuid::now_v7().to_string(), journal_id, vat_account_id, vat_13_paisa],
        )?;
    }

    // Capture CDC Outbox Event for background sync
    let outbox_id = Uuid::now_v7().to_string();
    tx.execute(
        "INSERT INTO outbox_events (id, entity_type, entity_id, op, payload_json, created_at, status) VALUES (?1, 'invoice', ?2, 'INSERT', ?3, ?4, 'PENDING')",
        params![outbox_id, invoice_id, format!(r#"{{"invoice_no":"{}","total":{}}}"#, invoice_no, grand_total_paisa), now],
    )?;

    tx.commit()?;
    Ok(invoice_id)
}
