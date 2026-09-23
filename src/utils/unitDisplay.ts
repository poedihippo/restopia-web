export type UnitDisplayMode = 'smallest' | 'largest'

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
 */
export function loadStoredMode(branchType?: string | null): UnitDisplayMode {
  if (typeof window === 'undefined') return getDefaultMode(branchType)
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'smallest' || raw === 'largest') return raw
  } catch {
    // localStorage may be unavailable (private mode, SSR edge)
  }
  return getDefaultMode(branchType)
}

export function persistMode(mode: UnitDisplayMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
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
 * Format a quantity for display according to the chosen mode.
 *
 * - smallest: show baseQty + baseUomCode directly (e.g. "2,5 GR").
 *             Always precise, matches the `base_qty` / `base_uom_code`
 *             fields on the API response.
 *
 * - largest:  PROPERLY CONVERT baseQty up the conversion chain to the
 *             largest meaningful unit (the largest unit where the
 *             converted value is >= 1). If no larger unit can fit a whole
 *             value (e.g. 2,5 GR for a product sold in PACK / KG), fall
 *             back to the base unit so the user never sees misleading
 *             fractional PACK values like "0,0002 PACK".
 *
 *             Examples (Non Dairy Cream: PACK(12)→KG→GR):
 *               2,5 GR    → "2,5 GR"   (no unit fits ≥1 above)
 *               2.500 GR  → "2,5 KG"
 *               12.000 GR → "1 PACK"
 *               24.000 GR → "2 PACK"
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
  if (!baseUomCode) return String(qty ?? baseQty ?? 0)

  if (mode === 'smallest') {
    return `${formatNumber(baseQty)} ${baseUomCode}`
  }

  // mode === 'largest': walk up the chain while the next value is >= 1
  const chain = buildConversionChain(conversions)
  if (chain.length === 0) {
    return `${formatNumber(baseQty)} ${baseUomCode}`
  }

  let value = baseQty
  let unit = baseUomCode
  let safety = MAX_CHAIN_DEPTH

  for (const step of chain) {
    if (safety-- <= 0) break
    const nextValue = value / step.amount
    if (nextValue < 1) break
    value = nextValue
    unit = step.uom_code
  }

  return `${formatNumber(value)} ${unit}`
}

/**
 * Indonesian-style thousands separator, fixed 4 decimals max (trim trailing zeros).
 */
function formatNumber(n: number): string {
  const rounded = Math.round(n * 10000) / 10000
  return rounded.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
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
