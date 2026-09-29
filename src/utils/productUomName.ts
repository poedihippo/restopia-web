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
