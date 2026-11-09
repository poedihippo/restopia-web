import type { ReceiptData } from '@/components/PosReceipt'
import { parseApiDate } from '@/utils/date'

export const parseSnapshot = (snap: any) => {
  if (typeof snap !== 'string') return snap
  try {
    return JSON.parse(snap)
  } catch {
    return null
  }
}

// Prefer product_uom_snapshot (frozen at order time) over
// product_inventory_snapshot which may be null.
export function lineNameOf(d: any, idx: number): string {
  const snap = parseSnapshot(d.product_inventory_snapshot)
  const uomSnap = d.product_uom_snapshot
  return (
    uomSnap?.product?.name ??
    snap?.product_uom?.product?.name ??
    snap?.product_uom_batch?.product_uom?.product?.name ??
    snap?.name ??
    d.product_inventory?.product_uom?.product?.name ??
    d.product_uom_batch?.product_uom?.product?.name ??
    d.bundle?.name ??
    (d.bundle_id ? 'Bundle' : `Item ${d.id ?? idx + 1}`)
  )
}

const pad2 = (n: number) => String(n).padStart(2, '0')
/** Receipt date, e.g. "2026-11-09". */
export const receiptDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
/** Receipt time, e.g. "15:03:37". */
export const receiptTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`

/**
 * Rebuild a POS receipt from a saved sales order (for reprints).
 * `allocations` are /payments/allocations rows (include=payment) for the order.
 */
export function receiptFromOrder(
  order: any,
  allocations: any[],
  opts: { reprintBy?: string } = {},
): ReceiptData {
  const created = parseApiDate(order?.created_at) ?? parseApiDate(order?.date) ?? new Date()
  const now = new Date()
  const isOnline = order?.type === 'online'
  const subtotal = Number(order?.subtotal_price ?? 0)
  const discount = Number(order?.discount_price ?? 0)
  const tax = Number(order?.tax_amount ?? 0)
  const total = Number(order?.total_price ?? 0)
  const change = isOnline ? 0 : Number(order?.change_amount ?? 0)

  // Tenders as handed over (applied amount + change); refunds are not tenders.
  // Online orders are paid by the marketplace payout, not at the till.
  const payments = isOnline
    ? []
    : allocations
        .filter((a: any) => a.payment?.type !== 'refund' && !a.payment?.is_reversed)
        .map((a: any) => {
          const applied = Number(a.amount ?? 0)
          const paymentChange = Number(a.payment?.change_amount ?? 0)
          return {
            method: a.payment?.payment_method?.name ?? 'Payment',
            amount: applied + paymentChange,
          }
        })
  // Older orders: no per-payment change, so put the order's change on the last tender.
  const tenderedSum = payments.reduce((s, p) => s + p.amount, 0)
  const appliedSum = allocations
    .filter((a: any) => a.payment?.type !== 'refund' && !a.payment?.is_reversed)
    .reduce((s: number, a: any) => s + Number(a.amount ?? 0), 0)
  if (change > 0 && payments.length > 0 && tenderedSum < appliedSum + change) {
    const last = payments[payments.length - 1]
    payments[payments.length - 1] = { ...last, amount: last.amount + (appliedSum + change - tenderedSum) }
  }

  return {
    companyName: 'Dapur Cokelat Indonesia',
    branchName: order?.branch?.name ?? 'Dapur Cokelat',
    branchAddress: order?.branch?.address ?? '',
    branchPhone: order?.branch?.phone ?? '',
    invoiceNo: order?.code ?? '',
    date: receiptDate(created),
    time: receiptTime(created),
    cashierName: order?.created_by?.name ?? 'Kasir',
    customerName: order?.customer_name || order?.customer?.name || undefined,
    orderType: order?.type ?? '',
    salesChannelName: isOnline ? order?.sales_channel?.name ?? undefined : undefined,
    items: (order?.sales_order_details ?? []).map((d: any, idx: number) => {
      const qty = Number(d.qty ?? 0)
      const price = Number(d.price ?? 0)
      return { name: lineNameOf(d, idx), qty, price, subtotal: qty * price }
    }),
    grossAmount: subtotal,
    discountAmount: discount,
    taxAmount: tax,
    taxIncluded: tax > 0 && Math.abs(subtotal - discount + tax - total) > 1,
    totalAmount: total,
    payments,
    changeAmount: change,
    isPrinted: true,
    reprintBy: opts.reprintBy,
    reprintAt: `${receiptDate(now)} ${receiptTime(now)}`,
  }
}
