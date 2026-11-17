'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { branchesService } from '@/services/branches.service'
import { orderBranches } from '@/lib/branchOptions'

/**
 * Branch scope of a financial statement (trial balance, income statement,
 * balance sheet, cash flow) — sent as `branch_id`:
 *   ''      → active branch + its pickup points (backend default, param omitted)
 *   'all'   → every branch of the active company
 *   '<id>'  → that branch + its own pickup points (a pickup point is itself)
 */
export type FinanceBranchScope = string

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

/** Branches of the active branch's company; falls back to the user's own branches. */
function useCompanyBranches(): CompanyBranch[] {
  const { user, hasPermission, isSuperadmin } = useAuth()
  const companyId = (user as any)?.branch?.company?.id ?? (user as any)?.branch?.company_id
  const canListBranches = isSuperadmin || hasPermission('branch.read')

  const { data } = useQuery({
    queryKey: ['branches-all', 'finance-report', companyId],
    enabled: !!companyId && canListBranches,
    staleTime: 60_000,
    queryFn: () =>
      branchesService
        .list({ per_page: 1000, sort: 'name', include: 'company', 'filter[company_id]': companyId } as any)
        .then((r) => r.data),
  })

  const listed: any[] = (data as any)?.data ?? []
  const own: any[] = ((user as any)?.branches ?? []).filter(
    (b: any) => !companyId || (b?.company_id ?? b?.company?.id ?? companyId) === companyId
  )
  const source = listed.length > 0 ? listed : own
  return source
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

/** Human label of a scope, for the report subtitle / printout. */
export function useFinanceBranchLabel(scope: FinanceBranchScope): string {
  const { user } = useAuth()
  const branches = useCompanyBranches()
  if (scope === 'all') return 'Semua cabang'
  if (!scope) {
    const active = (user as any)?.branch?.name
    return active ? `${active} (+ pickup point)` : 'Cabang aktif (+ pickup point)'
  }
  const branch = branches.find((b) => String(b.id) === scope)
  if (!branch) return `Cabang #${scope}`
  return branch.format === 'pickup_point' ? branch.name : `${branch.name} (+ pickup point)`
}

/** `branch_id` request param for a scope ('' sends nothing). */
export function financeBranchParam(scope: FinanceBranchScope): { branch_id?: string } {
  return scope ? { branch_id: scope } : {}
}

export default function FinanceBranchSelect({
  value,
  onChange,
  style,
}: {
  value: FinanceBranchScope
  onChange: (scope: FinanceBranchScope) => void
  style?: React.CSSProperties
}) {
  const { user } = useAuth()
  const branches = useCompanyBranches()
  const activeId = (user as any)?.branch?.id != null ? String((user as any).branch.id) : ''
  const activeName = (user as any)?.branch?.name
  const activeListed = !!activeId && branches.some((b) => String(b.id) === activeId)

  // Company → each premiere with its own pickup points under it; picking the
  // premiere reports it together with them, picking a pickup point reports it alone.
  const ordered = orderBranches(branches)
  const groups: { company: string; rows: typeof ordered }[] = []
  for (const row of ordered) {
    const last = groups[groups.length - 1]
    if (last && last.company === row.company) last.rows.push(row)
    else groups.push({ company: row.company, rows: [row] })
  }

  // The default ('' = no param) is the active branch + its pickup points, so show it
  // as that branch's own option instead of a separate duplicate entry.
  const selected = value || (activeListed ? activeId : '')

  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value === activeId ? '' : e.target.value)}
      style={{ cursor: 'pointer', minWidth: 240, ...style }}
    >
      {!activeListed && (
        <option value="">{activeName ? `${activeName} (+ pickup point)` : 'Cabang aktif (+ pickup point)'}</option>
      )}
      <option value="all">Semua cabang</option>
      {groups.map((g) => (
        <optgroup key={g.company} label={g.company}>
          {g.rows.map(({ branch: b, indent }) => (
            <option key={b.id} value={String(b.id)}>
              {indent > 0
                ? `\u00A0\u00A0\u00A0↳ ${b.name}`
                : b.format === 'pickup_point'
                  ? b.name
                  : `${b.name} (+ pickup point)`}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
