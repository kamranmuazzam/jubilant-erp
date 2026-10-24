use jubilant_erp_lib::commands::*;
use jubilant_erp_lib::db::init_database;
use jubilant_erp_lib::AppState;
use tauri::Manager;
use uuid::Uuid;

fn setup_test_app() -> tauri::App<tauri::test::MockRuntime> {
    let temp_dir = std::env::temp_dir().join(format!("test_erp_{}", Uuid::now_v7()));
    let db_state = init_database(temp_dir).expect("Failed to initialize database");
    let sync_manager = std::sync::Arc::new(jubilant_erp_lib::sync::SyncManager::new(db_state.clone(), None));
    let app_state = AppState { db: db_state, sync: sync_manager };

    let app = tauri::test::mock_app();
    app.manage(app_state);
    app
}

#[tokio::test]
async fn test_auth_and_user_management_lifecycle() {
    let app = setup_test_app();
    let state = || app.state::<AppState>();

    // 1. Check Roles seeded
    let roles = auth_commands::get_roles(state()).await.expect("Failed to get roles");
    assert_eq!(roles.len(), 8, "Expected 8 standard Spatie RBAC roles");
    let admin_role = roles.iter().find(|r| r.id == "role-admin" || r.name == "Admin").expect("Admin role missing");

    // 2. Create User
    let new_user_id = auth_commands::create_user(
        "Kiran Pokharel".to_string(),
        "kiran@jubilant.com.np".to_string(),
        "TestPass@2026".to_string(),
        Some("5566".to_string()),
        admin_role.id.clone(),
        "Finance & Accounts".to_string(),
        state(),
    )
    .await
    .expect("User creation failed");
    assert!(!new_user_id.is_empty());

    // 3. Verify user in get_users
    let users = auth_commands::get_users(state()).await.expect("Failed to get users");
    let user = users.iter().find(|u| u.id == new_user_id).expect("Created user not found in user list");
    assert_eq!(user.name, "Kiran Pokharel");
    assert_eq!(user.email, "kiran@jubilant.com.np");
    assert!(user.is_active);

    // 4. Test Login with Password
    let profile = auth_commands::login_with_password(
        "kiran@jubilant.com.np".to_string(),
        "TestPass@2026".to_string(),
        state(),
    )
    .await
    .expect("Password login failed");
    assert_eq!(profile.id, new_user_id);
    assert_eq!(profile.role_name, "Admin");

    // 5. Test Login with invalid password fails
    let fail_res = auth_commands::login_with_password(
        "kiran@jubilant.com.np".to_string(),
        "WrongPass".to_string(),
        state(),
    )
    .await;
    assert!(fail_res.is_err(), "Login with wrong password must fail");

    // 6. Test Login with PIN
    let pin_profile = auth_commands::login_with_pin("5566".to_string(), state())
        .await
        .expect("PIN login failed");
    assert_eq!(pin_profile.id, new_user_id);

    // 7. Test Update User
    let update_res = auth_commands::update_user(
        new_user_id.clone(),
        "Kiran P. Sharma".to_string(),
        "kiran.sharma@jubilant.com.np".to_string(),
        admin_role.id.clone(),
        "Executive Board".to_string(),
        true,
        state(),
    )
    .await
    .expect("Update user failed");
    assert!(update_res);

    // 8. Test Reset Password
    let reset_res = auth_commands::reset_user_password(
        new_user_id.clone(),
        Some("NewSecretPass@99".to_string()),
        Some("9988".to_string()),
        state(),
    )
    .await
    .expect("Password reset failed");
    assert!(reset_res);

    // Verify login with new password
    let re_profile = auth_commands::login_with_password(
        "kiran.sharma@jubilant.com.np".to_string(),
        "NewSecretPass@99".to_string(),
        state(),
    )
    .await
    .expect("Login with new reset password failed");
    assert_eq!(re_profile.id, new_user_id);

    // 9. Test Toggle User Status (Deactivation)
    let toggle_res = auth_commands::toggle_user_status(new_user_id.clone(), false, state())
        .await
        .expect("Toggle user status failed");
    assert!(toggle_res);

    // Inactive user cannot login
    let inactive_login = auth_commands::login_with_password(
        "kiran.sharma@jubilant.com.np".to_string(),
        "NewSecretPass@99".to_string(),
        state(),
    )
    .await;
    assert!(inactive_login.is_err(), "Inactive user must not be permitted to log in");
}

