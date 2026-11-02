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
}

export type AgingBucket = '0_30' | '31_60' | '61_90' | '90_plus'

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
    bucket_0_30: number
    bucket_31_60: number
    bucket_61_90: number
    bucket_90_plus: number
  }
  grand_total_outstanding: number
}

export const reportsService = {
  // Core Financial Statements
  exportIncomeStatement: (params: { start_date: string; end_date: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/income-statement/exports', { params, responseType: 'blob' }),

  exportBalanceSheet: (params?: { as_of_date?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/balance-sheet/exports', { params, responseType: 'blob' }),

  exportTrialBalance: (params: { period_id: number }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/trial-balance/exports', { params, responseType: 'blob' }),

  // JSON report (the old /reports/general-ledger/exports Excel endpoint was removed backend-side)
  getGeneralLedger: (params: GeneralLedgerParams): Promise<AxiosResponse<GeneralLedgerEnvelope>> =>
    api.get('/reports/general-ledger', { params }),

  exportCashFlow: (params: { start_date: string; end_date: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/cash-flow/exports', { params, responseType: 'blob' }),

  // Comparative & Cards Reports
  exportComparativeIncomeStatement: (params?: { fiscal_year_id?: number; year?: number; start_date?: string; end_date?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/comparative-income-statement/exports', { params, responseType: 'blob' }),

  exportComparativeBalanceSheet: (params?: { fiscal_year_id?: number; year?: number; as_of_date?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/comparative-balance-sheet/exports', { params, responseType: 'blob' }),

  exportArCard: (params: { customer_id: number; start_date?: string; end_date?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/ar-cards/exports', { params, responseType: 'blob' }),

  exportApCard: (params: { supplier: string; start_date?: string; end_date?: string }): Promise<AxiosResponse<Blob>> =>
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

  exportApAging: (params?: { as_of_date?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/ap-aging/exports', { params, responseType: 'blob' }),

  exportCustomerStatements: (params: { customer_id: number; as_of_date?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/customer-statements/exports', { params, responseType: 'blob' }),

  exportSupplierStatements: (params: { supplier?: string; as_of_date?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/supplier-statements/exports', { params, responseType: 'blob' }),

  // Tax & Budget
  exportTaxReport: (params: { start_date: string; end_date: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/tax-report/exports', { params, responseType: 'blob' }),

  exportBudgetVsActual: (params: { period_id: number }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/budget-vs-actual/exports', { params, responseType: 'blob' }),

  // Data Dumps
  exportPayments: (params?: { start_date?: string; end_date?: string; type?: 'payable' | 'receivable' }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/payments/exports', { params, responseType: 'blob' }),

  exportJournalEntries: (params?: { start_date?: string; end_date?: string; is_posted?: boolean }): Promise<AxiosResponse<Blob>> =>
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
