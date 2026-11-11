import { useAuth } from '@/hooks/useAuth'

/** Branch types that see their whole company's invoices and supplier debts. */
export const CENTRAL_BRANCH_TYPES = ['warehouse', 'production']

/**
 * When the active branch is a warehouse or production branch, the invoice and
 * supplier-debt reads ask the API for the whole company (`scope=company`) and
 * the pages offer a branch filter. The API applies the same branch-type rule,
 * so an outlet sending it changes nothing; outlets keep their own branch.
 */
export function useCentralCompanyScope() {
  const { user } = useAuth()
  const branch = (user as any)?.branch as { id?: number; type?: string } | undefined
  const isCentral = CENTRAL_BRANCH_TYPES.includes(branch?.type ?? '')

  return {
    isCentral,
    activeBranchId: Number(branch?.id) || 0,
    /** Spread into list/detail params: `{ scope: 'company' }` or nothing. */
    scopeParams: isCentral ? { scope: 'company' as const } : {},
  }
}