#[tokio::test]
async fn test_accounting_and_nepal_double_entry_invariance() {
    let app = setup_test_app();
    let state = || app.state::<AppState>();

    // 1. Check Chart of Accounts
    let accounts = accounting_commands::get_coa_accounts(state()).await.expect("Failed to get COA");
    assert!(accounts.len() >= 12, "Expected at least 12 standard COA accounts");

    let cash_account = accounts.iter().find(|a| a.code == 1010).expect("1010 Cash account missing");
    let bank_account = accounts.iter().find(|a| a.code == 1020).expect("1020 Bank account missing");

    // 2. Double-Entry Invariant Test: Unbalanced Entry MUST be rejected
    let unbalanced_items = vec![
        accounting_commands::JournalItemInput {
            account_id: cash_account.id.clone(),
            debit_paisa: 5000000, // NPR 50,000
            credit_paisa: 0,
            memo: Some("Cash withdrawal".to_string()),
        },
        accounting_commands::JournalItemInput {
            account_id: bank_account.id.clone(),
            debit_paisa: 0,
            credit_paisa: 4000000, // NPR 40,000 (Mismatch!)
            memo: Some("Bank transfer".to_string()),
        },
    ];

    let unbalanced_res = accounting_commands::create_journal_entry(
        "JV-FAIL-01".to_string(),
        "2026-10-24".to_string(),
        "Intentional Unbalanced Entry".to_string(),
        unbalanced_items,
        "tester".to_string(),
        state(),
    )
    .await;
    assert!(unbalanced_res.is_err(), "Unbalanced journal entry MUST be rejected");

    // 3. Balanced Contra Entry: Debit Cash NPR 50,000, Credit Bank NPR 50,000
    let balanced_items = vec![
        accounting_commands::JournalItemInput {
            account_id: cash_account.id.clone(),
            debit_paisa: 5000000, // NPR 50,000
            credit_paisa: 0,
            memo: Some("Contra: Cash withdrawal for petty cash".to_string()),
        },
        accounting_commands::JournalItemInput {
            account_id: bank_account.id.clone(),
            debit_paisa: 0,
            credit_paisa: 5000000, // NPR 50,000
            memo: Some("Contra: Withdrawn from Nabil Bank".to_string()),
        },
    ];

    let jv_id = accounting_commands::create_journal_entry(
        "JV-CONTRA-01".to_string(),
        "2026-10-24".to_string(),
        "Petty cash withdrawal from Bank".to_string(),
        balanced_items,
        "tester".to_string(),
        state(),
    )
    .await
    .expect("Balanced journal entry should succeed");
    assert!(!jv_id.is_empty());

    // 4. Verify in get_journal_entries
    let entries = accounting_commands::get_journal_entries(state()).await.expect("Failed to get journal entries");
    let entry = entries.iter().find(|e| e.voucher_no == "JV-CONTRA-01").expect("Created JV not found");
    assert_eq!(entry.total_debit_paisa, 5000000);
    assert_eq!(entry.total_credit_paisa, 5000000);

    // 5. Cash Book Entry
    let cash_book_id = accounting_commands::add_cash_book_entry(
        "2026-10-24".to_string(),
        10000000, // NPR 100,000 opening
        5000000,  // NPR 50,000 cash in
        1500000,  // NPR 15,000 cash out
        Some("Daily retail transactions".to_string()),
        "Admin Cashier".to_string(),
        state(),
    )
    .await
    .expect("Cash book entry failed");
    assert!(!cash_book_id.is_empty());

    let cash_records = accounting_commands::get_cash_book(state()).await.expect("Failed to get cash book");
    assert!(!cash_records.is_empty());
    let rec = cash_records.first().unwrap();
    assert_eq!(rec.closing_balance_paisa, 10000000 + 5000000 - 1500000);

    // 6. Check VAT Report
    let vat_report = accounting_commands::get_vat_report(state()).await.expect("Failed to get VAT report");
    // Verify calculation logic: Output VAT - Input VAT == Net VAT
    assert_eq!(
        vat_report.net_vat_payable_paisa,
        vat_report.output_vat_13_paisa - vat_report.input_vat_13_paisa
    );
}

