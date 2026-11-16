import api from '@/hooks/useApi'
import { AxiosResponse } from 'axios'

// GET /v1/reports/general-ledger (JSON, paginated by ACCOUNTS — not by lines).
// Either chart_of_account_id OR the inclusive code range start_coa_code/end_coa_code.
export interface GeneralLedgerParams {
  chart_of_account_id?: number
  start_coa_code?: string
  end_coa_code?: string
  start_date: string
  end_date: string
  /** Branch scope: single id or 'all' (omitted = active branch + pickup points). */
  branch_id?: string
  page?: number
  per_page?: number
}

export interface GeneralLedgerLine {
  journal_id: number
  journal_number: string
  date: string
  type: string
  description: string
  /** Empty string when the source reference is null. */
  reference_type: string
  /** Source document id (with reference_type); absent when the journal has no source. */
  reference_id?: number | null
  normal_balance: 'debit' | 'credit' | string
  debit: number
  credit: number
  /** Running balance for this account, including the current line. */
  balance: number
}

export interface GeneralLedgerAccount {
  chart_of_account_id: number
  chart_of_account_code: string
  chart_of_account_name: string
  normal_balance: 'debit' | 'credit' | string
  /** All matching lines for the requested date range; empty when no data. */
  lines: GeneralLedgerLine[]
  total_debit: number
  total_credit: number
  ending_balance: number
  /** Balance before start_date (normal-balance direction); the first line's running balance builds on it. */
  opening_balance?: number
}

export interface GeneralLedgerResponse {
  start_date: string
  end_date: string
  accounts: GeneralLedgerAccount[]
}

/** Standard API envelope around the general-ledger payload, with account-level pagination meta. */
export interface GeneralLedgerEnvelope {
  success: boolean
  message: string
  data: GeneralLedgerResponse
  meta: {
    current_page?: number
    from?: number
    per_page?: number
    to?: number
    total?: number
    total_pages?: number
  }
}

// GET /v1/reports/ar-aging — piutang invoice + penjualan kredit POS.
// Request YYYY-MM-DD; tanggal di response DD-MM-YYYY.
export interface ArAgingParams {
  start_date?: string
  end_date?: string
  as_of_date?: string
  /** Document code (invoice / sales order) or customer name. */
  'filter[search]'?: string
}

export type AgingBucket = 'current' | '0_30' | '31_60' | '61_90' | '90_plus'

export interface ArAgingLine {
  source_type: 'invoice' | 'sales_order' | string
  source_id: number
  code: string
  date: string
  due_date: string | null
  customer_id: number | null
  customer_name: string | null
  total_price: number
  total_payment: number
  outstanding: number
  age_days: number
  bucket: AgingBucket | string
}

export interface ArAgingResponse {
  start_date: string | null
  end_date: string
  lines: ArAgingLine[]
  buckets: {
    /** Not yet due. */
    bucket_current?: number
    bucket_0_30: number
    bucket_31_60: number
    bucket_61_90: number
    bucket_90_plus: number
  }
  grand_total_outstanding: number
}

// GET /v1/reports/supplier-statements — the AP aging lines still unpaid on
// as_of_date (same data as /supplier-statements/exports).
export interface ApAgingLine {
  purchase_order_id: number
  code: string
  date: string
  due_date: string | null
  supplier_name: string
  total_price: number
  total_payment: number
  outstanding: number
  age_days: number
  bucket: AgingBucket | string
}

export interface ApAgingResponse {
  as_of_date: string
  lines: ApAgingLine[]
  buckets: ArAgingResponse['buckets']
  grand_total_outstanding: number
}

// GET /v1/reports/cash-flow
export interface CashFlowLine {
  activity: string
  debit?: number
  credit?: number
  net: number
}
export interface CashFlowSection {
  lines: CashFlowLine[]
  subtotal: number
}
export interface CashFlowResponse {
  start_date: string
  end_date: string
  operating: CashFlowSection
  investing: CashFlowSection
  financing: CashFlowSection
  net_increase: number
  begin_balance: number
  end_balance: number
}

