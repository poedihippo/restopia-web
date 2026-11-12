import { chartOfAccountsService } from '@/services/accounting.service'

// Postable expense accounts, e.g. Biaya Admin Bank / MDR, for a settlement fee.
// A category is an expense when its statement_type is income_statement with a
// debit normal balance (credit is revenue), or a legacy 'expense' — the rule
// the reports and the API use. An unclassified category is kept, matching the
// API, which only refuses a classified non-expense account.
export function fetchExpenseAccounts(): Promise<any[]> {
  return chartOfAccountsService
    .list({
      per_page: 1000,
      sort: 'code',
      include: 'account_type',
      'filter[is_header]': 'false',
      'filter[is_active]': 'true',
      'filter[normal_balance]': 'debit',
    } as any)
    .then((r) => ((r.data as any)?.data ?? []) as any[])
    .then((accounts) =>
      accounts.filter((c) => {
        const category = c.account_type?.account_category
        const statementType = category?.statement_type
        if (!statementType) return true
        if (statementType === 'expense') return true
        return statementType === 'income_statement' && category.normal_balance !== 'credit'
      }),
    )
}