#[tokio::test]
async fn test_inventory_and_stock_transfer() {
    let app = setup_test_app();
    let state = || app.state::<AppState>();

    // 1. Create Warehouses
    let wh1_id = inventory_commands::create_warehouse(
        "Central Birgunj Godown".to_string(),
        "Dry Port Road, Birgunj".to_string(),
        true,
        state(),
    )
    .await
    .expect("Failed to create warehouse 1");

    let wh2_id = inventory_commands::create_warehouse(
        "Kathmandu Balaju Depot".to_string(),
        "Balaju Industrial Area, Kathmandu".to_string(),
        false,
        state(),
    )
    .await
    .expect("Failed to create warehouse 2");

    let warehouses = inventory_commands::get_warehouses(state()).await.expect("Failed to get warehouses");
    assert!(warehouses.len() >= 2);

    // 2. Create Product
    let prod_id = inventory_commands::create_product(
        "JUB-SMPS-500".to_string(),
        Some("8901234567890".to_string()),
        "500W Industrial SMPS Power Unit".to_string(),
        "Power Supplies".to_string(),
        "Piece".to_string(),
        350000, // Cost: NPR 3,500
        550000, // Price: NPR 5,500
        false,  // Taxable 13%
        10,     // Min stock alert
        state(),
    )
    .await
    .expect("Product creation failed");
    assert!(!prod_id.is_empty());

    let products = inventory_commands::get_products(state()).await.expect("Failed to get products");
    assert!(products.iter().any(|p| p.sku == "JUB-SMPS-500"));

    // 3. Purchase Stock into Birgunj Godown
    let vendor_id = purchase_commands::create_vendor(
        "Delta Power Solutions Pvt. Ltd.".to_string(),
        Some("300456789".to_string()),
        "+977-1-4433221".to_string(),
        Some("info@deltanepal.com".to_string()),
        "Teku, Kathmandu".to_string(),
        Some("Suresh Agrawal".to_string()),
        state(),
    )
    .await
    .expect("Failed to create vendor");

    let bill_items = vec![purchase_commands::BillItemInput {
        product_id: prod_id.clone(),
        quantity: 50,
        unit_cost_paisa: 350000, // NPR 3,500
        is_exempt: false,
    }];

    let bill_id = purchase_commands::create_purchase_bill(
        "PB-2026-001".to_string(),
        vendor_id,
        "2026-10-24".to_string(),
        wh1_id.clone(),
        bill_items,
        state(),
    )
    .await
    .expect("Failed to record purchase bill");
    assert!(!bill_id.is_empty());

    // 4. Verify Stock in Birgunj Godown is 50
    let stock_levels = inventory_commands::get_stock_levels(state()).await.expect("Failed to get stock levels");
    let wh1_stock = stock_levels
        .iter()
        .find(|s| s.product_id == prod_id && s.warehouse_id == wh1_id)
        .expect("Stock record missing in WH1");
    assert_eq!(wh1_stock.quantity, 50);

    // 5. Transfer to same warehouse MUST be rejected
    let same_wh_res = inventory_commands::create_stock_transfer(
        "TR-FAIL-01".to_string(),
        wh1_id.clone(),
        wh1_id.clone(),
        "2026-10-24".to_string(),
        prod_id.clone(),
        10,
        Some("Invalid same-warehouse transfer".to_string()),
        state(),
    )
    .await;
    assert!(same_wh_res.is_err(), "Transfer to identical godown must fail");

    // 6. Transfer more than available stock MUST be rejected
    let over_qty_res = inventory_commands::create_stock_transfer(
        "TR-FAIL-02".to_string(),
        wh1_id.clone(),
        wh2_id.clone(),
        "2026-10-24".to_string(),
        prod_id.clone(),
        100, // Available is only 50
        Some("Over-stock transfer".to_string()),
        state(),
    )
    .await;
    assert!(over_qty_res.is_err(), "Transfer of quantity exceeding stock must fail");

    // 7. Successful Transfer of 20 units from Birgunj to Kathmandu
    let transfer_id = inventory_commands::create_stock_transfer(
        "TR-2026-001".to_string(),
        wh1_id.clone(),
        wh2_id.clone(),
        "2026-10-24".to_string(),
        prod_id.clone(),
        20,
        Some("Dispatching 20 SMPS units to Kathmandu depot".to_string()),
        state(),
    )
    .await
    .expect("Valid stock transfer failed");
    assert!(!transfer_id.is_empty());

    // 8. Verify Remaining Stock: WH1 should have 30, WH2 should have 20
    let updated_stocks = inventory_commands::get_stock_levels(state()).await.expect("Failed to get updated stock");
    let s1 = updated_stocks.iter().find(|s| s.product_id == prod_id && s.warehouse_id == wh1_id).unwrap();
    let s2 = updated_stocks.iter().find(|s| s.product_id == prod_id && s.warehouse_id == wh2_id).unwrap();
    assert_eq!(s1.quantity, 30, "Source warehouse must have 30 units");
    assert_eq!(s2.quantity, 20, "Target warehouse must have 20 units");
}

