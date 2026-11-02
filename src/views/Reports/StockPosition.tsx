'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer, Search, Download } from 'lucide-react'
import { productInventoriesService } from '@/services/product-inventories.service'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { getProductUomName } from '@/utils/productUomName'
import { downloadExcel, reportHeader, type ExcelRow } from '@/utils/excelExport'
import ReportBranchSelect, { useReportBranchName } from './ReportBranchSelect'

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
  marginBottom: 4,
  display: 'block',
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground)',
  background: 'var(--background)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 11,
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

export default function StockPositionReport() {
  const router = useRouter()
  const { user } = useAuth()

  const [branchFilter, setBranchFilter] = useState('')
  const [hasSetDefault, setHasSetDefault] = useState(false)
  const [productTypeFilter, setProductTypeFilter] = useState<
    '' | 'raw' | 'wip' | 'final'
  >('')
  const [searchText, setSearchText] = useState('')
  const [enabled, setEnabled] = useState(false)
  const branchName = useReportBranchName(branchFilter)

  useEffect(() => {
    if (user?.branch_id && !hasSetDefault) {
      setBranchFilter(String(user.branch_id))
      setHasSetDefault(true)
    }
  }, [user, hasSetDefault])

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      'report-stock-position',
      branchFilter,
      productTypeFilter,
    ],
    queryFn: () =>
      productInventoriesService
        .list({
          per_page: 500,
          include: 'branch,product_uom_batch',
          'filter[branch_id]': branchFilter || undefined,
          'filter[product_type]': productTypeFilter || undefined,
          sort: 'code',
        } as any)
        .then((r) => r.data),
    enabled,
  })

  const items: any[] = (data as any)?.data ?? []

  const filtered = useMemo(() => {
    if (!searchText) return items
    const s = searchText.toLowerCase()
    return items.filter((item: any) => {
      const name =
        getProductUomName(item.product_uom_batch?.product_uom, item.product_uom_batch?.product_uom?.product?.name)
        || getProductUomName(item.product_uom, item.product_uom?.product?.name)
        || ''
      const code = item.code ?? ''
      return name.toLowerCase().includes(s) || code.toLowerCase().includes(s)
    })
  }, [items, searchText])

  const stats = useMemo(() => {
    const outOfStock = filtered.filter((i: any) => Number(i.display_qty ?? i.stock ?? 0) <= 0)
    const lowStock = filtered.filter(
      (i: any) =>
        Number(i.display_qty ?? i.stock ?? 0) > 0 &&
        Number(i.display_qty ?? i.stock ?? 0) <= Number(i.min_qty ?? 5),
    )
    const ok = filtered.length - outOfStock.length - lowStock.length
    return { outOfStock, lowStock, ok }
  }, [filtered])

  const sortedRows = useMemo(() => {
    const okRows = filtered.filter(
      (i: any) =>
        Number(i.display_qty ?? i.stock ?? 0) > 0 &&
        Number(i.display_qty ?? i.stock ?? 0) > Number(i.min_qty ?? 5),
    )
    return [...stats.outOfStock, ...stats.lowStock, ...okRows]
  }, [filtered, stats])

  const itemName = (item: any) =>
    getProductUomName(item.product_uom_batch?.product_uom, item.product_uom_batch?.product_uom?.product?.name)
    || getProductUomName(item.product_uom, item.product_uom?.product?.name)
    || '—'
  const itemUom = (item: any) =>
    item.display_uom_code
    ?? item.product_uom_batch?.product_uom?.uom?.name
    ?? item.product_uom_batch?.product_uom?.uom?.code
    ?? item.product_uom?.uom?.name
    ?? item.product_uom?.uom?.code
    ?? '—'

  const handleExport = () => {
    if (!enabled || isLoading || sortedRows.length === 0) {
      toast.error('Generate the report first')
      return
    }
    const rows: ExcelRow[] = [
      ...reportHeader({
        title: 'Stock Position Report',
        branch: branchName,
        extra: [
          ...(productTypeFilter ? [`Product Type : ${productTypeFilter.toUpperCase()}`] : []),
          ...(searchText ? [`Search : ${searchText}`] : []),
        ],
      }),
      ['No', 'Product Code', 'Product Name', 'UOM', 'Branch', 'Current Stock', 'Min Qty', 'Status', 'Alert'],
      ...sortedRows.map((item: any, idx: number) => {
        const stock = Number(item.display_qty ?? item.stock ?? 0)
        const minQty = Number(item.min_qty ?? 5)
        return [
          idx + 1,
          item.code,
          itemName(item),
          itemUom(item),
          item.branch?.name ?? '—',
          stock,
          item.min_qty ?? '—',
          item.status === 'active' ? 'Active' : 'Inactive',
          stock <= 0 ? 'OUT OF STOCK' : stock <= minQty ? 'LOW STOCK' : '',
        ]
      }),
    ]
    downloadExcel('stock-positions.xlsx', [
      { name: 'Stock Position', rows, cols: [6, 16, 40, 10, 22, 14, 10, 10, 14] },
    ])
  }

  const onGenerate = () => {
    setEnabled(true)
    refetch()
  }


  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '24px 24px 48px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 10px; margin: 0; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #000; padding: 2px 5px; font-size: 10px; }
          thead { background: #f0f0f0 !important; }
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
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: 'var(--foreground-muted)',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Download size={14} />
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Printer size={14} />
            Print
          </button>
        </div>
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
            color: 'var(--foreground)',
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
          {branchName}
        </span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            display: 'block',
            marginTop: 6,
            color: 'var(--foreground)',
          }}
        >
          Stock Position Report
        </span>
        <span
          style={{
            fontSize: 12,
            color: 'var(--foreground-muted)',
            display: 'block',
            marginTop: 2,
          }}
        >
          As of: {new Date().toLocaleDateString('id-ID')}
        </span>
        <span
          style={{ fontSize: 11, color: 'var(--foreground-muted)', display: 'block' }}
        >
          Printed: {new Date().toLocaleString('id-ID')}
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
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Search</label>
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--foreground-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search code or name..."
                style={{
                  ...inputStyle,
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Product Type</label>
            <select
              value={productTypeFilter}
              onChange={(e) =>
                setProductTypeFilter(e.target.value as any)
              }
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">All</option>
              <option value="raw">Raw</option>
              <option value="wip">WIP</option>
              <option value="final">Final</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Branch</label>
            <ReportBranchSelect
              value={branchFilter}
              onChange={setBranchFilter}
              style={inputStyle}
            />
          </div>
          <button
            type="button"
            onClick={onGenerate}
            style={{
              padding: '7px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {isFetching ? 'Loading...' : 'Generate'}
          </button>
        </div>
      </div>

      {enabled && (
        <div
          className="no-print"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={statCardStyle}>
            <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              Total Items
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--foreground)',
                marginTop: 4,
              }}
            >
              {filtered.length}
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>OK</div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--success)',
                marginTop: 4,
              }}
            >
              {stats.ok}
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              Low Stock
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--warning)',
                marginTop: 4,
              }}
            >
              {stats.lowStock.length}
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              Out of Stock
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--destructive)',
                marginTop: 4,
              }}
            >
              {stats.outOfStock.length}
            </div>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
            background: 'var(--surface)',
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>No</th>
              <th style={thStyle}>Product Code</th>
              <th style={thStyle}>Product Name</th>
              <th style={thStyle}>UOM</th>
              <th style={thStyle}>Branch</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Current Stock</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Min Qty</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Alert</th>
            </tr>
          </thead>
          <tbody>
            {!enabled && (
              <tr>
                <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', padding: 32 }}>
                  Set filters and click Generate to load report.
                </td>
              </tr>
            )}
            {enabled && isLoading && (
              <tr>
                <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', padding: 32 }}>
                  Loading...
                </td>
              </tr>
            )}
            {enabled && !isLoading && sortedRows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', padding: 32 }}>
                  No inventory items match the filters.
                </td>
              </tr>
            )}
            {sortedRows.map((item: any, idx: number) => {
              const stock = Number(item.display_qty ?? item.stock ?? 0)
              const minQty = Number(item.min_qty ?? 5)
              const isOut = stock <= 0
              const isLow = !isOut && stock <= minQty
              const stockColor = isOut
                ? 'var(--destructive)'
                : isLow
                  ? 'var(--warning)'
                  : 'var(--success)'
              return (
                <tr
                  key={item.id}
                  style={{
                    background: isOut
                      ? 'rgba(239,68,68,0.05)'
                      : isLow
                        ? 'rgba(245,158,11,0.05)'
                        : 'transparent',
                  }}
                >
                  <td style={tdStyle}>{idx + 1}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>
                    {item.code}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>
                    {itemName(item)}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: 'var(--foreground-muted)' }}>
                    {itemUom(item)}
                  </td>
                  <td style={tdStyle}>{item.branch?.name ?? '—'}</td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'right',
                      fontWeight: 700,
                      color: stockColor,
                    }}
                  >
                    {stock.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--foreground-muted)' }}>
                    {item.min_qty ?? '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 600,
                        background:
                          item.status === 'active'
                            ? 'var(--success-bg)'
                            : 'var(--background)',
                        color:
                          item.status === 'active'
                            ? 'var(--success)'
                            : 'var(--foreground-muted)',
                      }}
                    >
                      {item.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'center',
                      fontWeight: 600,
                      fontSize: 11,
                    }}
                  >
                    {isOut ? (
                      <span style={{ color: 'var(--destructive)' }}>OUT OF STOCK</span>
                    ) : isLow ? (
                      <span style={{ color: 'var(--warning)' }}>LOW STOCK</span>
                    ) : (
                      <span style={{ color: 'var(--foreground-subtle)' }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
