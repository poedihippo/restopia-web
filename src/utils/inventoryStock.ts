/**
 * Availability helpers for product-inventory rows.
 *
 * The simplified stock model has ONE quantity per row: `stock` (with
 * `base_stock` for the same figure in the product's base unit). The old
 * sellable / cutable / reserved figures are gone, so there is no longer a
 * per-product "mode" to resolve — availability is just the row's stock.
 *
 * `availableStockOf` is kept as the single call site for "how much can be
 * sold from this row" so POS, bundles and filters all agree, and so any
 * future rule change lands in one place.
 */

type InventoryRow = {
  stock?: number | null
  display_qty?: number | null
  qty?: number | null
  base_stock?: number | null
}

/** Quantity of the row that can actually be sold right now. */
export const availableStockOf = (row: InventoryRow | null | undefined): number => {
  if (!row) return 0
  return Number(row.stock ?? row.display_qty ?? row.qty ?? 0)
}