#[tokio::test]
async fn test_sales_and_nepal_vat_tax_invoice() {
    let app = setup_test_app();
    let state = || app.state::<AppState>();

    // 1. Create Customer
    let cust_id = sales_commands::create_customer(
        "Corporate".to_string(),
        "Himalayan Beverages Pvt. Ltd.".to_string(),
        "Rajan Shrestha".to_string(),
        "+977-9801122334".to_string(),
        Some("purchase@himalayanbev.com.np".to_string()),
        Some("600123456".to_string()), // Nepal PAN
        50000000,                      // NPR 500,000 Credit Limit
        "Hetauda Industrial Estate, Makwanpur".to_string(),
        state(),
    )
    .await
    .expect("Failed to create customer");
    assert!(!cust_id.is_empty());

    let customers = sales_commands::get_customers(state()).await.expect("Failed to get customers");
    assert!(customers.iter().any(|c| c.id == cust_id));

    // 2. Setup Warehouse and Stock
    let wh_id = inventory_commands::create_warehouse(
        "Pokhara Branch Godown".to_string(),
        "Prithvi Chowk, Pokhara".to_string(),
        false,
        state(),
    )
    .await
    .expect("Failed to create warehouse");

    let prod_id = inventory_commands::create_product(
        "JUB-PANEL-800".to_string(),
        None,
        "800A Automatic Transfer Switch Panel".to_string(),
        "Panels".to_string(),
        "Unit".to_string(),
        12000000, // NPR 120,000 cost
        18000000, // NPR 180,000 price
        false,    // Standard 13% VAT
        2,
        state(),
    )
    .await
    .expect("Failed to create product");

    let vendor_id = purchase_commands::create_vendor(
        "ABB Nepal Switchgear Supplier".to_string(),
        Some("102938475".to_string()),
        "+977-1-5544332".to_string(),
        None,
        "Patan Industrial Estate, Lalitpur".to_string(),
        None,
        state(),
    )
    .await
    .expect("Failed to create vendor");

    // Inward 10 units via purchase bill
    purchase_commands::create_purchase_bill(
        "PB-ATS-01".to_string(),
        vendor_id,
        "2026-10-24".to_string(),
        wh_id.clone(),
        vec![purchase_commands::BillItemInput {
            product_id: prod_id.clone(),
            quantity: 10,
            unit_cost_paisa: 12000000,
            is_exempt: false,
        }],
        state(),
    )
    .await
    .expect("Failed to purchase ATS panels");

    // 3. Issue Tax Invoice for 2 units (Taxable: NPR 360,000; VAT 13%: NPR 46,800; Grand Total: NPR 406,800)
    let invoice_items = vec![sales_commands::InvoiceItemInput {
        product_id: prod_id.clone(),
        quantity: 2,
        unit_price_paisa: 18000000, // NPR 180,000
        is_exempt: false,
    }];

    let inv_id = sales_commands::create_tax_invoice(
        "TI-2083-001".to_string(),
        cust_id.clone(),
        "2026-10-24".to_string(),
        invoice_items,
        wh_id.clone(),
        state(),
    )
    .await
    .expect("Failed to create tax invoice");
    assert!(!inv_id.is_empty());

    // 4. Verify Sales Book (बिक्री खाता) Record
    let sales_book = sales_commands::get_sales_book(state()).await.expect("Failed to get sales book");
    let row = sales_book.iter().find(|r| r.invoice_no == "TI-2083-001").expect("Invoice missing in Sales Book");
    assert_eq!(row.taxable_amount_paisa, 36000000); // NPR 360,000
    assert_eq!(row.vat_13_paisa, 4680000);         // 13% of 360,000 = NPR 46,800
    assert_eq!(row.grand_total_paisa, 40680000);    // NPR 406,800
    assert_eq!(row.pan_number, Some("600123456".to_string()));

    // 5. Verify Godown Stock Deduction: Started with 10, sold 2 => Remaining 8
    let stocks = inventory_commands::get_stock_levels(state()).await.expect("Failed to get stock levels");
    let item_stock = stocks.iter().find(|s| s.product_id == prod_id && s.warehouse_id == wh_id).unwrap();
    assert_eq!(item_stock.quantity, 8, "Stock must decrement to 8 after sales invoice");

    // 6. Verify Auto-posted Double-Entry Journal Entry
    let jv_entries = accounting_commands::get_journal_entries(state()).await.expect("Failed to get journal entries");
    let inv_jv = jv_entries.iter().find(|j| j.voucher_no == "JV-INV-TI-2083-001").expect("Invoice auto-JV missing");
    assert_eq!(inv_jv.total_debit_paisa, 40680000, "Debit Accounts Receivable must equal Grand Total");
    assert_eq!(inv_jv.total_credit_paisa, 40680000, "Credit (Revenue + VAT) must equal Grand Total");
}

