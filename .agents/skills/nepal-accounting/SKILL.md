---
name: nepal-accounting
description: >-
  Use this skill when implementing or modifying double-entry accounting transactions,
  Nepal tax compliance (13% VAT, TDS withholding rates), IRD statutory registers
  (Sales Book बिक्री खाता, Purchase Book खरिद खाता), and daily cash book operations.
---

# Nepal Accounting & Tax Compliance Skill

This skill outlines the strict rules and standards required for financial accounting in compliance with Nepal accounting standards (NAS/NFRS) and Inland Revenue Department (IRD) regulations.

## 1. Double-Entry Invariance & Integer Paisa Arithmetic
Every financial action (sales invoice, purchase bill, operating expense, customer collection, vendor payment) MUST post balanced journal items through an automated posting service:
$$\sum \text{Debits} == \sum \text{Credits}$$

> **Critical Rule**: All ledger computations and database storage MUST use **Integer Paisa** ($1\text{ NPR} = 100\text{ Paisa}$). Floating-point types (`f64`, `f32`, `REAL`) are strictly prohibited in ledger arithmetic to prevent IEEE-754 decimal drift. Tax basis points are used for percentages (e.g., $13\% = 1300\text{ bps}$, $10\% = 1000\text{ bps}$).

### Standard Chart of Accounts (COA) Codes
- **1000–1999 (Assets)**: 1010 Cash in Hand, 1020 Bank Accounts, 1030 Accounts Receivable, 1040 Inventory.
- **2000–2999 (Liabilities)**: 2010 Accounts Payable, 2020 VAT Payable, 2030 TDS Payable, 2040 Short-term Loans.
- **3000–3999 (Equity)**: 3010 Share Capital, 3020 Retained Earnings.
- **4000–4999 (Income)**: 4010 Sales Revenue, 4020 Service Revenue, 4030 Other Income.
- **5000–5999 (Expenses)**: 5010 Cost of Goods Sold (COGS), 5020 Salaries, 5030 Rent, 5040 Utilities.

---

## 2. Nepal Tax: 13% VAT Rules

- **Standard Rate**: Exactly **13%** on taxable items.
- **Exempt Items**: Must be tagged as `is_vat_exempt = true` with 0% tax.
- **Formula**:
  $$\text{Taxable Amount} = \text{Gross Amount} - \text{Discount}$$
  $$\text{VAT (13\%)} = \text{Taxable Amount} \times 0.13$$
  $$\text{Grand Total} = \text{Taxable Amount} + \text{Exempt Amount} + \text{VAT}$$
- **Output VAT**: Collected on sales (credit `VAT Payable`).
- **Input VAT**: Paid on eligible purchases (debit `VAT Receivable` / offset `VAT Payable`).
- **Net VAT Liability**: $\text{Output VAT} - \text{Input VAT}$.

---

## 3. Tax Deducted at Source (TDS) Withholding

When recording operating expenses, TDS must be deducted according to Nepal law:
- **Office Rent**: **10%**
- **Consultant / Professional Fees**: **15%**
- **Contract Works / PAN Goods (> NPR 50,000)**: **1.5%**

### Journal Posting Example (Office Rent NPR 50,000)
- **Debit**: Rent Expense (5030) = NPR 50,000
- **Credit**: TDS Payable (2030) = NPR 5,000 (10%)
- **Credit**: Bank / Accounts Payable = NPR 45,000

---

## 4. Statutory IRD Registers

### A. Sales Book (बिक्री खाता)
Required columns:
1. Date (Miti / AD)
2. Invoice Number
3. Buyer Name
4. Buyer PAN Number
5. Total Sales Value
6. Exempt Sales Value
7. Taxable Sales Value
8. 13% VAT Amount

### B. Purchase Book (खरिद खाता)
Required columns:
1. Date (Miti / AD)
2. Bill / Invoice Number
3. Supplier Name
4. Supplier PAN Number
5. Total Purchase Value
6. Exempt Purchase Value
7. Taxable Purchase Value
8. 13% Input VAT Amount

---

## 5. Daily Cash Book & Contra Bank Transfers
- **Contra Transfers**: Transferring cash to a bank or between bank accounts moves funds between Asset accounts (e.g., Credit Cash 1010, Debit Bank 1020). It MUST NEVER touch income or expense accounts.
- **Daily Reconciliation**: $\text{Closing Balance} = \text{Opening Balance} + \text{Cash In} - \text{Cash Out}$.
