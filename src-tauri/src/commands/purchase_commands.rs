use crate::error::{AppError, AppResult};
use crate::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Vendor {
    pub id: String,
    pub name: String,
    pub pan_number: Option<String>,
    pub phone: String,
    pub email: Option<String>,
    pub address: String,
    pub contact_person: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillItemInput {
    pub product_id: String,
    pub quantity: i64,
    pub unit_cost_paisa: i64,
    pub is_exempt: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PurchaseBookRow {
    pub id: String,
    pub bill_no: String,
    pub bill_date: String,
    pub vendor_name: String,
    pub pan_number: Option<String>,
    pub taxable_amount_paisa: i64,
    pub exempt_amount_paisa: i64,
    pub vat_13_paisa: i64,
    pub grand_total_paisa: i64,
    pub payment_status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExpenseRecord {
    pub id: String,
    pub expense_no: String,
    pub title: String,
    pub account_name: String,
    pub taxable_paisa: i64,
    pub vat_paisa: i64,
    pub tds_paisa: i64,
    pub net_payable_paisa: i64,
    pub payment_mode: String,
    pub date: String,
}

#[tauri::command]
pub async fn get_vendors(state: tauri::State<'_, AppState>) -> AppResult<Vec<Vendor>> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let mut stmt = conn.prepare("SELECT id, name, pan_number, phone, email, address, contact_person FROM vendors ORDER BY name ASC")?;
    let vendors = stmt.query_map([], |r| {
        Ok(Vendor {
            id: r.get(0)?,
            name: r.get(1)?,
            pan_number: r.get(2)?,
            phone: r.get(3)?,
            email: r.get(4)?,
            address: r.get(5)?,
            contact_person: r.get(6)?,
        })
    })?.filter_map(Result::ok).collect();
    Ok(vendors)
}

#[tauri::command]
pub async fn create_vendor(
    name: String,
    pan_number: Option<String>,
    phone: String,
    email: Option<String>,
    address: String,
    contact_person: Option<String>,
    state: tauri::State<'_, AppState>,
) -> AppResult<String> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        r#"INSERT INTO vendors (id, name, pan_number, phone, email, address, contact_person, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"#,
        params![id, name, pan_number, phone, email, address, contact_person, now],
    )?;

    Ok(id)
}

#[tauri::command]
pub async fn get_purchase_book(state: tauri::State<'_, AppState>) -> AppResult<Vec<PurchaseBookRow>> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let mut stmt = conn.prepare(
        r#"SELECT b.id, b.bill_no, b.bill_date, v.name, v.pan_number,
                  b.taxable_amount_paisa, b.exempt_amount_paisa, b.vat_13_paisa, b.grand_total_paisa, b.payment_status
           FROM purchase_bills b
           JOIN vendors v ON b.vendor_id = v.id
           ORDER BY b.bill_date DESC, b.created_at DESC"#,
    )?;

    let rows = stmt.query_map([], |r| {
        Ok(PurchaseBookRow {
            id: r.get(0)?,
            bill_no: r.get(1)?,
            bill_date: r.get(2)?,
            vendor_name: r.get(3)?,
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
pub async fn create_purchase_bill(
    bill_no: String,
    vendor_id: String,
    bill_date: String,
    warehouse_id: String,
    items: Vec<BillItemInput>,
    state: tauri::State<'_, AppState>,
) -> AppResult<String> {
    if items.is_empty() {
        return Err(AppError::validation("Purchase bill must contain at least one item"));
    }

    let mut taxable_paisa: i64 = 0;
    let mut exempt_paisa: i64 = 0;

    for it in &items {
        let line_gross = it.quantity * it.unit_cost_paisa;
        if it.is_exempt {
            exempt_paisa += line_gross;
        } else {
            taxable_paisa += line_gross;
        }
    }

    let vat_13_paisa = (taxable_paisa * 13) / 100;
    let grand_total_paisa = taxable_paisa + exempt_paisa + vat_13_paisa;

    let mut conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let tx = conn.transaction()?;

    let bill_id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().timestamp();

    tx.execute(
        r#"INSERT INTO purchase_bills (id, bill_no, vendor_id, bill_date, warehouse_id, taxable_amount_paisa, exempt_amount_paisa, vat_13_paisa, grand_total_paisa, payment_status, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'Unpaid', ?10)"#,
        params![bill_id, bill_no, vendor_id, bill_date, warehouse_id, taxable_paisa, exempt_paisa, vat_13_paisa, grand_total_paisa, now],
    )?;

    for it in items {
        let line_gross = it.quantity * it.unit_cost_paisa;
        let line_vat = if it.is_exempt { 0 } else { (line_gross * 13) / 100 };
        let line_total = line_gross + line_vat;

        let item_id = Uuid::now_v7().to_string();
        tx.execute(
            r#"INSERT INTO purchase_bill_items (id, bill_id, product_id, quantity, unit_cost_paisa, is_exempt, vat_paisa, line_total_paisa)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"#,
            params![item_id, bill_id, it.product_id, it.quantity, it.unit_cost_paisa, it.is_exempt as i64, line_vat, line_total],
        )?;

        // Increase inventory stock in warehouse
        tx.execute(
            r#"INSERT INTO inventory_stock (id, product_id, warehouse_id, quantity_on_hand)
               VALUES (?1, ?2, ?3, ?4)
               ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity_on_hand = quantity_on_hand + ?4"#,
            params![Uuid::now_v7().to_string(), it.product_id, warehouse_id, it.quantity],
        )?;
    }

    // Auto-post Balanced Journal Entry:
    // Debit: Merchandise Inventory (1040) = Taxable + Exempt
    // Debit: Input VAT Receivable (offsetting 2020 or 1040)
    // Credit: Accounts Payable (2010) = Grand Total
    let inv_account_id: String = tx.query_row("SELECT id FROM coa_accounts WHERE code = 1040", [], |r| r.get(0))?;
    let vat_account_id: String = tx.query_row("SELECT id FROM coa_accounts WHERE code = 2020", [], |r| r.get(0))?;
    let ap_account_id: String = tx.query_row("SELECT id FROM coa_accounts WHERE code = 2010", [], |r| r.get(0))?;
    let fy_id: String = tx.query_row("SELECT id FROM fiscal_years WHERE is_locked = 0 ORDER BY start_date DESC LIMIT 1", [], |r| r.get(0))?;

    let journal_id = Uuid::now_v7().to_string();
    let voucher_no = format!("JV-BILL-{}", bill_no);
    let narration = format!("Auto-posted Purchase Bill {}", bill_no);

    tx.execute(
        r#"INSERT INTO journal_entries (id, voucher_no, entry_date, narration, fiscal_year_id, created_by, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, 'system', ?6)"#,
        params![journal_id, voucher_no, bill_date, narration, fy_id, now],
    )?;

    // Debit Inventory
    let total_goods = taxable_paisa + exempt_paisa;
    tx.execute(
        "INSERT INTO journal_items (id, journal_id, account_id, debit_paisa, credit_paisa, memo) VALUES (?1, ?2, ?3, ?4, 0, 'Inward Inventory')",
        params![Uuid::now_v7().to_string(), journal_id, inv_account_id, total_goods],
    )?;

    // Debit Input VAT
    if vat_13_paisa > 0 {
        tx.execute(
            "INSERT INTO journal_items (id, journal_id, account_id, debit_paisa, credit_paisa, memo) VALUES (?1, ?2, ?3, ?4, 0, 'Input VAT 13%')",
            params![Uuid::now_v7().to_string(), journal_id, vat_account_id, vat_13_paisa],
        )?;
    }

    // Credit Accounts Payable
    tx.execute(
        "INSERT INTO journal_items (id, journal_id, account_id, debit_paisa, credit_paisa, memo) VALUES (?1, ?2, ?3, 0, ?4, 'Accounts Payable')",
        params![Uuid::now_v7().to_string(), journal_id, ap_account_id, grand_total_paisa],
    )?;

    tx.commit()?;
    Ok(bill_id)
}

#[tauri::command]
pub async fn get_operating_expenses(state: tauri::State<'_, AppState>) -> AppResult<Vec<ExpenseRecord>> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let mut stmt = conn.prepare(
        r#"SELECT e.id, e.expense_no, e.title, a.name, e.taxable_paisa, e.vat_paisa, e.tds_paisa, e.net_payable_paisa, e.payment_mode, e.date
           FROM operating_expenses e
           JOIN coa_accounts a ON e.expense_account_id = a.id
           ORDER BY e.date DESC, e.created_at DESC"#,
    )?;

    let records = stmt.query_map([], |r| {
        Ok(ExpenseRecord {
            id: r.get(0)?,
            expense_no: r.get(1)?,
            title: r.get(2)?,
            account_name: r.get(3)?,
            taxable_paisa: r.get(4)?,
            vat_paisa: r.get(5)?,
            tds_paisa: r.get(6)?,
            net_payable_paisa: r.get(7)?,
            payment_mode: r.get(8)?,
            date: r.get(9)?,
        })
    })?.filter_map(Result::ok).collect();

    Ok(records)
}

#[tauri::command]
pub async fn create_operating_expense(
    expense_no: String,
    expense_account_id: String,
    title: String,
    vendor_pan: Option<String>,
    taxable_paisa: i64,
    has_vat: bool,
    tds_rate_bps: i64, // e.g. 1000 for 10% rent, 1500 for 15% consultant, 150 for 1.5% contract
    payment_mode: String,
    date: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<String> {
    let vat_paisa = if has_vat { (taxable_paisa * 13) / 100 } else { 0 };
    let tds_paisa = (taxable_paisa * tds_rate_bps) / 10000;
    let net_payable_paisa = taxable_paisa + vat_paisa - tds_paisa;

    let mut conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let tx = conn.transaction()?;

    let expense_id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().timestamp();

    tx.execute(
        r#"INSERT INTO operating_expenses (id, expense_no, expense_account_id, vendor_pan, title, taxable_paisa, vat_paisa, tds_rate_bps, tds_paisa, net_payable_paisa, payment_mode, date, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)"#,
        params![expense_id, expense_no, expense_account_id, vendor_pan, title, taxable_paisa, vat_paisa, tds_rate_bps, tds_paisa, net_payable_paisa, payment_mode, date, now],
    )?;

    // Auto-post balanced journal:
    // Debit: Expense Account (50xx) = Taxable
    // Debit: Input VAT (if any) = VAT
    // Credit: TDS Payable (2030) = TDS
    // Credit: Cash/Bank = Net Payable
    let vat_account_id: String = tx.query_row("SELECT id FROM coa_accounts WHERE code = 2020", [], |r| r.get(0))?;
    let tds_account_id: String = tx.query_row("SELECT id FROM coa_accounts WHERE code = 2030", [], |r| r.get(0))?;
    let payment_account_id: String = if payment_mode == "Cash" {
        tx.query_row("SELECT id FROM coa_accounts WHERE code = 1010", [], |r| r.get(0))?
    } else {
        tx.query_row("SELECT id FROM coa_accounts WHERE code = 1020", [], |r| r.get(0))?
    };
    let fy_id: String = tx.query_row("SELECT id FROM fiscal_years WHERE is_locked = 0 ORDER BY start_date DESC LIMIT 1", [], |r| r.get(0))?;

    let journal_id = Uuid::now_v7().to_string();
    let voucher_no = format!("JV-EXP-{}", expense_no);
    let narration = format!("Operating Expense: {}", title);

    tx.execute(
        r#"INSERT INTO journal_entries (id, voucher_no, entry_date, narration, fiscal_year_id, created_by, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, 'system', ?6)"#,
        params![journal_id, voucher_no, date, narration, fy_id, now],
    )?;

    // Debit Expense
    tx.execute(
        "INSERT INTO journal_items (id, journal_id, account_id, debit_paisa, credit_paisa, memo) VALUES (?1, ?2, ?3, ?4, 0, 'Expense')",
        params![Uuid::now_v7().to_string(), journal_id, expense_account_id, taxable_paisa],
    )?;

    // Debit VAT
    if vat_paisa > 0 {
        tx.execute(
            "INSERT INTO journal_items (id, journal_id, account_id, debit_paisa, credit_paisa, memo) VALUES (?1, ?2, ?3, ?4, 0, 'VAT Input')",
            params![Uuid::now_v7().to_string(), journal_id, vat_account_id, vat_paisa],
        )?;
    }

    // Credit TDS Payable
    if tds_paisa > 0 {
        tx.execute(
            "INSERT INTO journal_items (id, journal_id, account_id, debit_paisa, credit_paisa, memo) VALUES (?1, ?2, ?3, 0, ?4, 'TDS Withholding')",
            params![Uuid::now_v7().to_string(), journal_id, tds_account_id, tds_paisa],
        )?;
    }

    // Credit Cash / Bank
    tx.execute(
        "INSERT INTO journal_items (id, journal_id, account_id, debit_paisa, credit_paisa, memo) VALUES (?1, ?2, ?3, 0, ?4, 'Payment Outflow')",
        params![Uuid::now_v7().to_string(), journal_id, payment_account_id, net_payable_paisa],
    )?;

    tx.commit()?;
    Ok(expense_id)
}
