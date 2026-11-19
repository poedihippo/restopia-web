'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { branchesService } from '@/services/branches.service'
import { FilterSelect } from '@/components/ListFilters'
import { orderBranches } from '@/lib/branchOptions'

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
  /** Raw fields read by orderBranches (company grouping, pickup point nesting). */
  parent_id?: number | null
  company_id?: number | null
  company?: { id?: number; name?: string } | null
}

/** Branches of the active branch's company. */
export function useAccountingBranches(): CompanyBranch[] {
  const { user } = useAuth()
  const companyId = (user as any)?.branch?.company?.id ?? (user as any)?.branch?.company_id

  const { data } = useQuery({
    queryKey: ['branches-all', 'accounting', companyId],
    enabled: !!companyId,
    staleTime: 60_000,
    queryFn: () =>
      branchesService.list({ per_page: 100, include: 'company', 'filter[company_id]': companyId } as any).then((r) => r.data),
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
      parent_id: b.parent_id != null ? Number(b.parent_id) : null,
      company_id: b.company_id ?? b.company?.id ?? null,
      company: b.company ?? null,
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
  // Company → premiere (or standalone branch) → its own pickup points, indented.
  const ordered = orderBranches(branches)
  const groups: { company: string; rows: typeof ordered }[] = []
  for (const row of ordered) {
    const last = groups[groups.length - 1]
    if (last && last.company === row.company) last.rows.push(row)
    else groups.push({ company: row.company, rows: [row] })
  }
  const childrenOf = (id: number) =>
    ordered.filter((r) => r.indent > 0 && r.branch.parentId === id).map((r) => r.branch)

  return (
    <FilterSelect value={value} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 240, ...style }}>
      <option value="">All branches</option>
      {groups.map((g) => (
        <optgroup key={g.company} label={g.company}>
          {g.rows.map(({ branch: b, indent }) => {
            if (indent > 0) {
              return <option key={b.id} value={String(b.id)}>{'\u00A0\u00A0\u00A0↳ '}{b.name}</option>
            }
            const children = childrenOf(b.id)
            if (children.length === 0) return <option key={b.id} value={String(b.id)}>{b.name}</option>
            return (
              <React.Fragment key={b.id}>
                <option value={[b.id, ...children.map((c) => c.id)].join(',')}>{b.name} (+ pickup point)</option>
                <option value={String(b.id)}>{b.name} only</option>
              </React.Fragment>
            )
          })}
        </optgroup>
      ))}
    </FilterSelect>
  )
}
