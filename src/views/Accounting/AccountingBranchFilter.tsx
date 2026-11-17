'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { branchesService } from '@/services/branches.service'
import { FilterSelect } from '@/components/ListFilters'

/**
 * Accounting is run by the company's head office: the journal, cash
 * transaction and budget lists show every branch of the active company
 * (backend: CompanyBranchesScopeMiddleware) and narrow with
 * `filter[branch_id]` (one id or a comma list). Documents stay per branch,
 * and the API only edits / posts / deletes them on their own branch.
 */

interface CompanyBranch {
  id: number
  name: string
  format?: string | null
  parentId?: number | null
}

/** Branches of the active branch's company, in business order (branchesService sorts them). */
export function useAccountingBranches(): CompanyBranch[] {
  const { user } = useAuth()
  const companyId = (user as any)?.branch?.company?.id ?? (user as any)?.branch?.company_id

  const { data } = useQuery({
    queryKey: ['branches-all', 'accounting', companyId],
    enabled: !!companyId,
    staleTime: 60_000,
    queryFn: () =>
      branchesService.list({ per_page: 100, 'filter[company_id]': companyId } as any).then((r) => r.data),
  })

  const listed: any[] = (data as any)?.data ?? []
  const own: any[] = ((user as any)?.branches ?? []).filter(
    (b: any) => !companyId || (b?.company_id ?? b?.company?.id ?? companyId) === companyId
  )
  return (listed.length > 0 ? listed : own)
    .filter((b: any) => b?.id != null)
    .map((b: any) => ({
      id: Number(b.id),
      name: b.name ?? `Branch ${b.id}`,
      format: b.format ?? null,
      parentId: b.parent_id != null ? Number(b.parent_id) : null,
    }))
}

/** `filter[branch_id]` list param ('' = whole company, nothing sent). */
export function accountingBranchParam(value: string): { 'filter[branch_id]'?: string } {
  return value ? { 'filter[branch_id]': value } : {}
}

/** Branch name of a row, from its `branch` include or the company branch list. */
export function useBranchNameOf() {
  const branches = useAccountingBranches()
  return (item: { branch_id?: number | null; branch?: { name?: string } | null }) =>
    item?.branch?.name ?? branches.find((b) => b.id === Number(item?.branch_id))?.name ?? '—'
}

/**
 * Reason a row can't be changed from here (it belongs to another branch), or
 * null. The API scopes writes to the active branch, so switch branch first.
 */
export function useOtherBranchBlock() {
  const { user } = useAuth()
  const activeId = Number((user as any)?.branch?.id) || 0
  const nameOf = useBranchNameOf()
  return (item: { branch_id?: number | null; branch?: { name?: string } | null }): string | null => {
    if (!activeId || item?.branch_id == null || Number(item.branch_id) === activeId) return null
    return `Belongs to ${nameOf(item)} — switch to that branch to change it`
  }
}

/**
 * Branch filter: whole company, an outlet with its pickup points, or one
 * branch. Emits '' or a `filter[branch_id]` value ("12" or "12,30,31").
 */
export default function AccountingBranchFilter({
  value,
  onChange,
  style,
}: {
  value: string
  onChange: (value: string) => void
  style?: React.CSSProperties
}) {
  const branches = useAccountingBranches()
  const premieres = branches.filter((b) => b.format !== 'pickup_point')
  const premiereIds = new Set(premieres.map((b) => b.id))
  const childrenOf = (id: number) => branches.filter((b) => b.format === 'pickup_point' && b.parentId === id)
  const orphans = branches.filter(
    (b) => b.format === 'pickup_point' && !(b.parentId != null && premiereIds.has(b.parentId))
  )

  return (
    <FilterSelect value={value} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 240, ...style }}>
      <option value="">All branches</option>
      {premieres.map((p) => {
        const children = childrenOf(p.id)
        if (children.length === 0) return <option key={p.id} value={String(p.id)}>{p.name}</option>
        return (
          <optgroup key={p.id} label={p.name}>
            <option value={[p.id, ...children.map((c) => c.id)].join(',')}>{p.name} (+ pickup point)</option>
            <option value={String(p.id)}>{p.name} only</option>
            {children.map((c) => (
              <option key={c.id} value={String(c.id)}>{'  ↳ '}{c.name}</option>
            ))}
          </optgroup>
        )
      })}
      {orphans.length > 0 && (
        <optgroup label="Pickup point">
          {orphans.map((b) => (
            <option key={b.id} value={String(b.id)}>{b.name}</option>
          ))}
        </optgroup>
      )}
    </FilterSelect>
  )
}
