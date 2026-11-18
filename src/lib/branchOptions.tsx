import React from 'react'
import { sortBranches } from '@/utils/branchOrder'

/**
 * Branch selectors show branches grouped by company, and inside a company each
 * premiere (or standalone branch) followed by its own pickup points:
 *
 *   PT SUMBER CEMERLANG MANDIRI
 *     OUTLET DEPOK
 *       ↳ PP DEPOK 1
 *     OUTLET BINTARO
 *   PT LAIN
 *     ...
 *
 * Load branches with `include: 'company'` so the company name is known (without
 * it the group falls back to "Company #<id>"), and load the whole list (it is
 * small — ~30 branches) so a pickup point and its premiere are both present.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- branch rows are loosely typed API records
export type BranchRow = any

export interface OrderedBranch<T = BranchRow> {
  branch: T
  /** Company name, the group header. */
  company: string
  /** 0 = premiere / standalone branch, 1 = pickup point under its premiere. */
  indent: number
}

const companyName = (b: BranchRow) =>
  b?.company?.name ?? (b?.company_id ? `Company #${b.company_id}` : 'Other')

/** Branches ordered company → premiere → its pickup points (see file comment). */
export function orderBranches<T = BranchRow>(branches: readonly T[] | null | undefined): OrderedBranch<T>[] {
  // Business order first (src/utils/branchOrder.ts: Cibubur, Depok, Bintaro, Meruyung, each
  // with its pickup points in the client's order); grouping below keeps that order.
  const list = sortBranches(((branches ?? []) as BranchRow[]).filter(Boolean)) as T[]
  const byCompany = new Map<string, T[]>()
  for (const b of list) {
    const key = companyName(b)
    if (!byCompany.has(key)) byCompany.set(key, [])
    byCompany.get(key)!.push(b)
  }

  const out: OrderedBranch<T>[] = []
  // Companies in order of first appearance (Map keeps insertion order).
  const companies = Array.from(byCompany.keys())
  for (const company of companies) {
    const rows = byCompany.get(company)!
    const ids = new Set(rows.map((b) => Number((b as BranchRow).id)))
    // A pickup point nests under its parent when that parent is in this company's list.
    const isChild = (row: T) => {
      const b = row as BranchRow
      return b?.parent_id != null && ids.has(Number(b.parent_id)) && Number(b.parent_id) !== Number(b.id)
    }
    const roots = rows.filter((b) => !isChild(b))
    for (const root of roots) {
      out.push({ branch: root, company, indent: 0 })
      rows
        .filter((b) => isChild(b) && Number((b as BranchRow).parent_id) === Number((root as BranchRow).id))
        .forEach((child) => out.push({ branch: child, company, indent: 1 }))
    }
  }
  return out
}

const defaultLabel = (b: BranchRow) => (b?.code ? `${b.code} - ${b.name}` : String(b?.name ?? `Branch #${b?.id}`))

/**
 * Options for SearchableSelect / MultiSearchableSelect (they render `group` as a
 * header and `indent` as a nested ↳ row) and for the react-select ui
 * SearchableSelect (same fields). Extra fields from `extra` are merged in.
 */
export function branchSelectOptions<T = BranchRow, O extends object = object>(
  branches: readonly T[] | null | undefined,
  label: (b: T) => string = defaultLabel as (b: T) => string,
  extra?: (b: T) => O,
) {
  return orderBranches(branches).map(({ branch, company, indent }) => ({
    value: Number((branch as BranchRow).id),
    label: label(branch),
    group: company,
    indent,
    ...(extra ? extra(branch) : ({} as O)),
  }))
}

/**
 * <option>s for a native <select> / FilterSelect, grouped in <optgroup>s by
 * company with pickup points indented under their premiere. Put any "All
 * branches" / placeholder <option> before it. `getValue` defaults to the branch id.
 */
export function BranchOptionGroups<T = BranchRow>({
  branches,
  label = defaultLabel as (b: T) => string,
  getValue = ((b: T) => (b as BranchRow).id) as (b: T) => string | number,
  isDisabled,
}: {
  branches: readonly T[] | null | undefined
  label?: (b: T) => string
  getValue?: (b: T) => string | number
  isDisabled?: (b: T) => boolean
}) {
  const ordered = orderBranches(branches)
  const groups: { company: string; rows: OrderedBranch<T>[] }[] = []
  for (const row of ordered) {
    const last = groups[groups.length - 1]
    if (last && last.company === row.company) last.rows.push(row)
    else groups.push({ company: row.company, rows: [row] })
  }
  return (
    <>
      {groups.map((g) => (
        <optgroup key={g.company} label={g.company}>
          {g.rows.map(({ branch, indent }) => (
            <option key={String(getValue(branch))} value={getValue(branch)} disabled={isDisabled?.(branch)}>
              {indent > 0 ? `   ↳ ${label(branch)}` : label(branch)}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  )
}

/**
 * The logged-in user's assigned branches (auth/me `branches`, which carry only
 * id and name) swapped for their full rows from the branch list (company,
 * parent_id, format), so they group and nest like everyone else's. Only the
 * user's own branches are returned; any not found in the list stay as they are.
 */
export function withBranchDetails<T = BranchRow>(
  userBranches: readonly T[] | null | undefined,
  allBranches: readonly BranchRow[] | null | undefined,
  /** Company of the user's active branch, used when the full list can't be read (no branch.read). */
  fallbackCompany?: { id?: number; name?: string } | null,
): T[] {
  const full = new Map<number, BranchRow>()
  for (const b of allBranches ?? []) if (b?.id != null) full.set(Number(b.id), b)
  return ((userBranches ?? []) as BranchRow[]).map((b) => {
    const found = full.get(Number(b?.id))
    if (found) return found as T
    return (b?.company || !fallbackCompany ? b : { ...b, company: fallbackCompany, company_id: b?.company_id ?? fallbackCompany.id }) as T
  })
}
