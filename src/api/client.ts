import { invoke } from "@tauri-apps/api/core";

// Typed error wrapper
export interface AppError {
  code: string;
  message: string;
  is_fatal?: boolean;
}

// 10-Second Watchdog for IPC Invocations
async function safeInvoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  const timeoutMs = 10000;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject({
          code: "TIMEOUT",
          message: `Command '${cmd}' exceeded timeout of ${timeoutMs}ms`,
        }),
      timeoutMs
    )
  );

  try {
    return await Promise.race([invoke<T>(cmd, args), timeoutPromise]);
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && "message" in err) {
      throw err as AppError;
    }
    throw {
      code: "UNKNOWN",
      message: String(err),
    } as AppError;
  }
}

// Data Types
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role_id: string;
  role_name: string;
  department: string;
  is_active: boolean;
  last_login_at?: number;
  permissions: string[];
}

export interface Role {
  id: string;
  name: string;
  department: string;
  description?: string;
  permissions_json: string;
}

export interface CoaAccount {
  id: string;
  code: number;
  name: string;
  account_type: string;
  current_balance_paisa: number;
}

export interface JournalEntryView {
  id: string;
  voucher_no: string;
  entry_date: string;
  narration: string;
  total_debit_paisa: number;
  total_credit_paisa: number;
}

export interface CashBookRecord {
  id: string;
  date: string;
  opening_balance_paisa: number;
  cash_in_paisa: number;
  cash_out_paisa: number;
  closing_balance_paisa: number;
  notes?: string;
  verified_by: string;
}

export interface VatSummary {
  total_sales_taxable_paisa: number;
  total_sales_exempt_paisa: number;
  output_vat_13_paisa: number;
  total_purchases_taxable_paisa: number;
  total_purchases_exempt_paisa: number;
  input_vat_13_paisa: number;
  net_vat_payable_paisa: number;
}

export interface Customer {
  id: string;
  customer_type: string;
  company_name: string;
  contact_person: string;
  phone: string;
  email?: string;
  pan_number?: string;
  credit_limit_paisa: number;
  address: string;
}

export interface SalesBookRow {
  id: string;
  invoice_no: string;
  invoice_date: string;
  customer_name: string;
  pan_number?: string;
  taxable_amount_paisa: number;
  exempt_amount_paisa: number;
  vat_13_paisa: number;
  grand_total_paisa: number;
  payment_status: string;
}

export interface Vendor {
  id: string;
  name: string;
  pan_number?: string;
  phone: string;
  email?: string;
  address: string;
  contact_person?: string;
}

export interface PurchaseBookRow {
  id: string;
  bill_no: string;
  bill_date: string;
  vendor_name: string;
  pan_number?: string;
  taxable_amount_paisa: number;
  exempt_amount_paisa: number;
  vat_13_paisa: number;
  grand_total_paisa: number;
  payment_status: string;
}

export interface ExpenseRecord {
  id: string;
  expense_no: string;
  title: string;
  account_name: string;
  taxable_paisa: number;
  vat_paisa: number;
  tds_paisa: number;
  net_payable_paisa: number;
  payment_mode: string;
  date: string;
}

export interface ProductView {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  category: string;
  unit: string;
  purchase_cost_paisa: number;
  selling_price_paisa: number;
  is_vat_exempt: boolean;
  min_stock_alert: number;
  total_stock: number;
}

export interface WarehouseView {
  id: string;
  name: string;
  location: string;
  is_primary: boolean;
}

export interface WarehouseStock {
  product_id: string;
  product_name: string;
  sku: string;
  warehouse_id: string;
  warehouse_name: string;
  quantity: number;
}

export interface ServiceRequestView {
  id: string;
  ticket_no: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  product_name: string;
  product_serial?: string;
  priority: string;
  issue_description: string;
  status: string;
  technician_name?: string;
  scheduled_date?: string;
  created_at: number;
}

export interface EmployeeView {
  id: string;
  employee_code: string;
  name: string;
  citizenship_no?: string;
  department: string;
  designation: string;
  basic_salary_paisa: number;
  bank_account_no?: string;
  joining_date: string;
}

