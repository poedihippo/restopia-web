import { useEffect, useMemo } from 'react'
import { chartOfAccountsService } from '@/services/accounting.service'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'

// Postable expense accounts, e.g. Biaya Admin Bank / MDR, for a settlement fee.
// A category is an expense when its statement_type is income_statement with a
// debit normal balance (credit is revenue), or a legacy 'expense' — the rule
// the reports and the API use. An unclassified category is kept, matching the
// API, which only refuses a classified non-expense account.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosely typed API record
export function isExpenseAccount(c: any): boolean {
  const category = c?.account_type?.account_category
  const statementType = category?.statement_type
  if (!statementType) return true
  if (statementType === 'expense') return true
  return statementType === 'income_statement' && category.normal_balance !== 'credit'
}

/**
 * One page (20 rows) of active, postable, debit-balance accounts. The API has no
 * statement-type filter, so the expense-category rule (isExpenseAccount) is applied
 * by the caller to each page's rows; the response body (`r.data`, with meta) is
 * returned untouched so paging continues past pages that yield no expense rows.
 */
export function fetchExpenseAccountsPage(page: number, search?: string): Promise<unknown> {
  return chartOfAccountsService
    .list({
      page,
      per_page: 20,
      sort: 'code,id',
      include: 'account_type',
      'filter[is_header]': 'false',
      'filter[is_active]': 'true',
      'filter[normal_balance]': 'debit',
      'filter[search]': search || undefined,
    } as any)
    .then((r) => r.data)
}

/**
 * Paged expense-account source for SearchableSelect: `items` are the expense rows
 * of the loaded pages; spread `selectProps` and pass `loading`. Because the first
 * debit pages are usually assets (filtered out), it keeps loading pages until at
 * least `minVisible` expense rows are shown or the list is exhausted, so the
 * dropdown never opens empty with nothing to scroll.
 */
export function useExpenseAccountOptions({
  queryKey,
  search,
  enabled = true,
  minVisible = 20,
}: {
  queryKey: unknown[]
  search: string
  enabled?: boolean
  minVisible?: number
}) {
  const opts = useInfiniteOptions<any>({
    queryKey: [...queryKey, search],
    fetchPage: (page) => fetchExpenseAccountsPage(page, search),
    enabled,
  })
  const items = useMemo(() => opts.items.filter(isExpenseAccount), [opts.items])
  const { hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = opts
  useEffect(() => {
    // Stop on a failed page: hasNextPage stays true after an error, so without
    // this the effect would re-request the failing page forever.
    if (enabled && items.length < minVisible && hasNextPage && !isFetching && !isFetchNextPageError) fetchNextPage()
  }, [enabled, items.length, minVisible, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage])

  return {
    items,
    loading: opts.loading || (items.length === 0 && !!hasNextPage),
    selectProps: opts.selectProps,
  }
}