#[tokio::test]
async fn test_operating_expenses_and_tds_compliance() {
    let app = setup_test_app();
    let state = || app.state::<AppState>();

    // 1. Get Office Rent Expense Account (5010)
    let accounts = accounting_commands::get_coa_accounts(state()).await.expect("Failed to get COA");
    let rent_account = accounts.iter().find(|a| a.code == 5010).expect("5010 Rent account missing");

    // 2. Record Office Rent Expense:
    // Taxable: NPR 100,000 (10,000,000 Paisa)
    // VAT: None (rent usually no VAT or exempt)
    // TDS Rate: 1000 bps (10% Nepal Rent TDS) => TDS: NPR 10,000 (1,000,000 Paisa)
    // Net Payable: NPR 90,000 (9,000,000 Paisa)
    let exp_id = purchase_commands::create_operating_expense(
        "EXP-RENT-2026-10".to_string(),
        rent_account.id.clone(),
        "Birtamode Corporate Branch Office Rent".to_string(),
        Some("109876543".to_string()), // Landlord PAN
        10000000,                      // NPR 100,000
        false,                         // No VAT
        1000,                          // 10% TDS (1000 bps)
        "Bank".to_string(),
        "2026-10-24".to_string(),
        state(),
    )
    .await
    .expect("Failed to create operating expense");
    assert!(!exp_id.is_empty());

    // 3. Verify in get_operating_expenses
    let expenses = purchase_commands::get_operating_expenses(state()).await.expect("Failed to get expenses");
    let exp = expenses.iter().find(|e| e.expense_no == "EXP-RENT-2026-10").expect("Created expense not found");
    assert_eq!(exp.taxable_paisa, 10000000);
    assert_eq!(exp.tds_paisa, 1000000);
    assert_eq!(exp.net_payable_paisa, 9000000);

    // 4. Verify Auto-posted Double-Entry Journal Entry:
    // Debit Rent Expense (10,000,000)
    // Credit TDS Payable (1,000,000)
    // Credit Bank / Cash (9,000,000)
    // Total Debits == Total Credits == 10,000,000
    let jv_entries = accounting_commands::get_journal_entries(state()).await.expect("Failed to get journal entries");
    let exp_jv = jv_entries.iter().find(|j| j.voucher_no == "JV-EXP-EXP-RENT-2026-10").expect("Expense auto-JV missing");
    assert_eq!(exp_jv.total_debit_paisa, 10000000);
    assert_eq!(exp_jv.total_credit_paisa, 10000000);
}

