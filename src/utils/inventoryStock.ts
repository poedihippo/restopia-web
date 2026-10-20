/**
 * Availability helpers for product-inventory rows.
 *
 * A product can be flagged `is_deferred`, and the two modes answer "how much
 * can I still sell?" completely differently:
 *
 *  1. Deferred final SKU (product.is_deferred = true)
 *     - Only the sellable pool may be sold; `stock` is the produced-but-not-
 *       yet-sellable quantity.
 *     - Availability = `sellable_qty` (equivalently the row's `remaining_qty`
 *       from GET /sellables/summary — verified identical, so no extra request).
 *     - The row carrying it is the SKU's ANCHOR row (batch_code "SELLABLE"),
 *       which is also the row a POS cart line must point at.
 *     - Selling consumes sellable lots and never touches base_stock.
 *
 *  2. Normal product (is_deferred = false)
 *     - Availability = the physical stock minus whatever is reserved:
 *       `available_base_stock` (= base_stock - reserved_base_stock).
 *     - `display_qty` / `stock` are presentation only and ignore reservations.
 *     - The row a cart line points at is the physical batch row.
 */

type InventoryRow = {
  is_deferred?: boolean | null
  sellable_qty?: number | null
  display_qty?: number | null
  stock?: number | null
  qty?: number | null
  base_stock?: number | null
  reserved_base_stock?: number | null
  available_base_stock?: number | null
  cutable_stock?: number | null
  cutable_reserved_base_stock?: number | null
  available_cutable_stock?: number | null
  product?: { is_deferred?: boolean | null; is_cutable_source?: boolean | null }
  product_uom?: { product?: { is_deferred?: boolean | null; is_cutable_source?: boolean | null } }
  product_uom_batch?: {
    product_uom?: { product?: { is_deferred?: boolean | null; is_cutable_source?: boolean | null } }
  }
}

/** True when the inventory row belongs to a deferred product. */
export const isDeferredInventoryRow = (row: InventoryRow | null | undefined): boolean => {
  if (typeof row?.is_deferred === 'boolean') return row.is_deferred
  const product = row?.product_uom_batch?.product_uom?.product ?? row?.product_uom?.product ?? row?.product
  return product?.is_deferred === true
}

/** True when the inventory row's product is flagged `is_cutable_source`. */
export const isCutableSourceInventoryRow = (row: InventoryRow | null | undefined): boolean => {
  const product = row?.product_uom_batch?.product_uom?.product ?? row?.product_uom?.product ?? row?.product
  return product?.is_cutable_source === true
}

/** Quantity of the row that can actually be sold right now. */
export const availableStockOf = (row: InventoryRow | null | undefined): number => {
  if (!row) return 0

  // Deferred final SKU — only the sellable pool is sellable.
  if (isDeferredInventoryRow(row)) return Number(row.sellable_qty ?? 0)

  // Normal product — physical stock minus the reserved portion. display_qty /
  // stock still count reservations as available, so they can't be used here.
  const baseStock = Number(row.base_stock ?? 0)
  if (baseStock > 0) {
    const availableBase =
      row.available_base_stock != null
        ? Number(row.available_base_stock)
        : baseStock - Number(row.reserved_base_stock ?? 0)

    // `available_base_stock` is in the product's base unit while the POS sells
    // in the row's own unit — rescale by the row's display factor when they
    // differ, otherwise the two quantities are not comparable.
    const displayQty = Number(row.display_qty ?? row.stock ?? row.qty ?? 0)
    if (displayQty > 0 && displayQty !== baseStock) {
      return availableBase * (displayQty / baseStock)
    }
    return availableBase
  }

  // Legacy rows without base_stock — fall back to the presented quantity.
  return Number(row.display_qty ?? row.stock ?? row.qty ?? 0)
}

/**
 * Cutable stock of the row (base unit) that can still be reserved by a
 * portioning: `available_cutable_stock`, else cutable minus its reserved part.
 * Cutable stock is credited to a cutable-source SKU's anchor row (which holds
 * no physical `stock`), so this is the figure that matters for re-cutting it.
 */
export const cutableStockOf = (row: InventoryRow | null | undefined): number => {
  if (!row) return 0

  if (row.available_cutable_stock != null && Number.isFinite(Number(row.available_cutable_stock))) {
    return Number(row.available_cutable_stock)
  }

  if (row.cutable_stock != null && Number.isFinite(Number(row.cutable_stock))) {
    return Math.max(Number(row.cutable_stock) - Number(row.cutable_reserved_base_stock ?? 0), 0)
  }

  return 0
}
