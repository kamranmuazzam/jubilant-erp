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
  salary_paisa?: number; // Alias for seamless view rendering
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

// API Client Methods with Full Alias & Signature Normalization
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
    roleId?: string;
    role_id?: string;
    department: string;
  }) =>
    safeInvoke<string>("create_user", {
      name: user.name,
      email: user.email,
      password: user.password,
      pin: user.pin,
      roleId: user.roleId || user.role_id,
      department: user.department,
    }),
  updateUser: (user: {
    id: string;
    name: string;
    email: string;
    roleId?: string;
    role_id?: string;
    department: string;
    isActive?: boolean;
    is_active?: boolean;
  }) =>
    safeInvoke<boolean>("update_user", {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId || user.role_id,
      department: user.department,
      isActive: user.isActive ?? user.is_active ?? true,
    }),
  resetUserPassword: (data: {
    id: string;
    newPassword?: string;
    new_password?: string;
    newPin?: string;
    new_pin?: string;
  }) =>
    safeInvoke<boolean>("reset_user_password", {
      id: data.id,
      newPassword: data.newPassword || data.new_password,
      newPin: data.newPin || data.new_pin,
    }),
  toggleUserStatus: (id: string, isActive: boolean) =>
    safeInvoke<boolean>("toggle_user_status", { id, isActive }),

  // Accounting
  getCoaAccounts: () => safeInvoke<CoaAccount[]>("get_coa_accounts"),
  createJournalEntry: (
    voucherNoOrObj:
      | string
      | {
          voucherNo?: string;
          voucher_no?: string;
          entryDate?: string;
          entry_date?: string;
          narration: string;
          items: { account_id: string; debit_paisa: number; credit_paisa: number; memo?: string }[];
          createdBy?: string;
          created_by?: string;
        },
    entryDate?: string,
    narration?: string,
    items?: { account_id: string; debit_paisa: number; credit_paisa: number; memo?: string }[],
    createdBy?: string
  ) => {
    if (typeof voucherNoOrObj === "object") {
      const obj = voucherNoOrObj;
      return safeInvoke<string>("create_journal_entry", {
        voucherNo: obj.voucherNo || obj.voucher_no,
        entryDate: obj.entryDate || obj.entry_date,
        narration: obj.narration,
        items: obj.items,
        createdBy: obj.createdBy || obj.created_by || "system",
      });
    }
    return safeInvoke<string>("create_journal_entry", {
      voucherNo: voucherNoOrObj,
      entryDate,
      narration,
      items,
      createdBy: createdBy || "system",
    });
  },
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
  createCustomer: (customer: {
    customer_type?: string;
    customerType?: string;
    company_name?: string;
    companyName?: string;
    contact_person?: string;
    contactPerson?: string;
    phone: string;
    email?: string;
    pan_number?: string;
    panNumber?: string;
    credit_limit_paisa?: number;
    creditLimitPaisa?: number;
    address: string;
  }) =>
    safeInvoke<string>("create_customer", {
      customerType: customer.customerType || customer.customer_type || "Corporate",
      companyName: customer.companyName || customer.company_name,
      contactPerson: customer.contactPerson || customer.contact_person,
      phone: customer.phone,
      email: customer.email,
      panNumber: customer.panNumber || customer.pan_number,
      creditLimitPaisa: customer.creditLimitPaisa ?? customer.credit_limit_paisa ?? 0,
      address: customer.address,
    }),
  getSalesBook: () => safeInvoke<SalesBookRow[]>("get_sales_book"),
  createTaxInvoice: (
    invoiceNoOrObj:
      | string
      | {
          invoiceNo?: string;
          invoice_no?: string;
          invoice_number?: string;
          customerId?: string;
          customer_id?: string;
          invoiceDate?: string;
          invoice_date?: string;
          warehouseId?: string;
          warehouse_id?: string;
          items: Array<{
            product_id?: string;
            productId?: string;
            quantity: number;
            unit_price_paisa?: number;
            unitPricePaisa?: number;
            is_exempt?: boolean;
            is_vat_exempt?: boolean;
          }>;
          issued_by?: string;
        },
    customerId?: string,
    invoiceDate?: string,
    items?: { product_id: string; quantity: number; unit_price_paisa: number; is_exempt: boolean }[],
    warehouseId?: string
  ) => {
    if (typeof invoiceNoOrObj === "object") {
      const obj = invoiceNoOrObj;
      const normalizedItems = (obj.items || []).map((it) => ({
        product_id: it.product_id || it.productId || "",
        quantity: Number(it.quantity),
        unit_price_paisa: Number(it.unit_price_paisa ?? it.unitPricePaisa ?? 0),
        is_exempt: Boolean(it.is_exempt || it.is_vat_exempt),
      }));
      return safeInvoke<string>("create_tax_invoice", {
        invoiceNo: obj.invoiceNo || obj.invoice_no || obj.invoice_number,
        customerId: obj.customerId || obj.customer_id,
        invoiceDate: obj.invoiceDate || obj.invoice_date,
        items: normalizedItems,
        warehouseId: obj.warehouseId || obj.warehouse_id,
      });
    }
    return safeInvoke<string>("create_tax_invoice", {
      invoiceNo: invoiceNoOrObj,
      customerId,
      invoiceDate,
      items,
      warehouseId,
    });
  },
  // Alias for SalesView compatibility
  createSalesInvoice: (data: {
    invoice_number?: string;
    invoiceNo?: string;
    customer_id?: string;
    customerId?: string;
    invoice_date?: string;
    invoiceDate?: string;
    warehouse_id?: string;
    warehouseId?: string;
    items: Array<{
      product_id?: string;
      productId?: string;
      quantity: number;
      unit_price_paisa?: number;
      unitPricePaisa?: number;
      is_exempt?: boolean;
      is_vat_exempt?: boolean;
    }>;
    issued_by?: string;
  }) => api.createTaxInvoice(data),

  // Purchases
  getVendors: () => safeInvoke<Vendor[]>("get_vendors"),
  createVendor: (vendor: {
    name: string;
    panNumber?: string;
    pan_number?: string;
    phone: string;
    email?: string;
    address: string;
    contactPerson?: string;
    contact_person?: string;
  }) =>
    safeInvoke<string>("create_vendor", {
      name: vendor.name,
      panNumber: vendor.panNumber || vendor.pan_number,
      phone: vendor.phone,
      email: vendor.email,
      address: vendor.address,
      contactPerson: vendor.contactPerson || vendor.contact_person,
    }),
  getPurchaseBook: () => safeInvoke<PurchaseBookRow[]>("get_purchase_book"),
  createPurchaseBill: (
    billNoOrObj:
      | string
      | {
          billNo?: string;
          bill_no?: string;
          bill_number?: string;
          vendorId?: string;
          vendor_id?: string;
          billDate?: string;
          bill_date?: string;
          warehouseId?: string;
          warehouse_id?: string;
          items: Array<{
            product_id?: string;
            productId?: string;
            quantity: number;
            unit_cost_paisa?: number;
            unitCostPaisa?: number;
            is_exempt?: boolean;
            is_vat_exempt?: boolean;
          }>;
          recorded_by?: string;
        },
    vendorId?: string,
    billDate?: string,
    warehouseId?: string,
    items?: { product_id: string; quantity: number; unit_cost_paisa: number; is_exempt: boolean }[]
  ) => {
    if (typeof billNoOrObj === "object") {
      const obj = billNoOrObj;
      const normalizedItems = (obj.items || []).map((it) => ({
        product_id: it.product_id || it.productId || "",
        quantity: Number(it.quantity),
        unit_cost_paisa: Number(it.unit_cost_paisa ?? it.unitCostPaisa ?? 0),
        is_exempt: Boolean(it.is_exempt || it.is_vat_exempt),
      }));
      return safeInvoke<string>("create_purchase_bill", {
        billNo: obj.billNo || obj.bill_no || obj.bill_number,
        vendorId: obj.vendorId || obj.vendor_id,
        billDate: obj.billDate || obj.bill_date,
        warehouseId: obj.warehouseId || obj.warehouse_id,
        items: normalizedItems,
      });
    }
    return safeInvoke<string>("create_purchase_bill", {
      billNo: billNoOrObj,
      vendorId,
      billDate,
      warehouseId,
      items,
    });
  },
  getOperatingExpenses: () => safeInvoke<ExpenseRecord[]>("get_operating_expenses"),
  createOperatingExpense: (
    expenseNoOrObj:
      | string
      | {
          expenseNo?: string;
          expense_no?: string;
          expense_number?: string;
          account_id?: string;
          expenseAccountId?: string;
          expense_account_id?: string;
          title: string;
          vendor_pan?: string;
          vendorPan?: string;
          taxable_paisa?: number;
          taxablePaisa?: number;
          has_vat?: boolean;
          hasVat?: boolean;
          tds_rate_bps?: number;
          tdsRateBps?: number;
          payment_mode?: string;
          paymentMode?: string;
          date?: string;
          recorded_by?: string;
        },
    expenseAccountId?: string,
    title?: string,
    vendorPan?: string | undefined,
    taxablePaisa?: number,
    hasVat?: boolean,
    tdsRateBps?: number,
    paymentMode?: string,
    date?: string
  ) => {
    if (typeof expenseNoOrObj === "object") {
      const obj = expenseNoOrObj;
      return safeInvoke<string>("create_operating_expense", {
        expenseNo: obj.expenseNo || obj.expense_no || obj.expense_number,
        expenseAccountId: obj.expenseAccountId || obj.expense_account_id || obj.account_id,
        title: obj.title,
        vendorPan: obj.vendorPan || obj.vendor_pan,
        taxablePaisa: Number(obj.taxablePaisa ?? obj.taxable_paisa ?? 0),
        hasVat: Boolean(obj.hasVat ?? obj.has_vat),
        tdsRateBps: Number(obj.tdsRateBps ?? obj.tds_rate_bps ?? 0),
        paymentMode: obj.paymentMode || obj.payment_mode || "Bank",
        date: obj.date || new Date().toISOString().split("T")[0],
      });
    }
    return safeInvoke<string>("create_operating_expense", {
      expenseNo: expenseNoOrObj,
      expenseAccountId,
      title,
      vendorPan,
      taxablePaisa,
      hasVat,
      tdsRateBps,
      paymentMode,
      date,
    });
  },
  // Alias for PurchasesView compatibility
  recordExpense: (data: {
    expense_number?: string;
    expenseNo?: string;
    account_id?: string;
    expense_account_id?: string;
    title: string;
    vendor_id?: string;
    vendor_pan?: string;
    taxable_paisa?: number;
    vat_paisa?: number;
    tds_rate_bps?: number;
    tds_paisa?: number;
    net_payable_paisa?: number;
    payment_mode?: string;
    date: string;
    recorded_by?: string;
  }) =>
    api.createOperatingExpense({
      expense_no: data.expense_number || data.expenseNo,
      expense_account_id: data.account_id || data.expense_account_id,
      title: data.title,
      vendor_pan: data.vendor_pan,
      taxable_paisa: data.taxable_paisa,
      has_vat: (data.vat_paisa ?? 0) > 0,
      tds_rate_bps: data.tds_rate_bps,
      payment_mode: data.payment_mode,
      date: data.date,
    }),

  // Inventory & Godowns
  getProducts: () => safeInvoke<ProductView[]>("get_products"),
  createProduct: (product: {
    sku: string;
    barcode?: string;
    name: string;
    category: string;
    unit: string;
    purchaseCostPaisa?: number;
    purchase_cost_paisa?: number;
    sellingPricePaisa?: number;
    selling_price_paisa?: number;
    isVatExempt?: boolean;
    is_vat_exempt?: boolean;
    minStockAlert?: number;
    min_stock_alert?: number;
  }) =>
    safeInvoke<string>("create_product", {
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      category: product.category,
      unit: product.unit,
      purchaseCostPaisa: product.purchaseCostPaisa ?? product.purchase_cost_paisa ?? 0,
      sellingPricePaisa: product.sellingPricePaisa ?? product.selling_price_paisa ?? 0,
      isVatExempt: Boolean(product.isVatExempt ?? product.is_vat_exempt),
      minStockAlert: product.minStockAlert ?? product.min_stock_alert ?? 0,
    }),
  getWarehouses: () => safeInvoke<WarehouseView[]>("get_warehouses"),
  createWarehouse: (warehouse: {
    name: string;
    location: string;
    isPrimary?: boolean;
    is_primary?: boolean;
  }) =>
    safeInvoke<string>("create_warehouse", {
      name: warehouse.name,
      location: warehouse.location,
      isPrimary: Boolean(warehouse.isPrimary ?? warehouse.is_primary),
    }),
  getStockLevels: () => safeInvoke<WarehouseStock[]>("get_stock_levels"),
  createStockTransfer: (transfer: {
    transferNo?: string;
    transfer_no?: string;
    transfer_number?: string;
    fromWarehouseId?: string;
    from_warehouse_id?: string;
    source_warehouse_id?: string;
    toWarehouseId?: string;
    to_warehouse_id?: string;
    target_warehouse_id?: string;
    transferDate?: string;
    transfer_date?: string;
    productId?: string;
    product_id?: string;
    quantity: number;
    notes?: string;
    status?: string;
    initiated_by?: string;
  }) =>
    safeInvoke<string>("create_stock_transfer", {
      transferNo: transfer.transferNo || transfer.transfer_no || transfer.transfer_number,
      fromWarehouseId:
        transfer.fromWarehouseId || transfer.from_warehouse_id || transfer.source_warehouse_id,
      toWarehouseId:
        transfer.toWarehouseId || transfer.to_warehouse_id || transfer.target_warehouse_id,
      transferDate: transfer.transferDate || transfer.transfer_date,
      productId: transfer.productId || transfer.product_id,
      quantity: Number(transfer.quantity),
      notes: transfer.notes,
    }),
  // Alias for InventoryView compatibility
  transferStock: (data: {
    transfer_number?: string;
    source_warehouse_id?: string;
    target_warehouse_id?: string;
    product_id?: string;
    quantity: number;
    transfer_date?: string;
    status?: string;
    notes?: string;
    initiated_by?: string;
  }) => api.createStockTransfer(data),

  // Field Service
  getServiceRequests: () => safeInvoke<ServiceRequestView[]>("get_service_requests"),
  createServiceRequest: (req: {
    ticketNo?: string;
    ticket_no?: string;
    customerId?: string;
    customer_id?: string;
    productName?: string;
    product_name?: string;
    productSerial?: string;
    product_serial?: string;
    priority: string;
    issueDescription?: string;
    issue_description?: string;
    technicianId?: string;
    technician_id?: string;
    scheduledDate?: string;
    scheduled_date?: string;
  }) =>
    safeInvoke<string>("create_service_request", {
      ticketNo: req.ticketNo || req.ticket_no,
      customerId: req.customerId || req.customer_id,
      productName: req.productName || req.product_name,
      productSerial: req.productSerial || req.product_serial,
      priority: req.priority,
      issueDescription: req.issueDescription || req.issue_description,
      technicianId: req.technicianId || req.technician_id,
      scheduledDate: req.scheduledDate || req.scheduled_date,
    }),
  updateServiceStatus: (ticketId: string, newStatus: string, _notes?: string) =>
    safeInvoke<boolean>("update_service_status", { ticketId, newStatus }),
  dispatchTechnician: (ticketId: string, _technicianId?: string, _technicianName?: string) =>
    safeInvoke<boolean>("update_service_status", { ticketId, newStatus: "Assigned" }),
  submitSparePartRequest: (req: {
    serviceRequestId?: string;
    service_request_id?: string;
    ticket_id?: string;
    productId?: string;
    product_id?: string;
    quantity: number;
    warehouseId?: string;
    warehouse_id?: string;
    notes?: string;
    technician_id?: string;
  }) =>
    safeInvoke<string>("submit_spare_part_request", {
      serviceRequestId: req.serviceRequestId || req.service_request_id || req.ticket_id,
      productId: req.productId || req.product_id,
      quantity: Number(req.quantity),
      warehouseId: req.warehouseId || req.warehouse_id,
    }),
  requestSparePart: (req: {
    ticket_id?: string;
    service_request_id?: string;
    product_id?: string;
    quantity: number;
    warehouse_id?: string;
    notes?: string;
    technician_id?: string;
  }) => api.submitSparePartRequest(req),
  approveSparePartRequest: (requestId: string, approvedBy: string) =>
    safeInvoke<boolean>("approve_spare_part_request", { requestId, approvedBy }),
  submitServiceReport: (report: {
    serviceRequestId?: string;
    service_request_id?: string;
    ticket_id?: string;
    diagnosis: string;
    workPerformed?: string;
    work_performed?: string;
    customerSignatureVector?: string;
    customer_signature_vector?: string;
    customer_signature_data?: string;
    customerFeedback?: string;
    customer_feedback?: string;
    npsRating?: number;
    nps_rating?: number;
    nps_score?: number;
    closed_at?: string;
  }) =>
    safeInvoke<string>("submit_service_report", {
      serviceRequestId: report.serviceRequestId || report.service_request_id || report.ticket_id,
      diagnosis: report.diagnosis,
      workPerformed: report.workPerformed || report.work_performed || "",
      customerSignatureVector:
        report.customerSignatureVector ||
        report.customer_signature_vector ||
        report.customer_signature_data ||
        "DATA_VECTOR_HASH_DEFAULT",
      customerFeedback: report.customerFeedback || report.customer_feedback,
      npsRating: Number(report.npsRating ?? report.nps_rating ?? report.nps_score ?? 10),
    }),
  signOffServiceReport: (report: {
    ticket_id: string;
    diagnosis: string;
    work_performed: string;
    customer_signature_data: string;
    customer_feedback?: string;
    nps_score: number;
    closed_at?: string;
  }) => api.submitServiceReport(report),

  // HRM
  getEmployees: async () => {
    const list = await safeInvoke<EmployeeView[]>("get_employees");
    return list.map((e) => ({
      ...e,
      salary_paisa: e.basic_salary_paisa,
    }));
  },
  createEmployee: (emp: {
    employeeCode?: string;
    employee_code?: string;
    name: string;
    citizenshipNo?: string;
    citizenship_no?: string;
    department: string;
    designation: string;
    basicSalaryPaisa?: number;
    salaryPaisa?: number;
    salary_paisa?: number;
    bankAccountNo?: string;
    bank_account_no?: string;
    joiningDate?: string;
    joining_date?: string;
    panNo?: string;
  }) =>
    safeInvoke<string>("create_employee", {
      employeeCode: emp.employeeCode || emp.employee_code,
      name: emp.name,
      citizenshipNo: emp.citizenshipNo || emp.citizenship_no,
      department: emp.department,
      designation: emp.designation,
      basicSalaryPaisa:
        emp.basicSalaryPaisa ?? emp.salaryPaisa ?? emp.salary_paisa ?? 0,
      bankAccountNo: emp.bankAccountNo || emp.bank_account_no,
      joiningDate:
        emp.joiningDate || emp.joining_date || new Date().toISOString().split("T")[0],
    }),
  markAttendance: (att: {
    employeeId?: string;
    employee_id?: string;
    date: string;
    inTime?: string;
    in_time?: string;
    outTime?: string;
    out_time?: string;
    hoursWorked?: number;
    hours_worked?: number;
    isLate?: boolean;
    is_late?: boolean;
    source?: string;
  }) =>
    safeInvoke<string>("mark_attendance", {
      employeeId: att.employeeId || att.employee_id,
      date: att.date,
      inTime: att.inTime || att.in_time,
      outTime: att.outTime || att.out_time,
      hoursWorked: Number(att.hoursWorked ?? att.hours_worked ?? 8.0),
      isLate: Boolean(att.isLate ?? att.is_late),
      source: att.source || "WEB_PORTAL",
    }),
  getAttendanceRecords: () => safeInvoke<AttendanceView[]>("get_attendance_records"),

  // Auto-Update
  downloadAndroidApk: (apkUrl: string) =>
    safeInvoke<string>("download_android_apk", { apkUrl }),
  checkInstallPermission: () =>
    safeInvoke<boolean>("check_install_permission"),
  installAndroidApk: (filePath: string) =>
    safeInvoke<boolean>("install_android_apk", { filePath }),
};
