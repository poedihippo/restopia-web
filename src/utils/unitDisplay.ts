export type UnitDisplayMode = 'smallest' | 'largest' | 'branch'

export interface ConversionEntry {
  uom_code: string
  uom_name: string
  target_uom_code: string
  target_uom_name: string
  amount: number
}

const STORAGE_KEY = 'stock_movement_qty_mode'
const DEFAULT_BRANCH_TYPE_FALLBACK = 'outlet'
const MAX_CHAIN_DEPTH = 10

/**
 * Default display mode heuristic by branch type.
 * - warehouse → largest (prefers PACK over GR for warehouse ops)
 * - production → smallest (precise raw consumption like "2.5 GR")
 * - outlet → smallest (cashier view, base unit reads cleaner)
 */
export function getDefaultMode(branchType?: string | null): UnitDisplayMode {
  const t = (branchType ?? DEFAULT_BRANCH_TYPE_FALLBACK).toLowerCase()
  if (t === 'warehouse') return 'largest'
  return 'smallest'
}

/**
 * Load persisted preference; falls back to branch default when missing/invalid.
 * - defaultMode: override the branch-type heuristic when nothing is stored
 *   (e.g. 'branch' for product inventory — show stock in the product-UOM
 *   matching the user's branch.type).
 * - storageKey: isolate preferences per view (default shared key).
 */
export function loadStoredMode(
  branchType?: string | null,
  defaultMode?: UnitDisplayMode,
  storageKey: string = STORAGE_KEY,
): UnitDisplayMode {
  if (typeof window === 'undefined') return defaultMode ?? getDefaultMode(branchType)
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw === 'smallest' || raw === 'largest' || raw === 'branch') return raw
  } catch {
    // localStorage may be unavailable (private mode, SSR edge)
  }
  return defaultMode ?? getDefaultMode(branchType)
}

export function persistMode(mode: UnitDisplayMode, storageKey: string = STORAGE_KEY): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, mode)
  } catch {
    // ignore
  }
}

/**
 * Sort conversions ascending by amount (smallest amount = largest unit).
 * The chain then walks: base → next → ... → largest.
 */
export function buildConversionChain(
  conversions?: ConversionEntry[] | null,
): ConversionEntry[] {
  if (!conversions || conversions.length === 0) return []
  return [...conversions].sort((a, b) => a.amount - b.amount)
}

/**
 * Convert a qty from the base unit up through the conversion chain.
 * Returns the value in `targetUomCode` if reachable, otherwise null.
 *
 * The conversion chain is: each entry has uom_code (source) → target_uom_code.
 * To walk UP from base: find step where target_uom_code === current, then
 * divide value by amount, set current = step.uom_code.
 *
 * Example: GR base, chain: PACK(12)→KG, KG(1000)→GR
 *   GR → find KG(1000)→GR: value /= 1000, current = KG
 *   KG → find PACK(12)→KG: value /= 12, current = PACK
 *   PACK found → return 8
 */
export function convertUp(
  baseQty: number,
  baseUomCode: string,
  targetUomCode: string,
  conversions?: ConversionEntry[] | null,
): number | null {
  if (!conversions || conversions.length === 0) {
    return baseUomCode === targetUomCode ? baseQty : null
  }
  if (baseUomCode === targetUomCode) return baseQty

  const chain = buildConversionChain(conversions)
  let value = baseQty
  let current = baseUomCode
  let safety = MAX_CHAIN_DEPTH

  while (current !== targetUomCode && safety-- > 0) {
    const step = chain.find((c) => c.target_uom_code === current)
    if (!step) return null
    value = value / step.amount
    current = step.uom_code
  }
  return current === targetUomCode ? value : null
}

/**
 * Convert a qty DOWN from a source unit to the base unit (inverse of convertUp).
 * Walks conversion steps (uom_code → target_uom_code) multiplying by amount.
 *
 * Example: 1,7 KG with chain KG(1000)→GR → 1700 GR.
 * Returns null if the source unit cannot reach the base unit.
 */
export function convertDown(
  qty: number,
  fromUomCode: string,
  baseUomCode: string,
  conversions?: ConversionEntry[] | null,
): number | null {
  if (fromUomCode === baseUomCode) return qty
  if (!conversions || conversions.length === 0) return null

  let value = qty
  let current = fromUomCode
  let safety = MAX_CHAIN_DEPTH

  while (current !== baseUomCode && safety-- > 0) {
    const step = conversions.find((c) => c.uom_code === current)
    if (!step) return null
    value = value * step.amount
    current = step.target_uom_code
  }
  return current === baseUomCode ? value : null
}

