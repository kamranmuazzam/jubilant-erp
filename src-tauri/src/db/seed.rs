use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use rusqlite::{params, Connection};
use uuid::Uuid;

pub fn hash_secret(secret: &str) -> String {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(secret.as_bytes(), &salt)
        .map(|h| h.to_string())
        .unwrap_or_default()
}

pub fn seed_initial_data(conn: &Connection) -> Result<(), rusqlite::Error> {
    // 1. Check if roles already exist
    let role_count: i64 = conn.query_row("SELECT COUNT(*) FROM roles", [], |r| r.get(0))?;
    if role_count == 0 {
        let roles = vec![
            (
                "role-admin",
                "Admin",
                "Executive",
                "Full system access and configurations",
                r#"["*"]"#,
            ),
            (
                "role-accountant",
                "Accountant",
                "Accounts & Finance",
                "Nepal tax, VAT returns, ledger postings, bills and invoices",
                r#"["accounting.*", "sales.read", "sales.invoice", "purchases.*", "reports.*"]"#,
            ),
            (
                "role-operation",
                "Operation",
                "Operation",
                "Quotations, leads, client onboarding, delivery challans",
                r#"["sales.*", "customers.*", "inventory.read"]"#,
            ),
            (
                "role-warehouse",
                "Warehouse_Officer",
                "Warehouse & Inventory",
                "Godown inward/outward, delivery challan dispatch, stock audits",
                r#"["inventory.*", "warehouses.*", "damage_reports.*"]"#,
            ),
            (
                "role-hr",
                "HR_Manager",
                "HR",
                "Employee onboarding, attendance, payroll, appraisals",
                r#"["hrm.*", "employees.*", "payroll.*"]"#,
            ),
            (
                "role-technician",
                "Technician",
                "Technician",
                "On-site diagnostic checklists, spare part requisitions, sign-offs",
                r#"["service.*", "spare_parts.request"]"#,
            ),
            (
                "role-employee",
                "Employee",
                "General",
                "Self attendance check-in, task submission, personal payslip",
                r#"["self.*", "tasks.*"]"#,
            ),
            (
                "role-client",
                "Client",
                "External",
                "Client portal for quotations, invoices, service tickets",
                r#"["client_portal.*"]"#,
            ),
        ];

        for (id, name, dept, desc, perms) in roles {
            conn.execute(
                "INSERT INTO roles (id, name, department, description, permissions_json) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, name, dept, desc, perms],
            )?;
        }
    }

    // 2. Check if default SuperAdmin exists
    let user_count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |r| r.get(0))?;
    if user_count == 0 {
        let admin_id = Uuid::now_v7().to_string();
        let pass_hash = hash_secret("admin123");
        let pin_hash = hash_secret("1234");
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            r#"INSERT INTO users (
                id, name, email, password_hash, pin_hash, role_id, department, is_active, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8)"#,
            params![
                admin_id,
                "Super Administrator",
                "admin@jubilant.com",
                pass_hash,
                pin_hash,
                "role-admin",
                "Executive",
                now
            ],
        )?;
    }

    // 3. Seed Fiscal Year
    let fy_count: i64 = conn.query_row("SELECT COUNT(*) FROM fiscal_years", [], |r| r.get(0))?;
    if fy_count == 0 {
        let fy_id = Uuid::now_v7().to_string();
        conn.execute(
            "INSERT INTO fiscal_years (id, name, start_date, end_date, is_locked) VALUES (?1, ?2, ?3, ?4, 0)",
            params![fy_id, "2081/2082", "2024-07-16", "2025-07-15"],
        )?;
    }

    // 4. Seed Chart of Accounts (COA)
    let coa_count: i64 = conn.query_row("SELECT COUNT(*) FROM coa_accounts", [], |r| r.get(0))?;
    if coa_count == 0 {
        let accounts = vec![
            (1010, "Cash in Hand", "Asset"),
            (1020, "Bank Accounts", "Asset"),
            (1030, "Accounts Receivable", "Asset"),
            (1040, "Merchandise Inventory", "Asset"),
            (2010, "Accounts Payable", "Liability"),
            (2020, "VAT Payable (13%)", "Liability"),
            (2030, "TDS Payable", "Liability"),
            (3010, "Share Capital", "Equity"),
            (3020, "Retained Earnings", "Equity"),
            (4010, "Sales Revenue", "Income"),
            (4020, "Service Revenue", "Income"),
            (5010, "Cost of Goods Sold (COGS)", "Expense"),
            (5020, "Salaries & Wages", "Expense"),
            (5030, "Office Rent", "Expense"),
            (5040, "Utilities & Communication", "Expense"),
        ];

        for (code, name, acc_type) in accounts {
            let acc_id = Uuid::now_v7().to_string();
            conn.execute(
                "INSERT INTO coa_accounts (id, code, name, account_type, opening_balance_paisa, current_balance_paisa) VALUES (?1, ?2, ?3, ?4, 0, 0)",
                params![acc_id, code, name, acc_type],
            )?;
        }
    }

    // 5. Seed Tax Rates
    let tax_count: i64 = conn.query_row("SELECT COUNT(*) FROM tax_rates", [], |r| r.get(0))?;
    if tax_count == 0 {
        let rates = vec![
            ("Standard 13% VAT", 1300),
            ("Office Rent TDS (10%)", 1000),
            ("Consultant Fee TDS (15%)", 1500),
            ("Contract Works TDS (1.5%)", 150),
        ];

        for (name, rate_bps) in rates {
            let id = Uuid::now_v7().to_string();
            conn.execute(
                "INSERT INTO tax_rates (id, name, rate_basis_points) VALUES (?1, ?2, ?3)",
                params![id, name, rate_bps],
            )?;
        }
    }

    // 6. Seed Primary Warehouse & Bank
    let wh_count: i64 = conn.query_row("SELECT COUNT(*) FROM warehouses", [], |r| r.get(0))?;
    if wh_count == 0 {
        let wh_id = Uuid::now_v7().to_string();
        conn.execute(
            "INSERT INTO warehouses (id, name, location, is_primary) VALUES (?1, ?2, ?3, 1)",
            params![wh_id, "Central Godown (Kathmandu)", "Teku, Kathmandu"],
        )?;
    }

    let bank_count: i64 = conn.query_row("SELECT COUNT(*) FROM bank_accounts", [], |r| r.get(0))?;
    if bank_count == 0 {
        let bank_id = Uuid::now_v7().to_string();
        conn.execute(
            "INSERT INTO bank_accounts (id, bank_name, account_no, branch, current_balance_paisa) VALUES (?1, ?2, ?3, ?4, 50000000)", // Opening 500,000 NPR in Paisa
            params![bank_id, "Nabil Bank Limited", "0120017500123", "Maitighar Branch"],
        )?;
    }

    Ok(())
}
