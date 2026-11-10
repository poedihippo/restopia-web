/**
 * Central permission matcher — SINGLE SOURCE OF TRUTH for every permission check
 * in the app (sidebar menu, route guard in global-layout, view CRUD gating).
 *
 * Why this exists: permission keys between the nav/route definitions and the
 * backend's seeded permission names are not always written identically, e.g.
 *   - nav: "product-inventory-raw"   backend: "product-inventory.menu" / ".read"
 *   - nav: "stock-movement.menu"     backend: "stock-movement.read"
 *   - nav: "price-list.menu"         backend: "price_lists.read"
 *   - nav: "bank_account.read"       backend: "bank-account.read"
 * A plain Set.has()/=== comparison hides menus for users that DO have access.
 *
 * Matching rules (granted = permission the user actually has, required = key
 * the menu/route/button asks for):
 *
 *  1. Keys are lowercased, trimmed and "_" is normalized to "-".
 *  2. Exact match wins.
 *  3. "resource" parts are compared singular/plural-insensitively
 *     (product-inventory ≈ product-inventories ≈ product_inventories).
 *  4. A key without an action ("product-inventory-raw") is a module/type flag:
 *     it is also matched against its base resource (parent segment after the
 *     last "-"), in BOTH directions (granted side and required side).
 *     Only dot-less keys are stripped this way, so "product.read" never
 *     grants "product-inventory.read".
 *  5. "View" actions are interchangeable: menu, read, view, access, list,
 *     index, show, see, preview, detail — so a user with *.menu can open the
 *     page — EXCEPT that a required *.menu needs a granted *.menu. The backend
 *     hands out *.read for lookups (dropdowns, prices) without the menu, so
 *     *.read alone must not reveal a menu or route.
 *  6. Write actions (create/update/delete/...) are NEVER broadened: they only
 *     match exactly (or "resource.*" wildcards).
 *
 * Keep every permission check routed through here — do NOT re-implement
 * Set.has(permission) anywhere.
 */

/** Actions that only grant visibility/read access (mutually interchangeable). */
const VIEW_ACTIONS = new Set([
  'menu',
  'read',
  'view',
  'access',
  'list',
  'index',
  'show',
  'see',
  'preview',
  'detail',
])

export function normalizePermissionKey(key: string): string {
  return String(key ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
}

function singularize(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`
  if (token.endsWith('ss')) return token
  if (token.endsWith('s')) return token.slice(0, -1)
  return token
}

/** Singular/plural + separator insensitive comparison key for a resource part. */
export function resourceStem(resource: string): string {
  return singularize(normalizePermissionKey(resource))
}

function splitKey(key: string): { resource: string; action: string | null } {
  const k = normalizePermissionKey(key)
  const idx = k.lastIndexOf('.')
  if (idx <= 0 || idx === k.length - 1) return { resource: k, action: null }
  return { resource: k.slice(0, idx), action: k.slice(idx + 1) }
}

function isViewAction(action: string | null): boolean {
  // A dot-less key is a module/type flag → always treated as visibility.
  if (action === null) return true
  return VIEW_ACTIONS.has(action)
}

/** "product-inventory-raw" → "product-inventory" (null when there is no parent). */
function parentResource(resource: string): string | null {
  const idx = resource.lastIndexOf('-')
  return idx > 0 ? resource.slice(0, idx) : null
}

/**
 * Candidate base resources for a parsed key. Only dot-less (variant/type) keys
 * get an extra parent candidate — see rule 4.
 */
function resourceCandidates(resource: string, action: string | null): string[] {
  const base = normalizePermissionKey(resource)
  if (action !== null) return [base]
  const parent = parentResource(base)
  return parent ? [base, parent] : [base]
}

/**
 * Does a single granted permission satisfy a single required key?
 * Pure function — safe to unit test / reuse outside React.
 */
export function permissionMatches(grantedKey: string, requiredKey: string): boolean {
  const required = normalizePermissionKey(requiredKey)
  if (!required) return true // nothing required → always allowed

  const granted = normalizePermissionKey(grantedKey)
  if (!granted) return false
  if (granted === '*') return true
  if (granted === required) return true

  const g = splitKey(granted)
  const r = splitKey(required)

  // Resources must be related (rule 3 + 4) — full cross product of candidates.
  const requiredResources = resourceCandidates(r.resource, r.action).map(resourceStem)
  const related = resourceCandidates(g.resource, g.action).some((candidate) =>
    requiredResources.includes(resourceStem(candidate)),
  )
  if (!related) return false

  // Actions (rule 5 + 6).
  if (g.action === r.action) return true
  if (g.action === '*') return true
  // A menu is only granted by a menu permission (rule 5 exception).
  if (r.action === 'menu') return false
  if (isViewAction(r.action) && isViewAction(g.action)) return true
  return false
}

/**
 * Does the user's permission list satisfy the required key (or ANY key in the
 * list — nav/route entries accept "any of" semantics)?
 * An empty/undefined required value means "no permission needed" → true.
 */
export function matchesAnyPermission(
  granted: string[] | undefined | null,
  required: string | string[] | undefined | null,
): boolean {
  if (required === undefined || required === null) return true
  const requiredList = Array.isArray(required) ? required : [required]
  if (requiredList.length === 0) return true

  const grantedList = (granted ?? []).filter(Boolean)
  if (grantedList.length === 0) return false

  return requiredList.some((req) =>
    grantedList.some((grantedKey) => permissionMatches(grantedKey, req)),
  )
}

export type NavPermissionAudit = {
  label: string
  href?: string
  required: string[]
  /** Granted permissions pointing at the SAME resource but an action we do not equate. */
  nearMisses: string[]
}

type AuditNavNode = {
  label: string
  href?: string
  permission?: string | string[]
  children?: AuditNavNode[]
}

/**
 * Dev helper: finds nav entries the user cannot see where they hold a
 * permission on the same resource (the classic "wrong action key" bug).
 * Returns [] for superadmin/full matches — safe to log on every render.
 */
export function auditNavPermissions(
  navGroups: Array<{ title: string; items: AuditNavNode[] }>,
  granted: string[] | undefined | null,
): NavPermissionAudit[] {
  const grantedList = granted ?? []
  const findings: NavPermissionAudit[] = []

  const visit = (node: AuditNavNode) => {
    if (node.permission) {
      const required = Array.isArray(node.permission) ? node.permission : [node.permission]
      if (!matchesAnyPermission(grantedList, required)) {
        const requiredStems = new Set(
          required.flatMap((req) =>
            resourceCandidates(splitKey(req).resource, splitKey(req).action).map(resourceStem),
          ),
        )
        const menuOnly = required.every((req) => splitKey(req).action === 'menu')
        const nearMisses = grantedList.filter((grantedKey) => {
          const parsed = splitKey(grantedKey)
          // *.read without *.menu is a deliberate lookup grant, not a key mismatch.
          if (menuOnly && isViewAction(parsed.action)) return false
          return resourceCandidates(parsed.resource, parsed.action).some((candidate) =>
            requiredStems.has(resourceStem(candidate)),
          )
        })
        if (nearMisses.length > 0) {
          findings.push({ label: node.label, href: node.href, required, nearMisses })
        }
      }
    }
    node.children?.forEach(visit)
  }

  navGroups.forEach((group) => group.items.forEach(visit))
  return findings
}