#[tokio::test]
async fn test_field_service_14_step_lifecycle() {
    let app = setup_test_app();
    let state = || app.state::<AppState>();

    // 1. Setup Customer & Godown & Product
    let cust_id = sales_commands::create_customer(
        "Commercial".to_string(),
        "Bhatbhateni Supermarket Naxal".to_string(),
        "Sunil Karki".to_string(),
        "+977-1-4411223".to_string(),
        None,
        Some("500112233".to_string()),
        100000000,
        "Naxal, Kathmandu".to_string(),
        state(),
    )
    .await
    .expect("Customer creation failed");

    let wh_id = inventory_commands::create_warehouse(
        "Field Service Spare Parts Hub".to_string(),
        "Baluwatar, Kathmandu".to_string(),
        false,
        state(),
    )
    .await
    .expect("Warehouse creation failed");

    let part_id = inventory_commands::create_product(
        "JUB-PART-CONTACTOR-40A".to_string(),
        None,
        "Schneider 40A 3-Pole AC Contactor".to_string(),
        "Spare Parts".to_string(),
        "Piece".to_string(),
        180000, // NPR 1,800
        280000, // NPR 2,800
        false,
        5,
        state(),
    )
    .await
    .expect("Product creation failed");

    // Stock the spare part with 10 units
    let vendor_id = purchase_commands::create_vendor(
        "Schneider Electric Nepal Partner".to_string(),
        None,
        "+977-1-4223344".to_string(),
        None,
        "Tripureshwor, Kathmandu".to_string(),
        None,
        state(),
    )
    .await
    .unwrap();

    purchase_commands::create_purchase_bill(
        "PB-SPARE-01".to_string(),
        vendor_id,
        "2026-10-24".to_string(),
        wh_id.clone(),
        vec![purchase_commands::BillItemInput {
            product_id: part_id.clone(),
            quantity: 10,
            unit_cost_paisa: 180000,
            is_exempt: false,
        }],
        state(),
    )
    .await
    .expect("Stocking spare parts failed");

    // 2. Ticket Intake (Step 1): Create Service Request
    let ticket_id = field_service_commands::create_service_request(
        "SR-2026-088".to_string(),
        cust_id,
        "Chiller Plant ATS Panel 1".to_string(),
        Some("SN-ATS-99881".to_string()),
        "HIGH".to_string(),
        "ATS contactor chattering intermittently during grid fluctuation".to_string(),
        None,
        Some("2026-10-24 14:00".to_string()),
        state(),
    )
    .await
    .expect("Failed to create service ticket");
    assert!(!ticket_id.is_empty());

    // 3. Status Transition (Step 2): Assign & Start On-site Diagnosis
    let update_res = field_service_commands::update_service_status(
        ticket_id.clone(),
        "IN_PROGRESS".to_string(),
        state(),
    )
    .await
    .expect("Status update failed");
    assert!(update_res);

    let requests = field_service_commands::get_service_requests(state()).await.expect("Failed to get requests");
    let ticket = requests.iter().find(|r| r.id == ticket_id).expect("Ticket missing");
    assert_eq!(ticket.status, "IN_PROGRESS");

    // 4. Spare Part Request (Step 5): Request 2 Contactors from Godown
    let part_req_id = field_service_commands::submit_spare_part_request(
        ticket_id.clone(),
        part_id.clone(),
        2,
        wh_id.clone(),
        state(),
    )
    .await
    .expect("Failed to submit spare part request");
    assert!(!part_req_id.is_empty());

    // 5. Godown Stock Approval (Step 6): Store manager approves and stock decrements
    let users = auth_commands::get_users(state()).await.expect("Failed to get users");
    let approver = users.first().expect("No approver user available");
    let approve_res = field_service_commands::approve_spare_part_request(
        part_req_id.clone(),
        approver.id.clone(),
        state(),
    )
    .await
    .expect("Failed to approve spare part request");
    assert!(approve_res);

    // Verify stock decremented from 10 to 8
    let stocks = inventory_commands::get_stock_levels(state()).await.expect("Failed to get stock");
    let s = stocks.iter().find(|s| s.product_id == part_id && s.warehouse_id == wh_id).unwrap();
    assert_eq!(s.quantity, 8, "Stock must decrement by 2 after spare part approval");

    // 6. Service Sign-Off & NPS (Step 13 & 14): Submit final report
    let report_id = field_service_commands::submit_service_report(
        ticket_id.clone(),
        "Diagnosed burnt auxiliary contacts on 40A contactor due to surge".to_string(),
        "Replaced contactor unit with new Schneider 40A model, calibrated ATS timings, load-tested on generator".to_string(),
        "SVG_PATH_COORDINATES_VECTOR_SIG_128BIT_HASH".to_string(),
        Some("Fast dispatch and professional repair work by technician".to_string()),
        10, // Top NPS rating
        state(),
    )
    .await
    .expect("Failed to submit service report");
    assert!(!report_id.is_empty());

    // 7. Verify Ticket Status is now "Closed"
    let final_requests = field_service_commands::get_service_requests(state()).await.expect("Failed to get requests");
    let final_ticket = final_requests.iter().find(|r| r.id == ticket_id).expect("Final ticket missing");
    assert_eq!(final_ticket.status, "Closed");
}

