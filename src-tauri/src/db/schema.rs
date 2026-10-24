pub const CREATE_TABLES_SQL: &str = r#"
-- 1. RBAC & User Management
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    description TEXT,
    permissions_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    pin_hash TEXT,
    role_id TEXT NOT NULL REFERENCES roles(id),
    department TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login_at INTEGER,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    changes_json TEXT,
    created_at INTEGER NOT NULL
);

-- 2. Double-Entry Accounting & Nepal Tax
CREATE TABLE IF NOT EXISTS coa_accounts (
    id TEXT PRIMARY KEY,
    code INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL, -- Asset, Liability, Equity, Income, Expense
    parent_id TEXT,
    opening_balance_paisa INTEGER NOT NULL DEFAULT 0,
    current_balance_paisa INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fiscal_years (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE, -- e.g. "2081/2082"
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    is_locked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    voucher_no TEXT NOT NULL UNIQUE,
    entry_date TEXT NOT NULL,
    narration TEXT NOT NULL,
    fiscal_year_id TEXT NOT NULL REFERENCES fiscal_years(id),
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_items (
    id TEXT PRIMARY KEY,
    journal_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES coa_accounts(id),
    debit_paisa INTEGER NOT NULL DEFAULT 0,
    credit_paisa INTEGER NOT NULL DEFAULT 0,
    memo TEXT
);

CREATE TABLE IF NOT EXISTS tax_rates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    rate_basis_points INTEGER NOT NULL -- 1300 = 13% VAT, 1000 = 10% TDS, 1500 = 15% TDS, 150 = 1.5% TDS
);

CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY,
    bank_name TEXT NOT NULL,
    account_no TEXT NOT NULL UNIQUE,
    branch TEXT NOT NULL,
    current_balance_paisa INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cash_book_entries (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    opening_balance_paisa INTEGER NOT NULL,
    cash_in_paisa INTEGER NOT NULL,
    cash_out_paisa INTEGER NOT NULL,
    closing_balance_paisa INTEGER NOT NULL,
    notes TEXT,
    verified_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- 3. Inventory & Warehouses (Multi-Godown)
CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    location TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    barcode TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    purchase_cost_paisa INTEGER NOT NULL,
    selling_price_paisa INTEGER NOT NULL,
    is_vat_exempt INTEGER NOT NULL DEFAULT 0,
    min_stock_alert INTEGER NOT NULL DEFAULT 5,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_stock (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    UNIQUE(product_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS stock_transfers (
    id TEXT PRIMARY KEY,
    transfer_no TEXT NOT NULL UNIQUE,
    from_warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
    to_warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
    transfer_date TEXT NOT NULL,
    status TEXT NOT NULL, -- Draft, Dispatched, Received
    notes TEXT,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id TEXT PRIMARY KEY,
    transfer_id TEXT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL
);

-- 4. Sales & Commercial Pipeline
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    customer_type TEXT NOT NULL, -- Dealer, Project, Retail
    company_name TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    pan_number TEXT,
    credit_limit_paisa INTEGER NOT NULL DEFAULT 0,
    address TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS quotations (
    id TEXT PRIMARY KEY,
    quotation_no TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    date TEXT NOT NULL,
    subtotal_paisa INTEGER NOT NULL,
    discount_paisa INTEGER NOT NULL DEFAULT 0,
    vat_paisa INTEGER NOT NULL DEFAULT 0,
    grand_total_paisa INTEGER NOT NULL,
    status TEXT NOT NULL, -- Draft, Sent, Won, Lost
    notes TEXT,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS quotation_items (
    id TEXT PRIMARY KEY,
    quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price_paisa INTEGER NOT NULL,
    discount_pct INTEGER NOT NULL DEFAULT 0,
    vat_paisa INTEGER NOT NULL DEFAULT 0,
    line_total_paisa INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_no TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    invoice_date TEXT NOT NULL,
    taxable_amount_paisa INTEGER NOT NULL,
    exempt_amount_paisa INTEGER NOT NULL DEFAULT 0,
    vat_13_paisa INTEGER NOT NULL,
    grand_total_paisa INTEGER NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'Unpaid', -- Unpaid, Partial, Paid
    ird_sync_status TEXT NOT NULL DEFAULT 'Pending',
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price_paisa INTEGER NOT NULL,
    is_exempt INTEGER NOT NULL DEFAULT 0,
    vat_paisa INTEGER NOT NULL,
    line_total_paisa INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_payments (
    id TEXT PRIMARY KEY,
    payment_no TEXT NOT NULL UNIQUE,
    invoice_id TEXT REFERENCES invoices(id),
    customer_id TEXT NOT NULL REFERENCES customers(id),
    amount_paisa INTEGER NOT NULL,
    payment_mode TEXT NOT NULL, -- Cash, Bank, Cheque
    bank_account_id TEXT REFERENCES bank_accounts(id),
    payment_date TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- 5. Purchases & Operating Expenses
CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pan_number TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT NOT NULL,
    contact_person TEXT,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_bills (
    id TEXT PRIMARY KEY,
    bill_no TEXT NOT NULL UNIQUE,
    vendor_id TEXT NOT NULL REFERENCES vendors(id),
    bill_date TEXT NOT NULL,
    warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
    taxable_amount_paisa INTEGER NOT NULL,
    exempt_amount_paisa INTEGER NOT NULL DEFAULT 0,
    vat_13_paisa INTEGER NOT NULL,
    grand_total_paisa INTEGER NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'Unpaid',
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_bill_items (
    id TEXT PRIMARY KEY,
    bill_id TEXT NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_cost_paisa INTEGER NOT NULL,
    is_exempt INTEGER NOT NULL DEFAULT 0,
    vat_paisa INTEGER NOT NULL,
    line_total_paisa INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS operating_expenses (
    id TEXT PRIMARY KEY,
    expense_no TEXT NOT NULL UNIQUE,
    expense_account_id TEXT NOT NULL REFERENCES coa_accounts(id),
    vendor_pan TEXT,
    title TEXT NOT NULL,
    taxable_paisa INTEGER NOT NULL,
    vat_paisa INTEGER NOT NULL DEFAULT 0,
    tds_rate_bps INTEGER NOT NULL DEFAULT 0,
    tds_paisa INTEGER NOT NULL DEFAULT 0,
    net_payable_paisa INTEGER NOT NULL,
    payment_mode TEXT NOT NULL, -- Cash, Bank
    date TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- 6. Technician & Field Service
CREATE TABLE IF NOT EXISTS service_requests (
    id TEXT PRIMARY KEY,
    ticket_no TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    product_name TEXT NOT NULL,
    product_serial TEXT,
    priority TEXT NOT NULL, -- Low, Medium, High, Critical
    issue_description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open', -- Open, Assigned, On-Site, In-Progress, QC, Closed
    technician_id TEXT REFERENCES users(id),
    scheduled_date TEXT,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS spare_part_requests (
    id TEXT PRIMARY KEY,
    service_request_id TEXT NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
    status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Approved, Rejected
    approved_by TEXT REFERENCES users(id),
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS service_reports (
    id TEXT PRIMARY KEY,
    service_request_id TEXT NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    diagnosis TEXT NOT NULL,
    work_performed TEXT NOT NULL,
    customer_signature_vector TEXT NOT NULL, -- Vector JSON points for zero-compression loss
    customer_feedback TEXT,
    nps_rating INTEGER NOT NULL, -- 1-10
    completed_at INTEGER NOT NULL
);

-- 7. HRM & Attendance
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    employee_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    citizenship_no TEXT,
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    basic_salary_paisa INTEGER NOT NULL,
    bank_account_no TEXT,
    joining_date TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    date TEXT NOT NULL,
    in_time TEXT,
    out_time TEXT,
    hours_worked REAL NOT NULL DEFAULT 0,
    is_late INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'Manual', -- Biometric, Manual
    created_at INTEGER NOT NULL,
    UNIQUE(employee_id, date)
);

-- 8. Resilient Outbox (Change Data Capture for Serverless Sync)
CREATE TABLE IF NOT EXISTS outbox_events (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    op TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER NOT NULL DEFAULT 0
);

-- 9. Audit Logging Trail
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details_json TEXT,
    created_at INTEGER NOT NULL
);

-- 10. Peer Network Registry
CREATE TABLE IF NOT EXISTS sync_peers (
    node_id TEXT PRIMARY KEY,
    device_name TEXT NOT NULL,
    address TEXT NOT NULL,
    is_lan INTEGER NOT NULL DEFAULT 1,
    last_seen INTEGER NOT NULL
);

-- High Performance Covering Indexes
CREATE INDEX IF NOT EXISTS idx_journal_items_acc ON journal_items(account_id, debit_paisa, credit_paisa);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date, customer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_wh ON inventory_stock(product_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_service_tickets ON service_requests(status, priority);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(status, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at);
"#;