/**
 * Format a quantity for display according to the chosen mode.
 *
 * The API response provides:
 *   qty        → quantity in the LARGEST unit (e.g. 8 PACK, 30 PACK)
 *   base_qty   → quantity in the SMALLEST unit (e.g. 96000 GR)
 *   base_uom   → code of the smallest unit (GR, PCS, etc.)
 *   conversions → chain of unit conversions (PACK(12)→KG(1000)→GR)
 *
 * - smallest: always show base_qty + base_uom (e.g. "96.000 GR")
 *   = the raw value in the smallest/most granular unit.
 *
 * - largest: show qty + the name of the largest UOM (e.g. "8 PACK")
 *   The backend has already converted qty into the largest unit, so we
 *   just need to read `qty` and find the label of the largest UOM from
 *   the conversion chain (the conversion with the smallest `amount`).
 *   If there are no conversions, fall back to base_qty + base_uom.
 *
 * Direction sign (in/out) is applied by the caller.
 */
export function formatQtyInMode(
  baseQty: number,
  qty: number,
  baseUomCode: string,
  conversions?: ConversionEntry[] | null,
  mode: UnitDisplayMode = 'smallest',
): string {
  if (mode === 'smallest') {
    return `${formatNumber(baseQty)} ${baseUomCode}`
  }

  // mode === 'largest': find the unit the qty value is in, using the
  // conversion chain. Walk from base→top (find step where
  // target_uom_code === current), divide value, repeat.
  // If chain stops early (data has non-linear branches like
  // PACK→GR + KG→GR), fallback to the connected unit with the
  // largest amount (= largest unit that directly connects to base).
  if (!conversions || conversions.length === 0) {
    return `${formatNumber(baseQty)} ${baseUomCode}`
  }

  const chain = buildConversionChain(conversions)
  let value = baseQty
  let unit = baseUomCode
  let safety = MAX_CHAIN_DEPTH

  while (safety-- > 0) {
    const step = chain.find((c) => c.target_uom_code === unit)
    if (!step) break
    value = value / step.amount
    unit = step.uom_code
  }

  // Sanity check: if chain result doesn't match qty (data has non-linear
  // branches), fallback to the unit with the largest amount that directly
  // connects to the base unit. This handles cases like:
  //   PACK(3000)→GR + KG(500)→GR (non-linear, both connect to GR)
  if (unit !== baseUomCode && Math.abs(value - qty) > 1) {
    const connected = conversions.filter((c) => c.target_uom_code === baseUomCode)
    if (connected.length > 0) {
      const largest = connected.reduce((max, c) =>
        c.amount > max.amount ? c : max,
        connected[0],
      )
      return `${formatNumber(qty)} ${largest.uom_name}`
    }
  }

  return `${formatNumber(value)} ${unit}`
}

/**
 * Indonesian-style thousands separator, 2 decimals max (trim trailing zeros).
 */
function formatNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100
  return rounded.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

/**
 * Convenience: render a full signed movement line, e.g. "−2,5 GR" or "+1 PACK".
 */
export function formatSignedMovementQty(
  baseQty: number,
  qty: number,
  baseUomCode: string,
  direction: 'in' | 'out' | string,
  conversions?: ConversionEntry[] | null,
  mode: UnitDisplayMode = 'smallest',
): string {
  const sign = direction === 'out' ? '−' : '+'
  return `${sign}${formatQtyInMode(baseQty, qty, baseUomCode, conversions, mode)}`
}

/** Normalize API conversions (flat codes or nested uom objects). */
export function toConversionEntries(source?: any[] | null): ConversionEntry[] {
  if (!Array.isArray(source)) return []
  return source
    .map((c: any): ConversionEntry => ({
      uom_code: c.uom_code ?? c.uom?.code ?? '',
      uom_name: c.uom_name ?? c.uom?.name ?? '',
      target_uom_code: c.target_uom_code ?? c.target_uom?.code ?? '',
      target_uom_name: c.target_uom_name ?? c.target_uom?.name ?? '',
      amount: Number(c.amount ?? 0),
    }))
    .filter((c) => c.uom_code && c.target_uom_code && c.amount > 0)
}

/**
 * Build packaging chains from the largest unit down, multiplying amounts
 * along the way: PACK→PCS (6), PCS→KG (2), KG→GR (1000) gives
 * "1 PACK → 6 PCS → 12 KG → 12.000 GR". A product with several top units
 * gets one chain per top unit.
 */
export function packagingChains(conversions?: any[] | null): string[] {
  const entries = toConversionEntries(conversions)
  if (entries.length === 0) return []
  const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 })
  const bySource = new Map<string, ConversionEntry>()
  for (const c of entries) if (!bySource.has(c.uom_code)) bySource.set(c.uom_code, c)
  const targets = new Set(entries.map((c) => c.target_uom_code))
  const roots = [...bySource.keys()].filter((code) => !targets.has(code))
  return roots.map((root) => {
    const parts = [`1 ${root}`]
    const seen = new Set([root])
    let qty = 1
    let step = bySource.get(root)
    while (step && !seen.has(step.target_uom_code)) {
      qty *= Number(step.amount)
      parts.push(`${fmt(qty)} ${step.target_uom_code}`)
      seen.add(step.target_uom_code)
      step = bySource.get(step.target_uom_code)
    }
    return parts.join(' → ')
  })
}
