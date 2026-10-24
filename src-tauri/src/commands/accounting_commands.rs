use crate::error::{AppError, AppResult};
use crate::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct CoaAccount {
    pub id: String,
    pub code: i64,
    pub name: String,
    pub account_type: String,
    pub current_balance_paisa: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JournalItemInput {
    pub account_id: String,
    pub debit_paisa: i64,
    pub credit_paisa: i64,
    pub memo: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JournalEntryView {
    pub id: String,
    pub voucher_no: String,
    pub entry_date: String,
    pub narration: String,
    pub total_debit_paisa: i64,
    pub total_credit_paisa: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CashBookRecord {
    pub id: String,
    pub date: String,
    pub opening_balance_paisa: i64,
    pub cash_in_paisa: i64,
    pub cash_out_paisa: i64,
    pub closing_balance_paisa: i64,
    pub notes: Option<String>,
    pub verified_by: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VatSummary {
    pub total_sales_taxable_paisa: i64,
    pub total_sales_exempt_paisa: i64,
    pub output_vat_13_paisa: i64,
    pub total_purchases_taxable_paisa: i64,
    pub total_purchases_exempt_paisa: i64,
    pub input_vat_13_paisa: i64,
    pub net_vat_payable_paisa: i64,
}

#[tauri::command]
pub async fn get_coa_accounts(state: tauri::State<'_, AppState>) -> AppResult<Vec<CoaAccount>> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let mut stmt = conn.prepare("SELECT id, code, name, account_type, current_balance_paisa FROM coa_accounts ORDER BY code ASC")?;
    let accounts = stmt.query_map([], |r| {
        Ok(CoaAccount {
            id: r.get(0)?,
            code: r.get(1)?,
            name: r.get(2)?,
            account_type: r.get(3)?,
            current_balance_paisa: r.get(4)?,
        })
    })?.filter_map(Result::ok).collect();
    Ok(accounts)
}

#[tauri::command]
pub async fn create_journal_entry(
    voucher_no: String,
    entry_date: String,
    narration: String,
    items: Vec<JournalItemInput>,
    created_by: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<String> {
    // 1. Strict Double-Entry Verification
    let total_debit: i64 = items.iter().map(|i| i.debit_paisa).sum();
    let total_credit: i64 = items.iter().map(|i| i.credit_paisa).sum();

    if total_debit != total_credit {
        return Err(AppError::validation(format!(
            "Double-Entry Invariant Violation: Debits (NPR {:.2}) != Credits (NPR {:.2})",
            total_debit as f64 / 100.0,
            total_credit as f64 / 100.0
        )));
    }

    if items.is_empty() {
        return Err(AppError::validation("Journal entry must contain at least 2 lines"));
    }

    let mut conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let tx = conn.transaction()?;

    // Fetch active fiscal year
    let fy_id: String = tx.query_row(
        "SELECT id FROM fiscal_years WHERE is_locked = 0 ORDER BY start_date DESC LIMIT 1",
        [],
        |r| r.get(0),
    ).map_err(|_| AppError::validation("No active unlocked fiscal year found"))?;

    let journal_id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().timestamp();

    tx.execute(
        r#"INSERT INTO journal_entries (id, voucher_no, entry_date, narration, fiscal_year_id, created_by, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"#,
        params![journal_id, voucher_no, entry_date, narration, fy_id, created_by, now],
    )?;

    for item in items {
        let item_id = Uuid::now_v7().to_string();
        tx.execute(
            r#"INSERT INTO journal_items (id, journal_id, account_id, debit_paisa, credit_paisa, memo)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6)"#,
            params![item_id, journal_id, item.account_id, item.debit_paisa, item.credit_paisa, item.memo],
        )?;

        // Update Account Balance (Assets/Expenses increase on Debit, Liabilities/Equity/Income increase on Credit)
        tx.execute(
            r#"UPDATE coa_accounts 
               SET current_balance_paisa = current_balance_paisa + (?1 - ?2)
               WHERE id = ?3"#,
            params![item.debit_paisa, item.credit_paisa, item.account_id],
        )?;
    }

    tx.commit()?;
    Ok(journal_id)
}

#[tauri::command]
pub async fn get_journal_entries(state: tauri::State<'_, AppState>) -> AppResult<Vec<JournalEntryView>> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let mut stmt = conn.prepare(
        r#"SELECT j.id, j.voucher_no, j.entry_date, j.narration,
                  COALESCE(SUM(i.debit_paisa), 0), COALESCE(SUM(i.credit_paisa), 0)
           FROM journal_entries j
           LEFT JOIN journal_items i ON j.id = i.journal_id
           GROUP BY j.id
           ORDER BY j.entry_date DESC, j.created_at DESC"#,
    )?;

    let entries = stmt.query_map([], |r| {
        Ok(JournalEntryView {
            id: r.get(0)?,
            voucher_no: r.get(1)?,
            entry_date: r.get(2)?,
            narration: r.get(3)?,
            total_debit_paisa: r.get(4)?,
            total_credit_paisa: r.get(5)?,
        })
    })?.filter_map(Result::ok).collect();

    Ok(entries)
}

#[tauri::command]
pub async fn get_cash_book(state: tauri::State<'_, AppState>) -> AppResult<Vec<CashBookRecord>> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let mut stmt = conn.prepare(
        "SELECT id, date, opening_balance_paisa, cash_in_paisa, cash_out_paisa, closing_balance_paisa, notes, verified_by FROM cash_book_entries ORDER BY date DESC"
    )?;
    let records = stmt.query_map([], |r| {
        Ok(CashBookRecord {
            id: r.get(0)?,
            date: r.get(1)?,
            opening_balance_paisa: r.get(2)?,
            cash_in_paisa: r.get(3)?,
            cash_out_paisa: r.get(4)?,
            closing_balance_paisa: r.get(5)?,
            notes: r.get(6)?,
            verified_by: r.get(7)?,
        })
    })?.filter_map(Result::ok).collect();
    Ok(records)
}

#[tauri::command]
pub async fn add_cash_book_entry(
    date: String,
    opening_balance_paisa: i64,
    cash_in_paisa: i64,
    cash_out_paisa: i64,
    notes: Option<String>,
    verified_by: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<String> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;
    let closing_balance_paisa = opening_balance_paisa + cash_in_paisa - cash_out_paisa;
    let id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        r#"INSERT INTO cash_book_entries (id, date, opening_balance_paisa, cash_in_paisa, cash_out_paisa, closing_balance_paisa, notes, verified_by, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"#,
        params![id, date, opening_balance_paisa, cash_in_paisa, cash_out_paisa, closing_balance_paisa, notes, verified_by, now],
    )?;

    Ok(id)
}

#[tauri::command]
pub async fn get_vat_report(state: tauri::State<'_, AppState>) -> AppResult<VatSummary> {
    let conn = state.db.conn.lock().map_err(|_| AppError::db("Mutex poisoned"))?;

    let (sales_taxable, sales_exempt, output_vat): (i64, i64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(taxable_amount_paisa), 0), COALESCE(SUM(exempt_amount_paisa), 0), COALESCE(SUM(vat_13_paisa), 0) FROM invoices",
        [],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    ).unwrap_or((0, 0, 0));

    let (purchases_taxable, purchases_exempt, input_vat): (i64, i64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(taxable_amount_paisa), 0), COALESCE(SUM(exempt_amount_paisa), 0), COALESCE(SUM(vat_13_paisa), 0) FROM purchase_bills",
        [],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    ).unwrap_or((0, 0, 0));

    let net_vat = output_vat - input_vat;

    Ok(VatSummary {
        total_sales_taxable_paisa: sales_taxable,
        total_sales_exempt_paisa: sales_exempt,
        output_vat_13_paisa: output_vat,
        total_purchases_taxable_paisa: purchases_taxable,
        total_purchases_exempt_paisa: purchases_exempt,
        input_vat_13_paisa: input_vat,
        net_vat_payable_paisa: net_vat,
    })
}
