'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { salesOrdersService } from '@/services/sales-orders.service'
import { useAuth } from '@/hooks/useAuth'

const firstOfMonth = () =>
  new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0]
const today = () => new Date().toISOString().split('T')[0]

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  background: 'var(--surface)',
  color: 'var(--foreground)',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground)',
  background: 'var(--background)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const tdBase: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  color: 'var(--foreground)',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
}

const statCardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '14px 16px',
}

const accentBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--accent)',
  color: 'white',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  height: 36,
}

const ghostBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  color: 'var(--foreground)',
  cursor: 'pointer',
}

export default function SalesByProductReport() {
  const router = useRouter()
  const { user, isSuperadmin } = useAuth()

  const [dateFrom, setDateFrom] = useState<string>(firstOfMonth())
  const [dateTo, setDateTo] = useState<string>(today())
  const [branchFilter, setBranchFilter] = useState<string>('')
  const [hasSetDefault, setHasSetDefault] = useState(false)
  const [enabled, setEnabled] = useState<boolean>(false)

  useEffect(() => {
    if (user?.branch_id && !hasSetDefault) {
      setBranchFilter(String(user.branch_id))
      setHasSetDefault(true)
    }
  }, [user, hasSetDefault])

  const { data, isLoading } = useQuery({
    queryKey: ['report-sales-product', dateFrom, dateTo, branchFilter],
    queryFn: () =>
      salesOrdersService
        .list({
          per_page: 500,
          include: 'sales_order_details,branch',
          'filter[status]': 'final',
          'filter[date_gte]': dateFrom,
          'filter[date_lte]': dateTo,
          'filter[branch_id]': branchFilter || undefined,
        } as any)
        .then((r) => r.data),
    enabled,
  })
  const orders = (data as any)?.data ?? []

  const productMap = useMemo(() => {
    const map: Record<
      string,
      { code: string; name: string; qty: number; totalAmount: number }
    > = {}

    orders.forEach((order: any) => {
      ;(order.sales_order_details ?? []).forEach((d: any) => {
        const snap = d.product_inventory_snapshot
        const code =
          snap?.code ?? String(d.product_inventory_id ?? 'UNKNOWN')
        const name =
          snap?.product_uom?.product?.name ??
          snap?.name ??
          `Item #${d.product_inventory_id}`

        if (!map[code]) {
          map[code] = { code, name, qty: 0, totalAmount: 0 }
        }
        map[code].qty += d.qty ?? 0
        map[code].totalAmount += (d.qty ?? 0) * (d.price ?? 0)
      })
    })

    return Object.values(map).sort(
      (a, b) => b.totalAmount - a.totalAmount,
    )
  }, [orders])

  const grandTotal = productMap.reduce((s, p) => s + p.totalAmount, 0)
  const grandQty = productMap.reduce((s, p) => s + p.qty, 0)

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 10px; margin: 0; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #000; padding: 2px 5px; font-size: 10px; }
        }
      `}</style>

      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <button type="button" onClick={() => router.back()} style={ghostBtnStyle}>
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          style={ghostBtnStyle}
        >
          <Printer size={14} />
          Print
        </button>
      </div>

      <div
        style={{
          textAlign: 'center',
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            display: 'block',
          }}
        >
          Dapur Cokelat Indonesia
        </span>
        <span
          style={{
            fontSize: 13,
            color: 'var(--foreground-muted)',
            display: 'block',
            marginTop: 2,
          }}
        >
          {(user as any)?.branch?.name ?? 'All Branches'}
        </span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            display: 'block',
            marginTop: 6,
          }}
        >
          Sales by Product Report
        </span>
        <span
          style={{
            fontSize: 12,
            color: 'var(--foreground-muted)',
            display: 'block',
            marginTop: 2,
          }}
        >
          {`Period: ${dateFrom} s/d ${dateTo}`}
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--foreground-muted)',
            display: 'block',
          }}
        >
          {`Printed: ${new Date().toLocaleString('id-ID')}`}
        </span>
      </div>

      <div
        className="no-print"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>FROM</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>TO</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={inputStyle}
            />
          </div>
          {isSuperadmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>BRANCH ID</label>
              <input
                type="text"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                placeholder="All branches"
                style={{ ...inputStyle, width: 140 }}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => setEnabled(true)}
            style={accentBtnStyle}
          >
            Generate
          </button>
        </div>
      </div>

      <div
        className="no-print"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={statCardStyle}>
          <div style={labelStyle}>Total Products</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
            {productMap.length}
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={labelStyle}>Total Qty</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
            {grandQty.toLocaleString('id-ID')}
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={labelStyle}>Total Revenue</div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              marginTop: 4,
              color: 'var(--accent)',
            }}
          >
            {'Rp ' + grandTotal.toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
          }}
        >
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 40 }}>No.</th>
              <th style={{ ...thStyle, width: 120 }}>Item Code</th>
              <th style={thStyle}>Product Name</th>
              <th style={{ ...thStyle, width: 80, textAlign: 'right' }}>Qty</th>
              <th style={{ ...thStyle, width: 130, textAlign: 'right' }}>
                Avg Price
              </th>
              <th style={{ ...thStyle, width: 150, textAlign: 'right' }}>
                Total Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td
                  colSpan={6}
                  style={{ ...tdBase, textAlign: 'center', padding: 32 }}
                >
                  Loading...
                </td>
              </tr>
            )}
            {!enabled && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    ...tdBase,
                    textAlign: 'center',
                    padding: 32,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  Set date range and click Generate
                </td>
              </tr>
            )}
            {enabled && !isLoading && productMap.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    ...tdBase,
                    textAlign: 'center',
                    padding: 32,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  No sales data for selected period
                </td>
              </tr>
            )}
            {productMap.map((p, idx) => (
              <tr
                key={p.code}
                style={{
                  background: idx % 2 === 0 ? 'transparent' : 'var(--background)',
                }}
              >
                <td style={tdBase}>{idx + 1}</td>
                <td style={tdBase}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
                    {p.code}
                  </span>
                </td>
                <td style={{ ...tdBase, fontWeight: 500 }}>{p.name}</td>
                <td
                  style={{
                    ...tdBase,
                    textAlign: 'right',
                    fontWeight: 600,
                  }}
                >
                  {p.qty.toLocaleString('id-ID')}
                </td>
                <td style={{ ...tdBase, textAlign: 'right' }}>
                  {p.qty > 0
                    ? 'Rp ' +
                      Math.round(p.totalAmount / p.qty).toLocaleString('id-ID')
                    : '—'}
                </td>
                <td
                  style={{
                    ...tdBase,
                    textAlign: 'right',
                    fontWeight: 600,
                    color: 'var(--accent)',
                  }}
                >
                  {'Rp ' + p.totalAmount.toLocaleString('id-ID')}
                </td>
              </tr>
            ))}
          </tbody>
          {productMap.length > 0 && (
            <tfoot>
              <tr
                style={{
                  background: 'var(--background)',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                <td
                  colSpan={3}
                  style={{ ...tdBase, textAlign: 'right', padding: '10px 12px' }}
                >
                  TOTAL
                </td>
                <td
                  style={{ ...tdBase, textAlign: 'right', padding: '10px 12px' }}
                >
                  {grandQty.toLocaleString('id-ID')}
                </td>
                <td style={tdBase}></td>
                <td
                  style={{
                    ...tdBase,
                    textAlign: 'right',
                    padding: '10px 12px',
                    color: 'var(--accent)',
                  }}
                >
                  {'Rp ' + grandTotal.toLocaleString('id-ID')}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
