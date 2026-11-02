'use client'

import React from 'react'
import { useAuth } from '@/hooks/useAuth'

/** Branches the logged-in user can report on, as returned by auth/me (`branches`). */
export function useReportBranches(): { id: number; name: string }[] {
  const { user } = useAuth()
  const list: any[] = (user as any)?.branches ?? []
  const own = (user as any)?.branch
  // Older sessions may lack `branches`; fall back to the active branch.
  const branches = list.length > 0 ? list : own ? [own] : []
  return branches
    .filter((b: any) => b?.id != null)
    .map((b: any) => ({ id: Number(b.id), name: b.name ?? `Branch ${b.id}` }))
}

/** Display name for the selected branch id ('' = all branches). */
export function useReportBranchName(branchId: string): string {
  const branches = useReportBranches()
  if (!branchId) return 'All Branches'
  return branches.find((b) => String(b.id) === branchId)?.name ?? 'All Branches'
}

/**
 * Branch picker for report filters: shows branch names, emits the branch id
 * (as a string, '' for all branches — superadmin only).
 */
export default function ReportBranchSelect({
  value,
  onChange,
  style,
}: {
  value: string
  onChange: (branchId: string) => void
  style?: React.CSSProperties
}) {
  const { isSuperadmin } = useAuth()
  const branches = useReportBranches()

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ cursor: 'pointer', minWidth: 180, ...style }}
    >
      {isSuperadmin && <option value="">All Branches</option>}
      {!isSuperadmin && branches.length === 0 && <option value="">—</option>}
      {branches.map((b) => (
        <option key={b.id} value={String(b.id)}>
          {b.name}
        </option>
      ))}
    </select>
  )
}
