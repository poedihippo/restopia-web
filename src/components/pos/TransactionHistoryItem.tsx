'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/hooks/useApi'
import { usePrinter } from '@/hooks/usePrinter'
import { buildReceiptBytes } from '@/lib/print/receiptBuilder'
import type { ReceiptData } from '@/components/PosReceipt'
import { mapReceiptToBuilder, triggerIframePrint } from '@/views/Pos'

interface Props {
  order: any // existing SalesOrder shape from list response
}

// ISO datetime → "YYYY-MM-DD HH:mm" (project date-slicing convention).
function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const s = String(value)
  const datePart = s.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return s
  const timePart = s.slice(11, 16)
  return timePart ? `${datePart} ${timePart}` : datePart
}

// Drop placeholder rows: zero/negative qty or missing product UOM.
function sellableItems(detail: any): any[] {
  return (detail?.items ?? []).filter(
    (it: any) => Number(it?.qty ?? 0) > 0 && it?.product_uom_id != null,
  )
}

// Build the same ReceiptData shape the live POS receipt produces, from a
// fetched sales-order detail. The WebUSB path runs this through
// mapReceiptToBuilder (imported from the POS view — not duplicated here); the
// iframe fallback consumes it directly via triggerIframePrint.
function mapSalesOrderToReceipt(detail: any): ReceiptData {
  const created = detail?.created_at ? new Date(detail.created_at) : new Date()
  const payments = (detail?.payments ?? []).map((p: any) => ({
    method: p?.payment_method?.name ?? p?.method ?? 'Cash',
    amount: Number(p?.amount ?? 0),
  }))
  return {
    companyName: 'Dapur Cokelat Indonesia',
    branchName: detail?.branch?.name ?? 'Dapur Cokelat',
    branchAddress: detail?.branch?.address ?? '',
    branchPhone: detail?.branch?.phone ?? '',
    invoiceNo: detail?.code ?? '',
    date: created
      .toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' })
      .replace(/\//g, '-'),
    time: created.toLocaleTimeString('id-ID'),
    cashierName: detail?.created_by?.name ?? 'Kasir',
    customerName: detail?.customer_name ?? detail?.customer?.name ?? undefined,
    orderType: detail?.type ?? 'offline',
    items: sellableItems(detail).map((it: any) => ({
      name: it?.product_uom?.product?.name ?? it?.description ?? '—',
      qty: Number(it?.qty ?? 0),
      price: Number(it?.price ?? 0),
      subtotal: Number(it?.subtotal ?? Number(it?.qty ?? 0) * Number(it?.price ?? 0)),
    })),
    grossAmount: Number(detail?.subtotal_price ?? 0),
    discountAmount: Number(detail?.discount_price ?? 0),
    totalAmount: Number(detail?.total_price ?? 0),
    payments: payments.length
      ? payments
      : [{ method: 'Cash', amount: Number(detail?.total_price ?? 0) }],
    changeAmount: 0,
    isPrinted: false,
  }
}

export default function TransactionHistoryItem({ order }: Props) {
  const [expanded, setExpanded] = useState(false)
  const printer = usePrinter()

  const { data: detailData, isLoading } = useQuery({
    queryKey: ['sales-orders', order.id, 'detail-for-history'],
    queryFn: () =>
      api
        .get(`/sales-orders/${order.id}`, {
          params: { include: 'items.product_uom.product,payments,branch,company,customer' },
        })
        .then((r) => r.data),
    enabled: expanded,
  })

  const detail = (detailData as any)?.data
  const items = detail ? sellableItems(detail) : []

  const printerOffline =
    printer.status !== 'connected' &&
    printer.status !== 'connecting' &&
    printer.status !== 'printing'

  const reprintDisabled = !detail || printer.status === 'printing'

  async function handleReprint() {
    if (!detail) return
    const receipt = mapSalesOrderToReceipt(detail)
    if (printer.status === 'connected') {
      try {
        await printer.print(buildReceiptBytes(mapReceiptToBuilder(receipt)))
        return
      } catch (e) {
        console.error('[Print] WebUSB failed, falling back to iframe', e)
      }
    }
    triggerIframePrint(receipt)
  }

  const itemCount = order?.sales_order_details?.length

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--background)',
        overflow: 'hidden',
      }}
    >
      {/* Summary — click to expand */}
      <div onClick={() => setExpanded((v) => !v)} style={{ cursor: 'pointer', padding: '12px 16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground)' }}>{order.code}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 'var(--radius-xl)',
              background: order.status === 'final' ? 'var(--success-bg)' : 'var(--warning-bg)',
              color: order.status === 'final' ? 'var(--success)' : 'var(--warning)',
              textTransform: 'capitalize',
            }}
          >
            {order.status}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
            {order.customer_name || order.customer?.name || 'Walk-in'}
            {order.customer_phone ? ` · ${order.customer_phone}` : ''}
          </span>
          <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>
            {new Date(order.created_at).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {itemCount != null && itemCount > 0 && (
          <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 8 }}>
            {itemCount} item(s)
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
            {expanded ? 'Hide details ▴' : 'Show details ▾'}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
            Rp {Number(order.total_price).toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      {/* Expanded — line items + reprint */}
      {expanded && (
        <div
          style={{
            margin: '0 16px 12px',
            paddingLeft: 12,
            borderLeft: '2px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {detail?.created_at && (
            <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
              {fmtDateTime(detail.created_at)}
            </span>
          )}

          {isLoading && (
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Loading items…</span>
          )}
          {!isLoading && items.length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>No items</span>
          )}

          {items.map((it: any, idx: number) => (
            <div
              key={it?.id ?? idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                fontSize: 12,
                color: 'var(--foreground)',
              }}
            >
              <span>
                {it?.product_uom?.product?.name ?? it?.description ?? '—'} × {Number(it?.qty ?? 0)}
              </span>
              <span style={{ color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
                Rp{' '}
                {Number(
                  it?.subtotal ?? Number(it?.qty ?? 0) * Number(it?.price ?? 0),
                ).toLocaleString('id-ID')}
              </span>
            </div>
          ))}

          {printerOffline && (
            <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
              Printer disconnected — will use browser print
            </span>
          )}

          <button
            type="button"
            onClick={handleReprint}
            disabled={reprintDisabled}
            style={{
              width: '100%',
              marginTop: 4,
              height: 34,
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: reprintDisabled ? 'not-allowed' : 'pointer',
              opacity: reprintDisabled ? 0.6 : 1,
            }}
          >
            {printer.status === 'printing' ? 'Printing…' : 'Reprint Receipt'}
          </button>
        </div>
      )}
    </div>
  )
}
