'use client'

// Incoming PO (other branches ordering from me), Internal PO (my orders to
// other branches) and Supplier PO — the same filters as
// /purchase/requested-orders, /purchase/internal-orders and
// /purchase/purchase-orders, one small query per status so counts are exact.

import { useQuery } from '@tanstack/react-query'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { formatDate } from '@/utils/date'
import type { ExcelRow } from '@/utils/excelExport'
import { itemSummary, listOf, PO_STATUS, StatusPill, type PanelColumn, type PanelRow, type Period } from './kit'

export const PO_PREVIEW = 8

export type PoKind = 'incoming' | 'internal' | 'supplier'

const KIND_FILTER: Record<PoKind, (branchId: number) => Record<string, unknown>> = {
  incoming: (id) => ({ 'filter[supplier_branch_id]': id, 'filter[type]': 'branch' }),
  internal: (id) => ({ 'filter[branch_id]': id, 'filter[type]': 'branch' }),
  supplier: (id) => ({ 'filter[branch_id]': id, 'filter[type]': 'supplier' }),
}

const PO_INCLUDE = 'branch,supplier_branch,supplier,purchase_order_details,purchase_order_details.product_uom,purchase_order_details.product_uom.product'

function poParams(kind: PoKind, branchId: number, status: string | undefined, period: Period | undefined, perPage: number) {
  return {
    page: 1,
    per_page: perPage,
    sort: '-created_at',
    include: PO_INCLUDE,
    'filter[status]': status,
    'filter[date_gte]': period?.from,
    'filter[date_lte]': period?.to,
    ...KIND_FILTER[kind](branchId),
  }
}

/**
 * One page of POs of `kind`. A `status` query is live (any date) so nothing
 * open drops out of view; with `period` instead it is every status in range.
 */
export function usePoList(kind: PoKind, branchId: number, status: string | undefined, enabled: boolean, period?: Period) {
  return useQuery({
    queryKey: ['ops-dashboard-po', kind, status ?? 'all', branchId, period?.from, period?.to],
    enabled: enabled && branchId > 0,
    queryFn: () => purchaseOrdersService.list(poParams(kind, branchId, status, period, PO_PREVIEW) as any).then((r) => r.data),
  })
}

/** Live pending / accepted / partially_delivered queries + the period's POs for one kind. */
export function usePoSet(kind: PoKind, branchId: number, enabled: boolean, period: Period) {
  return {
    pending: usePoList(kind, branchId, 'pending', enabled),
    accepted: usePoList(kind, branchId, 'accepted', enabled),
    partial: usePoList(kind, branchId, 'partially_delivered', enabled),
    latest: usePoList(kind, branchId, undefined, enabled, period),
  }
}

/** Up to 100 POs for the Excel export: open ones (live) or every PO in the period. */
export async function fetchPoForExport(kind: PoKind, branchId: number, which: 'open' | Period): Promise<any[]> {
  const get = (status: string | undefined, period?: Period) =>
    purchaseOrdersService.list(poParams(kind, branchId, status, period, 100) as any).then((r) => listOf((r as any).data).items)
  if (which === 'open') {
    const parts = await Promise.all(['pending', 'accepted', 'partially_delivered'].map((st) => get(st)))
    return parts.flat().sort((a: any, b: any) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
  }
  return get(undefined, which)
}

export const PO_EXPORT_HEAD = ['No. PO', 'Cabang / Supplier', 'Tanggal', 'Barang', 'Jumlah item', 'Status']

export function poExportRows(items: any[], kind: PoKind): ExcelRow[] {
  return items.map((po) => {
    const details: any[] = po.purchase_order_details ?? []
    const party = kind === 'incoming' ? po.branch?.name : kind === 'internal' ? po.supplier_branch?.name : po.supplier?.name
    return [
      po.code ?? `PO #${po.id}`,
      party ?? '',
      formatDate(po.date ?? po.created_at),
      details.map((d) => d.product_uom?.product?.name ?? d.product_uom?.name ?? d.product_uom?.code).filter(Boolean).join(', '),
      details.length,
      PO_STATUS[po.status]?.label ?? po.status,
    ]
  })
}

type Q = { data: unknown; isLoading: boolean; isError: boolean }

/** Merge several status queries into one list (newest first) + summed total. */
export function mergePo(...qs: Q[]) {
  const parts = qs.map((q) => listOf(q.data))
  const items = parts
    .flatMap((p) => p.items)
    .sort((a: any, b: any) => String(b.created_at ?? b.date ?? '').localeCompare(String(a.created_at ?? a.date ?? '')))
    .slice(0, PO_PREVIEW)
  return {
    items,
    total: parts.reduce((s, p) => s + p.total, 0),
    loading: qs.some((q) => q.isLoading),
    error: qs.some((q) => q.isError),
  }
}

export function poColumns(kind: PoKind): PanelColumn[] {
  return [
    { key: 'code', label: 'No. PO' },
    { key: 'party', label: kind === 'incoming' ? 'Dari cabang' : kind === 'internal' ? 'Ke cabang' : 'Supplier' },
    { key: 'date', label: 'Tanggal' },
    { key: 'items', label: 'Barang' },
    { key: 'status', label: 'Status', align: 'right' },
  ]
}

function poHref(po: any, kind: PoKind) {
  if (kind === 'internal') return `/purchase/internal-orders/${po.id}/detail`
  if (kind === 'supplier') return `/purchase/purchase-orders/${po.id}/detail`
  return po.status === 'accepted' || po.status === 'partially_delivered' ? `/purchase/requested-orders/${po.id}/fulfill` : '/purchase/requested-orders'
}

export function poRows(items: any[], kind: PoKind): PanelRow[] {
  return items.map((po) => {
    const details: any[] = po.purchase_order_details ?? []
    const party = kind === 'incoming' ? po.branch?.name : kind === 'internal' ? po.supplier_branch?.name : po.supplier?.name
    return {
      key: po.id,
      href: poHref(po, kind),
      cells: {
        code: <span className="ops-code">{po.code ?? `PO #${po.id}`}</span>,
        party: party ?? '—',
        date: formatDate(po.date ?? po.created_at),
        items: (
          <>
            {itemSummary(details.map((d) => d.product_uom?.product?.name ?? d.product_uom?.name ?? d.product_uom?.code))}
            {details.length > 0 && <span className="ops-sub">{details.length} item</span>}
          </>
        ),
        status: <StatusPill status={po.status} />,
      },
    }
  })
}