export interface AttendanceView {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  in_time?: string;
  out_time?: string;
  hours_worked: number;
  is_late: boolean;
  source: string;
}

// API Client Methods
export const api = {
  // Auth & User Management
  loginWithPassword: (email: string, password: string) =>
    safeInvoke<UserProfile>("login_with_password", { email, password }),
  loginWithPin: (pin: string) =>
    safeInvoke<UserProfile>("login_with_pin", { pin }),
  getUsers: () => safeInvoke<UserProfile[]>("get_users"),
  getRoles: () => safeInvoke<Role[]>("get_roles"),
  createUser: (user: {
    name: string;
    email: string;
    password: string;
    pin?: string;
    roleId: string;
    department: string;
  }) => safeInvoke<string>("create_user", user),
  updateUser: (user: {
    id: string;
    name: string;
    email: string;
    roleId: string;
    department: string;
    isActive: boolean;
  }) => safeInvoke<boolean>("update_user", user),
  resetUserPassword: (data: {
    id: string;
    newPassword?: string;
    newPin?: string;
  }) => safeInvoke<boolean>("reset_user_password", data),
  toggleUserStatus: (id: string, isActive: boolean) =>
    safeInvoke<boolean>("toggle_user_status", { id, isActive }),

  // Accounting
  getCoaAccounts: () => safeInvoke<CoaAccount[]>("get_coa_accounts"),
  createJournalEntry: (
    voucherNo: string,
    entryDate: string,
    narration: string,
    items: { account_id: string; debit_paisa: number; credit_paisa: number; memo?: string }[],
    createdBy: string
  ) =>
    safeInvoke<string>("create_journal_entry", {
      voucherNo,
      entryDate,
      narration,
      items,
      createdBy,
    }),
  getJournalEntries: () => safeInvoke<JournalEntryView[]>("get_journal_entries"),
  getCashBook: () => safeInvoke<CashBookRecord[]>("get_cash_book"),
  addCashBookEntry: (
    date: string,
    openingBalancePaisa: number,
    cashInPaisa: number,
    cashOutPaisa: number,
    notes: string | undefined,
    verifiedBy: string
  ) =>
    safeInvoke<string>("add_cash_book_entry", {
      date,
      openingBalancePaisa,
      cashInPaisa,
      cashOutPaisa,
      notes,
      verifiedBy,
    }),
  getVatReport: () => safeInvoke<VatSummary>("get_vat_report"),

  // Sales
  getCustomers: () => safeInvoke<Customer[]>("get_customers"),
  createCustomer: (customer: Omit<Customer, "id">) =>
    safeInvoke<string>("create_customer", {
      customerType: customer.customer_type,
      companyName: customer.company_name,
      contactPerson: customer.contact_person,
      phone: customer.phone,
      email: customer.email,
      panNumber: customer.pan_number,
      creditLimitPaisa: customer.credit_limit_paisa,
      address: customer.address,
    }),
  getSalesBook: () => safeInvoke<SalesBookRow[]>("get_sales_book"),
  createTaxInvoice: (
    invoiceNo: string,
    customerId: string,
    invoiceDate: string,
    items: { product_id: string; quantity: number; unit_price_paisa: number; is_exempt: boolean }[],
    warehouseId: string
  ) =>
    safeInvoke<string>("create_tax_invoice", {
      invoiceNo,
      customerId,
      invoiceDate,
      items,
      warehouseId,
    }),

  // Purchases
  getVendors: () => safeInvoke<Vendor[]>("get_vendors"),
  createVendor: (vendor: Omit<Vendor, "id">) =>
    safeInvoke<string>("create_vendor", {
      name: vendor.name,
      panNumber: vendor.pan_number,
      phone: vendor.phone,
      email: vendor.email,
      address: vendor.address,
      contactPerson: vendor.contact_person,
    }),
  getPurchaseBook: () => safeInvoke<PurchaseBookRow[]>("get_purchase_book"),
  createPurchaseBill: (
    billNo: string,
    vendorId: string,
    billDate: string,
    warehouseId: string,
    items: { product_id: string; quantity: number; unit_cost_paisa: number; is_exempt: boolean }[]
  ) =>
    safeInvoke<string>("create_purchase_bill", {
      billNo,
      vendorId,
      billDate,
      warehouseId,
      items,
    }),
  getOperatingExpenses: () => safeInvoke<ExpenseRecord[]>("get_operating_expenses"),
  createOperatingExpense: (
    expenseNo: string,
    expenseAccountId: string,
    title: string,
    vendorPan: string | undefined,
    taxablePaisa: number,
    hasVat: boolean,
    tdsRateBps: number,
    paymentMode: string,
    date: string
  ) =>
    safeInvoke<string>("create_operating_expense", {
      expenseNo,
      expenseAccountId,
      title,
      vendorPan,
      taxablePaisa,
      hasVat,
      tdsRateBps,
      paymentMode,
      date,
    }),

  // Inventory & Godowns
  getProducts: () => safeInvoke<ProductView[]>("get_products"),
  createProduct: (product: {
    sku: string;
    barcode?: string;
    name: string;
    category: string;
    unit: string;
    purchaseCostPaisa: number;
    sellingPricePaisa: number;
    isVatExempt: boolean;
    minStockAlert: number;
  }) => safeInvoke<string>("create_product", product),
  getWarehouses: () => safeInvoke<WarehouseView[]>("get_warehouses"),
  getStockLevels: () => safeInvoke<WarehouseStock[]>("get_stock_levels"),
  createStockTransfer: (transfer: {
    transferNo: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    transferDate: string;
    productId: string;
    quantity: number;
    notes?: string;
  }) => safeInvoke<string>("create_stock_transfer", transfer),

  // Field Service
  getServiceRequests: () => safeInvoke<ServiceRequestView[]>("get_service_requests"),
  createServiceRequest: (req: {
    ticketNo: string;
    customerId: string;
    productName: string;
    productSerial?: string;
    priority: string;
    issueDescription: string;
    technicianId?: string;
    scheduledDate?: string;
  }) => safeInvoke<string>("create_service_request", req),
  updateServiceStatus: (ticketId: string, newStatus: string) =>
    safeInvoke<boolean>("update_service_status", { ticketId, newStatus }),
  submitSparePartRequest: (req: {
    serviceRequestId: string;
    productId: string;
    quantity: number;
    warehouseId: string;
  }) => safeInvoke<string>("submit_spare_part_request", req),
  approveSparePartRequest: (requestId: string, approvedBy: string) =>
    safeInvoke<boolean>("approve_spare_part_request", { requestId, approvedBy }),
  submitServiceReport: (report: {
    serviceRequestId: string;
    diagnosis: string;
    workPerformed: string;
    customerSignatureVector: string;
    customerFeedback?: string;
    npsRating: number;
  }) => safeInvoke<string>("submit_service_report", report),

  // HRM
  getEmployees: () => safeInvoke<EmployeeView[]>("get_employees"),
  createEmployee: (emp: {
    employeeCode: string;
    name: string;
    citizenshipNo?: string;
    department: string;
    designation: string;
    basicSalaryPaisa: number;
    bankAccountNo?: string;
    joiningDate: string;
  }) => safeInvoke<string>("create_employee", emp),
  markAttendance: (att: {
    employeeId: string;
    date: string;
    inTime?: string;
    outTime?: string;
    hoursWorked: number;
    isLate: boolean;
    source: string;
  }) => safeInvoke<string>("mark_attendance", att),
  getAttendanceRecords: () => safeInvoke<AttendanceView[]>("get_attendance_records"),

  // Auto-Update
  downloadAndroidApk: (apkUrl: string) =>
    safeInvoke<string>("download_android_apk", { apkUrl }),
  checkInstallPermission: () =>
    safeInvoke<boolean>("check_install_permission"),
  installAndroidApk: (filePath: string) =>
    safeInvoke<boolean>("install_android_apk", { filePath }),
};