// GET /v1/reports/tax-report
export interface TaxReportLine {
  type: 'output' | 'input' | string
  /** Journal number. */
  reference: string
  date: string
  taxable_base: number
  tax_rate: number
  tax_amount: number
}
export interface TaxReportResponse {
  start_date: string
  end_date: string
  lines: TaxReportLine[]
  total_output: number
  total_input: number
  total_payable: number
}

// GET /v1/reports/budget-vs-actual — variance is signed: positive = favourable.
export interface BudgetVsActualLine {
  code: string
  name: string
  budget: number
  actual: number
  variance: number
  variance_pct: number
}
export interface BudgetVsActualResponse {
  period_id: number
  period_name: string
  lines: BudgetVsActualLine[]
  total_budget: number
  total_actual: number
  total_variance: number
}

type Envelope<T> = { success: boolean; message: string; data: T }

export const reportsService = {
  // Core Financial Statements
  exportIncomeStatement: (params: { start_date: string; end_date: string; branch_id?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/income-statement/exports', { params, responseType: 'blob' }),

  exportBalanceSheet: (params?: { as_of_date?: string; branch_id?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/balance-sheet/exports', { params, responseType: 'blob' }),

  exportTrialBalance: (params: { period_id: number; branch_id?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/trial-balance/exports', { params, responseType: 'blob' }),

  // JSON report (the old /reports/general-ledger/exports Excel endpoint was removed backend-side)
  getGeneralLedger: (params: GeneralLedgerParams): Promise<AxiosResponse<GeneralLedgerEnvelope>> =>
    api.get('/reports/general-ledger', { params }),

  getCashFlow: (params: { start_date: string; end_date: string; branch_id?: string }): Promise<AxiosResponse<Envelope<CashFlowResponse>>> =>
    api.get('/reports/cash-flow', { params }),

  getTaxReport: (params: { start_date: string; end_date: string; branch_id?: string }): Promise<AxiosResponse<Envelope<TaxReportResponse>>> =>
    api.get('/reports/tax-report', { params }),

  getBudgetVsActual: (params: { period_id: number; branch_id?: string }): Promise<AxiosResponse<Envelope<BudgetVsActualResponse>>> =>
    api.get('/reports/budget-vs-actual', { params }),

  exportCashFlow: (params: { start_date: string; end_date: string; branch_id?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/cash-flow/exports', { params, responseType: 'blob' }),

  // Comparative & Cards Reports
  exportComparativeIncomeStatement: (params?: { fiscal_year_id?: number; year?: number; start_date?: string; end_date?: string; branch_id?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/comparative-income-statement/exports', { params, responseType: 'blob' }),

  exportComparativeBalanceSheet: (params?: { fiscal_year_id?: number; year?: number; as_of_date?: string; branch_id?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/comparative-balance-sheet/exports', { params, responseType: 'blob' }),

  exportArCard: (params: { customer_id?: number; start_date: string; end_date: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/ar-cards/exports', { params, responseType: 'blob' }),

  exportApCard: (params: { supplier_id?: number; supplier?: string; start_date: string; end_date: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/ap-cards/exports', { params, responseType: 'blob' }),

  // Purchasing Reports
  exportPurchaseProducts: (params?: { start_date?: string; end_date?: string; 'filter[supplier]'?: string; 'filter[category_id]'?: number; 'filter[status]'?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/purchase-products/exports', { params, responseType: 'blob' }),

  exportSupplierPurchases: (params?: { start_date?: string; end_date?: string; 'filter[supplier]'?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/supplier-purchases/exports', { params, responseType: 'blob' }),

  exportPurchaseInvoices: (params?: { start_date?: string; end_date?: string; 'filter[supplier]'?: string; 'filter[status]'?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/purchase-invoices/exports', { params, responseType: 'blob' }),

  // Inventory & Sales Reports
  exportStockPositions: (params?: { as_of_date?: string; 'filter[category_id]'?: number; 'filter[branch_id]'?: number; 'filter[is_low_stock]'?: number }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/stock-positions/exports', { params, responseType: 'blob' }),

  exportStockCards: (params: { product_id: number; start_date?: string; end_date?: string; 'filter[branch_id]'?: number; 'filter[product_types]'?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/stock-cards/exports', { params, responseType: 'blob' }),

  exportSalesProducts: (params?: { start_date?: string; end_date?: string; 'filter[branch_id]'?: number; 'filter[category_id]'?: number }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/sales-products/exports', { params, responseType: 'blob' }),

  exportSalesInvoices: (params?: { start_date?: string; end_date?: string; 'filter[branch_id]'?: number; 'filter[status]'?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/sales-invoices/exports', { params, responseType: 'blob' }),

  exportOutletTransactions: (params?: { start_date?: string; end_date?: string; 'filter[branch_id]'?: number }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/outlet-transactions/exports', { params, responseType: 'blob' }),

  // Aging & Statements
  getArAging: (params?: ArAgingParams): Promise<AxiosResponse<{ success: boolean; message: string; data: ArAgingResponse }>> =>
    api.get('/reports/ar-aging', { params }),
  // No AR aging export endpoint any more — the view builds the Excel file from getArAging's JSON.

  exportApAging: (params?: { as_of_date?: string; 'filter[search]'?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/ap-aging/exports', { params, responseType: 'blob' }),

  /** JSON twin of exportCustomerStatements (open receivables of one customer). */
  getCustomerStatement: (params: { customer_id: number; as_of_date?: string }): Promise<AxiosResponse<{ success: boolean; message: string; data: ArAgingResponse }>> =>
    api.get('/reports/customer-statements', { params }),

  /** JSON twin of exportSupplierStatements; `supplier` = exact name (case-insensitive), `supplier_id` wins when given. */
  getSupplierStatement: (params: { supplier?: string; supplier_id?: number; as_of_date?: string }): Promise<AxiosResponse<{ success: boolean; message: string; data: ApAgingResponse }>> =>
    api.get('/reports/supplier-statements', { params }),

  exportCustomerStatements: (params: { customer_id: number; as_of_date?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/customer-statements/exports', { params, responseType: 'blob' }),

  exportSupplierStatements: (params: { supplier?: string; supplier_id?: number; as_of_date?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/supplier-statements/exports', { params, responseType: 'blob' }),

  // Tax & Budget
  exportTaxReport: (params: { start_date: string; end_date: string; branch_id?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/tax-report/exports', { params, responseType: 'blob' }),

  exportBudgetVsActual: (params: { period_id: number; branch_id?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/budget-vs-actual/exports', { params, responseType: 'blob' }),

  // Data Dumps
  // Same filters as GET /v1/payments (filter[date_gte], filter[type], …) so the
  // download matches the on-screen Payments Report.
  exportPayments: (params?: Record<string, string | number | undefined>): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/payments/exports', { params, responseType: 'blob' }),

  // Reads the same filter[...] keys as GET /v1/journals (bare start_date/is_posted are ignored).
  exportJournalEntries: (params?: { 'filter[date_gte]'?: string; 'filter[date_lte]'?: string; 'filter[is_posted]'?: boolean; 'filter[branch_id]'?: number }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/journal-entries/exports', { params, responseType: 'blob' }),

  exportBudgets: (params?: { period_id?: number }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/budgets/exports', { params, responseType: 'blob' }),

  exportJournals: (): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/journal-entries/exports', { responseType: 'blob' }),

  // Master Data Reference
  exportChartOfAccounts: (): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/chart-of-accounts/exports', { responseType: 'blob' }),

  exportAccountCategories: (): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/account-categories/exports', { responseType: 'blob' }),

  exportAccountTypes: (): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/account-types/exports', { responseType: 'blob' }),

  exportAccountSettings: (): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/account-settings/exports', { responseType: 'blob' }),

  exportFiscalYears: (): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/fiscal-years/exports', { responseType: 'blob' }),

  exportPeriods: (): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/periods/exports', { responseType: 'blob' }),

  exportTaxes: (): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/taxes/exports', { responseType: 'blob' }),
}
