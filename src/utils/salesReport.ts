import { salesOrdersService } from '@/services/sales-orders.service'
import { paymentSourceLabel } from '@/utils/paymentSource'
import { paymentsService } from '@/services/payments.service'

/**
 * Shared helpers for the outlet sales reports (Sales F Report, Sales by
 * Product, Sales by Invoice). Everything is computed client-side because the
 * backend only exposes Excel exports for these reports.
 */

const parseJson = (v: any) => {
  if (typeof v !== 'string') return v
  try {
    return JSON.parse(v)
  } catch {
    return null
  }
}

/** Follow `meta.last_page` until every row is loaded (lists cap per_page). */
export async function fetchAllPages(
  fetchPage: (page: number) => Promise<any>,
  maxPages = 50,
): Promise<any[]> {
  const rows: any[] = []
  for (let page = 1; page <= maxPages; page++) {
    const body = await fetchPage(page)
    rows.push(...((body as any)?.data ?? []))
    const lastPage = Number((body as any)?.meta?.last_page ?? 1)
    if (page >= lastPage) break
  }
  return rows
}

export function fetchFinalSalesOrders(params: {
  dateFrom: string
  dateTo: string
  branchId?: string
  include?: string
  /** filter[search]: order code, customer name or phone. */
  search?: string
}) {
  return fetchAllPages((page) =>
    salesOrdersService
      .list({
        page,
        per_page: 500,
        include: params.include ?? 'sales_order_details',
        'filter[status]': 'final',
        'filter[date_gte]': params.dateFrom,
        'filter[date_lte]': params.dateTo,
        'filter[branch_id]': params.branchId || undefined,
        'filter[search]': params.search || undefined,
        sort: 'date',
      } as any)
      .then((r) => r.data),
  )
}

/** Non-reversed payments dated inside the period, with their allocations. */
export function fetchPeriodPayments(params: {
  dateFrom: string
  dateTo: string
  branchId?: string
}) {
  return fetchAllPages((page) =>
    paymentsService
      .list({
        page,
        per_page: 500,
        include: 'payment_method,bank_account,allocations',
        'filter[date_gte]': params.dateFrom,
        'filter[date_lte]': params.dateTo,
        'filter[branch_id]': params.branchId || undefined,
        'filter[is_reversed]': 'false',
        'filter[type]': 'receive',
      })
      .then((r) => r.data),
  )
}

export interface DetailItem {
  code: string
  name: string
  unit: string
  category: string
  qty: number
  price: number
  amount: number
}

/** Resolve product code/name/unit/category from a sales order detail snapshot. */
export function resolveDetailItem(d: any): DetailItem {
  const pis = parseJson(d?.product_inventory_snapshot)
  const rawBundle = parseJson(d?.bundle_snapshot)
  const bs = Array.isArray(rawBundle) ? rawBundle[0] : rawBundle
  const uomSnap = parseJson(d?.product_uom_snapshot)
  const pu =
    uomSnap ??
    pis?.product_uom_batch?.product_uom ??
    pis?.product_uom ??
    d?.product_inventory?.product_uom_batch?.product_uom ??
    d?.product_inventory?.product_uom
  const prod = pu?.product
  const qty = Number(d?.qty ?? 0)
  const price = Number(d?.price ?? 0)

  return {
    code: prod?.code ?? bs?.code ?? pu?.code ?? pis?.code ?? '-',
    name:
      prod?.name ??
      bs?.name ??
      pis?.name ??
      d?.description ??
      (d?.bundle_id ? `Bundle #${d.bundle_id}` : `Item #${d?.product_inventory_id ?? '-'}`),
    unit: pu?.uom?.code ?? pu?.uom?.name ?? (d?.bundle_id ? 'BUNDLE' : 'PCS'),
    category: prod?.product_category?.name ?? (d?.bundle_id ? 'BUNDLE' : 'OTHER'),
    qty,
    price,
    amount: qty * price,
  }
}

export type PaymentBucket =
  | 'cash'
  | 'debit'
  | 'card'
  | 'transfer'
  | 'credit'
  | 'voucher'
  | 'other'

export const PAYMENT_BUCKET_LABEL: Record<PaymentBucket, string> = {
  cash: 'Cash',
  debit: 'Debit',
  card: 'Visa/Master (CC)',
  transfer: 'Transfer',
  credit: 'Credit',
  voucher: 'Voucher',
  other: 'Lainnya',
}

/** Map a payment method name to the legacy report buckets. Order matters: "credit card" is a card. */
export function classifyPaymentMethod(name?: string | null): PaymentBucket {
  const m = (name ?? '').toLowerCase()
  if (m.includes('cash') || m.includes('tunai')) return 'cash'
  if (m.includes('debit') || m.includes('bca')) return 'debit'
  if (
    m.includes('visa') ||
    m.includes('master') ||
    m.includes('card') ||
    m.includes('kartu') ||
    m.includes('edc') ||
    m.includes('qris')
  )
    return 'card'
  if (m.includes('transfer') || m.includes('trf')) return 'transfer'
  if (m.includes('credit') || m.includes('kredit')) return 'credit'
  if (m.includes('voucher')) return 'voucher'
  return 'other'
}

export interface OrderAllocation {
  salesOrderId: number
  amount: number
  methodName: string
  bucket: PaymentBucket
  paymentDate?: string
}

/** Flatten period payments into one row per sales-order allocation. */
export function flattenSalesOrderAllocations(payments: any[]): OrderAllocation[] {
  const rows: OrderAllocation[] = []
  payments.forEach((p: any) => {
    const methodName = paymentSourceLabel(p, 'Unknown')
    // No method means it was received straight into a bank account (a payout).
    const bucket: PaymentBucket = p.payment_method ? classifyPaymentMethod(methodName) : p.bank_account ? 'transfer' : 'other'
    ;(p.allocations ?? []).forEach((a: any) => {
      if (!a.sales_order_id) return
      rows.push({
        salesOrderId: Number(a.sales_order_id),
        amount: Number(a.amount ?? 0),
        methodName,
        bucket,
        paymentDate: p.date,
      })
    })
  })
  return rows
}

/** Credit owed by an employee (credit_type=user) vs a customer. */
export const isEmployeeCredit = (order: any) =>
  order?.credit_type === 'user' || (!order?.credit_type && !!order?.credit_by_id)

export function voucherCode(order: any): string {
  const v = parseJson(order?.voucher_snapshot)
  const snap = Array.isArray(v) ? v[0] : v
  return snap?.code ?? snap?.name ?? ''
}
