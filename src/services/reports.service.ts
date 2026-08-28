import api from '@/hooks/useApi'
import { AxiosResponse } from 'axios'

export const reportsService = {
  // Core Financial Statements
  exportIncomeStatement: (params: { start_date: string; end_date: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/income-statement/exports', { params, responseType: 'blob' }),

  exportBalanceSheet: (params?: { as_of_date?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/balance-sheet/exports', { params, responseType: 'blob' }),

  exportTrialBalance: (params: { period_id: number }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/trial-balance/exports', { params, responseType: 'blob' }),

  exportGeneralLedger: (params: { chart_of_account_id: number; start_date: string; end_date: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/general-ledger/exports', { params, responseType: 'blob' }),

  exportCashFlow: (params: { start_date: string; end_date: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/cash-flow/exports', { params, responseType: 'blob' }),

  // Aging & Statements
  exportArAging: (params?: { as_of_date?: string }): Promise<AxiosResponse<Blob>> =>
    api.get('/reports/ar-aging/exports', { params, responseType: 'blob' }),

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
