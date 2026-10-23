/**
 * Backend fallback rule for product-UOM display names (per FE TODO 28 Sep 2026):
 * `product_uoms.name` is the authoritative label once set, but the backend does
 * NOT coalesce it server-side — `name` can be null/empty even when a product
 * name exists. FE must apply the fallback everywhere a product-uom is shown.
 */
export function getProductUomName(
  pu?: { name?: string | null; product?: { name?: string | null } | null } | null,
  fallbackProductName?: string | null,
): string {
  const own = pu?.name
  if (own != null && own.trim() !== '') return own
  return pu?.product?.name ?? fallbackProductName ?? ''
}

/**
 * Canonical display label per product type.
 *
 * Selector option labels must carry the type: the same product name can exist
 * in several types (e.g. a cake as both `wip` "Unfinish" and `final`
 * "Finished"), so name alone is ambiguous when picking a row.
 */
const PRODUCT_TYPE_LABELS: Record<string, string> = {
  raw: 'Raw',
  wip: 'WIP',
  final: 'Final',
  supply: 'Supply',
}

/** "wip" → "WIP"; unknown/empty types fall back to the raw value. */
export function productTypeLabel(type?: string | null): string {
  const raw = (type ?? '').trim()
  if (!raw) return ''
  return PRODUCT_TYPE_LABELS[raw.toLowerCase()] ?? raw
}

/**
 * Append the product type to an option label: `withProductType("Brownies", "wip")`
 * → "Brownies · WIP". A labelless call still returns the bare type, and a call
 * without a type is returned untouched — so it is safe to wrap any label.
 */
export function withProductType(label: string, type?: string | null): string {
  const suffix = productTypeLabel(type)
  if (!suffix) return label
  return label ? `${label} · ${suffix}` : suffix
}

/** Human-readable helper text for a non-actionable name-suggestion reason. */
export function describeSuggestionReason(reason: string): string {
  switch (reason) {
    case 'base_uom':
      return 'Unit dasar — nama mengikuti nama produk'
    case 'no_conversion_path':
      return 'Belum ada jalur konversi ke unit dasar, isi manual'
    case 'ambiguous':
      return 'Faktor konversi tidak jelas/pecahan, isi manual'
    case 'conversion':
      return 'Saran tersedia'
    default:
      return ''
  }
}