#[tokio::test]
async fn test_hrm_and_attendance_flow() {
    let app = setup_test_app();
    let state = || app.state::<AppState>();

    // 1. Register Employee
    let emp_id = hrm_commands::create_employee(
        "EMP-0012".to_string(),
        "Binod Thapa".to_string(),
        Some("27-01-78-01234".to_string()),
        "Field Operations".to_string(),
        "Senior Service Engineer".to_string(),
        5500000, // NPR 55,000 monthly basic
        Some("01200345678901".to_string()),
        "2024-04-14".to_string(),
        state(),
    )
    .await
    .expect("Failed to register employee");
    assert!(!emp_id.is_empty());

    let employees = hrm_commands::get_employees(state()).await.expect("Failed to get employees");
    let emp = employees.iter().find(|e| e.id == emp_id).expect("Created employee missing");
    assert_eq!(emp.name, "Binod Thapa");
    assert_eq!(emp.basic_salary_paisa, 5500000);

    // 2. Punch Daily Attendance
    let att_id = hrm_commands::mark_attendance(
        emp_id.clone(),
        "2026-10-24".to_string(),
        Some("09:45".to_string()),
        Some("18:15".to_string()),
        8.5,
        false,
        "BIOMETRIC_DEVICE_01".to_string(),
        state(),
    )
    .await
    .expect("Failed to mark attendance");
    assert!(!att_id.is_empty());

    // 3. Verify Attendance Records
    let records = hrm_commands::get_attendance_records(state()).await.expect("Failed to get attendance records");
    let rec = records.iter().find(|r| r.employee_id == emp_id && r.date == "2026-10-24").expect("Attendance record missing");
    assert_eq!(rec.hours_worked, 8.5);
    assert_eq!(rec.in_time, Some("09:45".to_string()));
    assert_eq!(rec.out_time, Some("18:15".to_string()));
    assert_eq!(rec.source, "BIOMETRIC_DEVICE_01");
}
