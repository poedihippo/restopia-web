/**
 * Breadcrumbs that follow the sidebar menu (NAV_GROUPS), not the URL.
 *
 * The URL path is not the menu: Invoices live at /transfer/invoices but sit
 * under Billing & Invoicing → Invoicing in the sidebar, and many path segments
 * (/transfer, /purchase, /accounting/reports) have no page of their own. So
 * the trail is:
 *
 *   Dashboard › <group> › <parent item> › <menu page> › <page kind>
 *   Dashboard › Billing & Invoicing › Invoicing › Invoices › Detail
 *
 * - Menu names are used exactly as the sidebar shows them (some menus are
 *   deliberately Indonesian, e.g. "Kartu Stok"); only group titles, which the
 *   sidebar shows in capitals, are title-cased.
 * - The words added here for the page kind (Detail, Edit, Create, …) are
 *   always English.
 * - Only crumbs that are real pages get an href; group and parent-folder
 *   crumbs are plain text.
 * - Consecutive duplicates are merged ("Purchase Orders › Purchase Orders").
 * - A page the menu does not know falls back to the URL-derived trail.
 */

import type { NavGroup } from '@/components/app-sidebar'

export interface Crumb {
  label: string
  /** Absent for crumbs that are not pages (menu groups and folders). */
  href?: string
}

type Query = Record<string, string | string[] | undefined>

interface MenuEntry {
  path: string
  query: URLSearchParams
  href: string
  trail: Crumb[]
}

const DASHBOARD: Crumb = { label: 'Dashboard', href: '/dashboard' }

/** English labels for the page-kind segments after a menu page. */
const PAGE_KIND: Record<string, string> = {
  create: 'Create',
  new: 'Create',
  edit: 'Edit',
  detail: 'Detail',
  fulfill: 'Fulfill',
  receive: 'Receive',
  credit: 'Credit',
  'credit-report': 'Credit Report',
  '404': 'Page Not Found',
  '500': 'Server Error',
}

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/(^|[\s/&-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}

function segmentLabel(segment: string): string {
  return PAGE_KIND[segment] ?? titleCase(segment.replace(/-/g, ' '))
}

const isDynamic = (segment: string) => /^\[.+\]$/.test(segment) || (/^\d+$/.test(segment) && !PAGE_KIND[segment])

function menuEntries(groups: NavGroup[]): MenuEntry[] {
  const entries: MenuEntry[] = []
  const add = (href: string, trail: Crumb[]) => {
    const [path, search = ''] = href.split('?')
    entries.push({ path, query: new URLSearchParams(search), href, trail })
  }

  for (const group of groups) {
    const groupCrumb: Crumb = { label: titleCase(group.title) }
    for (const item of group.items) {
      if (item.href) add(item.href, [groupCrumb, { label: item.label, href: item.href }])
      for (const child of item.children ?? []) {
        const parent: Crumb = item.href ? { label: item.label, href: item.href } : { label: item.label }
        add(child.href, [groupCrumb, parent, { label: child.label, href: child.href }])
      }
    }
  }

  return entries
}

function queryMatches(entry: MenuEntry, query: Query): number {
  let matched = 0
  for (const [key, value] of entry.query.entries()) {
    const current = query[key]
    const currentValue = Array.isArray(current) ? current[0] : current
    if (currentValue !== value) return -1
    matched++
  }
  return matched
}

/**
 * The menu entry for this page: the longest menu path equal to, or a parent
 * of, the current path; among entries with the same path, the one whose query
 * (?type=raw) matches the current one. `exact` is false when the path is a
 * menu page but no entry's query matches (e.g. the inventory list opened
 * without ?type=): the trail then stops at the menu folder ("Stock").
 */
function findEntry(
  entries: MenuEntry[],
  pathname: string,
  query: Query,
): { entry: MenuEntry; exact: boolean } | undefined {
  let best: { entry: MenuEntry; exact: boolean } | undefined
  let bestScore = -1

  for (const entry of entries) {
    const isSelf = pathname === entry.path
    const isParent = entry.path !== '/' && pathname.startsWith(entry.path + '/')
    if (!isSelf && !isParent) continue

    // A parent match ignores the query: /products/product-inventory/stock-opname/[id]
    // must not need ?type=… to find its menu.
    const qm = isSelf ? queryMatches(entry, query) : 0
    const exact = !isSelf || qm >= 0
    const score = entry.path.length * 100 + (isSelf ? 50 : 0) + (exact ? 10 + qm : 0)
    if (score > bestScore) {
      best = { entry, exact }
      bestScore = score
    }
  }

  return best
}

/** The page-kind crumbs for the part of the path below the menu page. */
function tailCrumbs(rest: string[]): Crumb[] {
  const crumbs: Crumb[] = []
  rest.forEach((segment, index) => {
    if (isDynamic(segment)) {
      // An id is shown as "Detail" only when it is the page itself
      // (/invoices/[id]); /production/[id]/edit is just "Edit".
      if (index === rest.length - 1 && crumbs.length === 0) crumbs.push({ label: 'Detail' })
      return
    }
    crumbs.push({ label: segmentLabel(segment) })
  })
  return crumbs
}

function pathFallback(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  return segments.map((segment, index) => ({
    label: isDynamic(segment) ? 'Detail' : segmentLabel(segment),
    href: index < segments.length - 1 ? undefined : '/' + segments.slice(0, index + 1).join('/'),
  }))
}

function dedupe(crumbs: Crumb[]): Crumb[] {
  const out: Crumb[] = []
  for (const crumb of crumbs) {
    const prev = out[out.length - 1]
    if (prev && prev.label.toLowerCase() === crumb.label.toLowerCase()) {
      // Keep the one that is a page.
      out[out.length - 1] = crumb.href ? crumb : prev
      continue
    }
    out.push(crumb)
  }
  return out
}

export function getBreadcrumbs(pathname: string, query: Query, groups: NavGroup[]): Crumb[] {
  if (pathname === '/dashboard') return [DASHBOARD]

  const found = findEntry(menuEntries(groups), pathname, query)
  if (!found) return dedupe([DASHBOARD, ...pathFallback(pathname)])

  const { entry, exact } = found
  if (!exact) return dedupe([DASHBOARD, ...entry.trail.slice(0, -1)])

  const rest = pathname.slice(entry.path.length).split('/').filter(Boolean)
  return dedupe([DASHBOARD, ...entry.trail, ...tailCrumbs(rest)])
}

/**
 * The short trail the top bar shows: at most the menu page and the current
 * page ("Invoices › Create"). Crumbs that are not pages (groups, folders) and
 * the Dashboard root are dropped, unless the current page is the Dashboard.
 */
export function shortenBreadcrumbs(crumbs: Crumb[]): Crumb[] {
  if (crumbs.length <= 1) return crumbs

  const current = crumbs[crumbs.length - 1]
  const pages = crumbs
    .slice(0, -1)
    .filter((crumb) => crumb.href && crumb.href !== DASHBOARD.href)

  return [...pages.slice(-1), current]
}
