/**
 * Resolves a readable label for a ProductInventorySimpleResponse that may be
 * nested under product_uom_batch.product_uom (or product_uom directly).
 */
export function inventoryLabel(inv: any): string {
  if (!inv) return '—'
  const pu = inv.product_uom_batch?.product_uom ?? inv.product_uom
  const product = pu?.product ?? inv.product
  const name = product?.name ?? pu?.name ?? 'Unknown product'
  const uom = pu?.uom?.code ?? pu?.code
  return uom ? `${name} (${uom})` : String(name)
}

/** "no_cost" → "no cost" */
export function humanizeReason(reason: string | undefined | null): string {
  return String(reason ?? 'skipped').replace(/_/g, ' ')
}
