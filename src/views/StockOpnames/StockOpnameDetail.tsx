'use client'
import { formatDate, toInputDate } from '@/utils/date'
import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { stockOpnamesService, UpdateStockOpnameRequest } from '@/services/stock-opnames.service'
import { toastMutationApiError } from '@/utils/apiError'
import {
  ChevronLeft,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Save,
  Printer,
  Plus,
  Trash2
} from 'lucide-react'
import { uomsService } from '@/services/uoms.service'
import { productUomsService } from '@/services/product-uoms.service'
import { productConversionsService } from '@/services/product-conversions.service'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft: {
    label: 'Draft',
    color: 'var(--foreground-muted)',
    bg: 'var(--surface)',
  },
  counting: {
    label: 'Counting',
    color: 'var(--warning)',
    bg: 'var(--warning-bg)',
  },
  completed: {
    label: 'Completed',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'var(--destructive)',
    bg: 'var(--destructive-bg)',
  },
}

export default function StockOpnameDetail() {
  const router = useRouter()
  const { id } = router.query
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['stock-opnames', id],
    queryFn: () => stockOpnamesService.findById(Number(id), { include: 'branch,created_by,stock_opname_details' }).then(r => r.data),
    enabled: !!id,
  })

  const item = (data as any)?.data

  const { data: uomsData } = useQuery({
    queryKey: ['uoms', 'all'],
    queryFn: () => uomsService.list({ per_page: 200 }).then(r => (r.data as any)?.data || []).catch(() => []),
  })

  const { data: productUomsData } = useQuery({
    queryKey: ['product-uoms', 'stock-opname'],
    queryFn: () => productUomsService.list({ per_page: 200, include: 'product,uom' }).then(r => (r.data as any)?.data || []).catch(() => []),
  })

  const { data: productConversionsData } = useQuery({
    queryKey: ['product-conversions', 'stock-opname'],
    queryFn: () => productConversionsService.list({ per_page: 200, include: 'product,uom,target_uom' }).then(r => (r.data as any)?.data || []).catch(() => []),
  })

  interface UomOption {
    id: number
    name: string
    code: string
  }

  const rawGlobalUoms: any[] = (uomsData as any) || []
  const rawProductUoms: any[] = (productUomsData as any) || []
  const rawConversions: any[] = (productConversionsData as any) || []

  // Collect all known UOMs across all sources (including items and relations in this document)
  const allKnownUomsMap = useMemo(() => {
    const map = new Map<number, UomOption>()

    const addUom = (u: any) => {
      if (u && typeof u.id === 'number' && u.id > 0) {
        if (!map.has(u.id)) {
          map.set(u.id, {
            id: u.id,
            name: u.name || u.code || `UoM #${u.id}`,
            code: u.code || u.name || `UoM #${u.id}`,
          })
        }
      }
    }

    rawGlobalUoms.forEach(addUom)
    rawProductUoms.forEach((pu: any) => addUom(pu.uom))
    rawConversions.forEach((conv: any) => {
      addUom(conv.uom)
      addUom(conv.target_uom)
    })

    if (item?.stock_opname_details) {
      item.stock_opname_details.forEach((d: any) => {
        addUom(d.product_inventory?.product_uom_batch?.product_uom?.uom)
        addUom(d.product_inventory?.product_uom?.uom)
        addUom(d.product_inventory?.product_uom_batch?.product_uom?.product?.base_uom)
        addUom(d.product_inventory?.product_uom?.product?.base_uom)
        if (Array.isArray(d.count_items)) {
          d.count_items.forEach((ci: any) => addUom(ci.uom))
        }
      })
    }

    return map
  }, [rawGlobalUoms, rawProductUoms, rawConversions, item?.stock_opname_details])

  const getDetailUomOptions = (detail: any): UomOption[] => {
    const rowMap = new Map<number, UomOption>()

    const addRowUom = (u: any) => {
      if (u && typeof u.id === 'number' && u.id > 0) {
        if (!rowMap.has(u.id)) {
          rowMap.set(u.id, {
            id: u.id,
            name: u.name || u.code || `UoM #${u.id}`,
            code: u.code || u.name || `UoM #${u.id}`,
          })
        }
      }
    }

    // 1. Current batch product_uom uom
    addRowUom(detail.product_inventory?.product_uom_batch?.product_uom?.uom)
    // 2. Direct product_uom uom
    addRowUom(detail.product_inventory?.product_uom?.uom)
    // 3. Product base UOM
    addRowUom(detail.product_inventory?.product_uom_batch?.product_uom?.product?.base_uom)
    addRowUom(detail.product_inventory?.product_uom?.product?.base_uom)

    // 4. Any UOMs currently in count_items
    if (Array.isArray(detail.count_items)) {
      detail.count_items.forEach((ci: any) => addRowUom(ci.uom))
    }

    // 5. Associated product conversions & product UOMs
    const productId =
      detail.product_inventory?.product_uom_batch?.product_uom?.product_id ||
      detail.product_inventory?.product_uom?.product_id ||
      detail.product_inventory?.product_uom_batch?.product_uom?.product?.id ||
      detail.product_inventory?.product_uom?.product?.id

    if (productId) {
      rawConversions.forEach((conv: any) => {
        if (conv.product_id === productId) {
          addRowUom(conv.uom)
          addRowUom(conv.target_uom)
        }
      })
      rawProductUoms.forEach((pu: any) => {
        if (pu.product_id === productId) {
          addRowUom(pu.uom)
        }
      })
    }

    // 6. Include all other known UOMs so user can count in any unit if needed
    allKnownUomsMap.forEach((uom, uomId) => {
      if (!rowMap.has(uomId)) {
        rowMap.set(uomId, uom)
      }
    })

    return Array.from(rowMap.values())
  }

  type CountItem = { id?: number; uom_id: number; counted_qty: number }
  const [multiUomCounts, setMultiUomCounts] = useState<Record<number, CountItem[]>>({})

  useEffect(() => {
    if (item && item.stock_opname_details) {
      const initial: Record<number, CountItem[]> = {}
      item.stock_opname_details.forEach((d: any) => {
        if (d.count_items && d.count_items.length > 0) {
          initial[d.product_inventory_id] = d.count_items.map((ci: any) => ({
            id: ci.id,
            uom_id: Number(ci.uom_id),
            counted_qty: ci.counted_qty !== undefined && ci.counted_qty !== null ? Number(ci.counted_qty) : 0,
          }))
        } else if (d.counted_qty !== undefined && d.counted_qty !== null) {
          const uomId =
            d.product_inventory?.product_uom_batch?.product_uom?.uom?.id ||
            d.product_inventory?.product_uom?.uom?.id ||
            d.product_inventory?.product_uom_batch?.product_uom?.product?.base_uom?.id ||
            d.product_inventory?.product_uom?.product?.base_uom?.id
          if (uomId) {
            initial[d.product_inventory_id] = [
              { uom_id: Number(uomId), counted_qty: Number(d.counted_qty) },
            ]
          }
        }
      })
      setMultiUomCounts(initial)
    }
  }, [item])

  const updateMutation = useMutation({
    mutationFn: (payload: any) => stockOpnamesService.update(Number(id), payload),
    onSuccess: () => {
      toast.success('Stock Opname progress saved')
      queryClient.invalidateQueries({ queryKey: ['stock-opnames', id] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to save progress'),
  })

  const completeMutation = useMutation({
    mutationFn: () => stockOpnamesService.complete(Number(id)),
    onSuccess: () => {
      toast.success('Stock Opname marked as completed')
      queryClient.invalidateQueries({ queryKey: ['stock-opnames', id] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to complete'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => stockOpnamesService.cancel(Number(id)),
    onSuccess: () => {
      toast.success('Stock Opname cancelled')
      queryClient.invalidateQueries({ queryKey: ['stock-opnames', id] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to cancel'),
  })

  if (isLoading || !item) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
      </div>
    )
  }

  const statusMeta = STATUS_META[item.status?.toLowerCase()] || STATUS_META.draft
  const isDraft = item.status === 'draft' || item.status === 'counting'

  return (
    <div className="stock-opname-detail" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`
        @media print {
          .stock-opname-detail th, .stock-opname-detail td {
            padding: 4px 8px !important;
            font-size: 11px !important;
          }
          .stock-opname-detail h1 { font-size: 18px !important; }
          .stock-opname-detail .info-cards { gap: 8px !important; }
          .stock-opname-detail .info-card { padding: 8px 12px !important; }
          
          .print-only { display: block !important; }
          .print-hidden { display: none !important; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 20,
        }}
      >
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={() => router.back()}
            className="print-hidden"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--foreground)',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 24,
                fontWeight: 500,
                margin: 0,
                color: 'var(--foreground)',
              }}
            >
              Stock Opname {item.code}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: statusMeta.color,
                  backgroundColor: statusMeta.bg,
                }}
              >
                {statusMeta.label}
              </span>
              <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                {formatDate(item.date)}
              </span>
              <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                •
              </span>
              <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                Created At: {item.created_at}
              </span>
            </div>
          </div>
        </div>

        <div className="print-hidden" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => window.print()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--foreground)',
              cursor: 'pointer',
            }}
          >
            <Printer size={16} />
            <span>Print</span>
          </button>
          
          {isDraft && (
            <>
              <button
                onClick={() => {
                  const payload: UpdateStockOpnameRequest = {
                    date: toInputDate(item.date) || undefined,
                    description: item.description || undefined,
                    details: item.stock_opname_details.map((d: any) => {
                      const counts = (multiUomCounts[d.product_inventory_id] || []).filter(
                        (c: any) => c.uom_id && Number(c.uom_id) > 0
                      )
                      return {
                        product_inventory_id: Number(d.product_inventory_id),
                        count_items: counts.map((c: any) => ({
                          ...(c.id ? { id: c.id } : {}),
                          uom_id: Number(c.uom_id),
                          counted_qty: Number(c.counted_qty ?? 0),
                        })),
                        ...(d.description ? { description: d.description } : {}),
                      }
                    }),
                  }
                  updateMutation.mutate(payload)
                }}
                disabled={updateMutation.isPending || cancelMutation.isPending || completeMutation.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  background: 'var(--primary)',
                  border: '1px solid var(--primary)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#fff',
                  cursor: updateMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: updateMutation.isPending ? 0.6 : 1,
                }}
              >
                {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>Save Progress</span>
              </button>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to cancel this Stock Opname?')) {
                    cancelMutation.mutate()
                  }
                }}
                disabled={cancelMutation.isPending || completeMutation.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid var(--destructive)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--destructive)',
                  cursor: cancelMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: cancelMutation.isPending ? 0.6 : 1,
                }}
              >
                <XCircle size={16} />
                <span>Cancel</span>
              </button>
              {item.status !== 'draft' && (
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to complete this Stock Opname? This will update the inventory stock permanently.')) {
                      completeMutation.mutate()
                    }
                  }}
                  disabled={cancelMutation.isPending || completeMutation.isPending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    background: 'var(--success)',
                    border: '1px solid var(--success)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#fff',
                    cursor: completeMutation.isPending ? 'not-allowed' : 'pointer',
                    opacity: completeMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {completeMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  <span>Complete</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="info-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
        <div className="info-card" style={cardStyle}>
          <p style={cardLabelStyle}>Branch</p>
          <p style={cardValueStyle}>{item.branch?.name || '—'}</p>
        </div>
        <div className="info-card" style={cardStyle}>
          <p style={cardLabelStyle}>Created By</p>
          <p style={cardValueStyle}>{item.created_by?.name || '—'}</p>
        </div>
        <div className="info-card" style={cardStyle}>
          <p style={cardLabelStyle}>Description</p>
          <p style={cardValueStyle}>{item.description || '—'}</p>
        </div>
      </div>

      {/* Details Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={18} />
          Document Details
        </h3>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                <th style={{ ...thStyle, width: 40, textAlign: 'center' }}>No.</th>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>UOM</th>
                <th style={thStyle}>Batch Code</th>
                <th style={thStyle}>Expiry Date</th>
                <th style={thStyle}>System Qty</th>
                <th style={thStyle}>Counted Qty</th>
                <th className="print-hidden" style={thStyle}>Difference</th>
              </tr>
            </thead>
            <tbody>
              {(!item.stock_opname_details || item.stock_opname_details.length === 0) ? (
                <tr>
                  <td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--foreground-muted)' }}>
                    No details available
                  </td>
                </tr>
              ) : (
                item.stock_opname_details.map((detail: any, index: number) => {
                  const counts = multiUomCounts[detail.product_inventory_id] || []
                  
                  // Variance from backend is already calculated in detail.variance, 
                  // but for draft we might want to just show the backend variance since we don't have base_qty conversion logic in FE.
                  // Wait, if it's draft, they edit it, we can't easily calculate variance because we need base uom conversion.
                  // We'll just show the backend returned variance, or "-" if edited.
                  const isZeroOrEmpty = counts.length === 0
                  const diffColor = (detail.variance ?? 0) > 0 ? 'var(--success)' : (detail.variance ?? 0) < 0 ? 'var(--destructive)' : 'var(--foreground-muted)'

                  return (
                    <tr key={detail.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, textAlign: 'center', verticalAlign: 'top' }}>{index + 1}</td>
                      <td style={{ ...tdStyle, verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontWeight: 500 }}>
                            {detail.product_inventory?.product_uom_batch?.product_uom?.product?.name || 'Unknown Product'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                            INV-{detail.product_inventory_id}
                          </span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, verticalAlign: 'top' }}>{detail.product_inventory?.product_uom_batch?.product_uom?.uom?.name || '—'}</td>
                      <td style={{ ...tdStyle, verticalAlign: 'top' }}>{detail.product_inventory?.product_uom_batch?.batch_code || '—'}</td>
                      <td style={{ ...tdStyle, verticalAlign: 'top' }}>{detail.product_inventory?.product_uom_batch?.expiry_date ? formatDate(detail.product_inventory.product_uom_batch.expiry_date) : '—'}</td>
                      <td style={{ ...tdStyle, verticalAlign: 'top' }}>{detail.system_qty ?? 0}</td>
                      <td style={{ ...tdStyle, verticalAlign: 'top' }}>
                        {isDraft ? (
                          <div className="print-hidden" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {(() => {
                              const uomOptions = getDetailUomOptions(detail)
                              return (
                                <>
                                  {counts.map((c, cIdx) => (
                                    <div key={cIdx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <input
                                        type="number"
                                        value={c.counted_qty === 0 && cIdx === counts.length - 1 ? '' : c.counted_qty}
                                        onChange={(e) => {
                                          const val = e.target.value === '' ? 0 : Number(e.target.value)
                                          const newCounts = [...counts]
                                          newCounts[cIdx] = { ...newCounts[cIdx], counted_qty: val }
                                          setMultiUomCounts({ ...multiUomCounts, [detail.product_inventory_id]: newCounts })
                                        }}
                                        style={{
                                          width: 80,
                                          padding: '6px 10px',
                                          border: '1px solid var(--border)',
                                          borderRadius: 'var(--radius-sm)',
                                          fontSize: 13,
                                          background: 'var(--background)',
                                          color: 'var(--foreground)',
                                          outline: 'none',
                                        }}
                                        placeholder="Qty"
                                      />
                                      <select
                                        value={c.uom_id || 0}
                                        onChange={(e) => {
                                          const val = Number(e.target.value)
                                          const newCounts = [...counts]
                                          newCounts[cIdx] = { ...newCounts[cIdx], uom_id: val }
                                          setMultiUomCounts({ ...multiUomCounts, [detail.product_inventory_id]: newCounts })
                                        }}
                                        style={{
                                          width: 120,
                                          padding: '6px 10px',
                                          border: '1px solid var(--border)',
                                          borderRadius: 'var(--radius-sm)',
                                          fontSize: 13,
                                          background: 'var(--background)',
                                          color: 'var(--foreground)',
                                          outline: 'none',
                                        }}
                                      >
                                        <option value={0} disabled>Select UoM</option>
                                        {uomOptions.map((u: any) => (
                                          <option key={u.id} value={u.id}>{u.code || u.name}</option>
                                        ))}
                                        {c.uom_id > 0 && !uomOptions.some((u: any) => u.id === c.uom_id) && (
                                          <option value={c.uom_id}>
                                            {allKnownUomsMap.get(c.uom_id)?.code || `UoM #${c.uom_id}`}
                                          </option>
                                        )}
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newCounts = counts.filter((_, i) => i !== cIdx)
                                          setMultiUomCounts({ ...multiUomCounts, [detail.product_inventory_id]: newCounts })
                                        }}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: 'var(--destructive)',
                                          cursor: 'pointer',
                                          padding: 4,
                                          display: 'flex',
                                        }}
                                        title="Delete count row"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const defaultUomId =
                                        detail.product_inventory?.product_uom_batch?.product_uom?.uom?.id ||
                                        detail.product_inventory?.product_uom?.uom?.id ||
                                        uomOptions[0]?.id ||
                                        0
                                      const newCounts = [...counts, { uom_id: Number(defaultUomId), counted_qty: 0 }]
                                      setMultiUomCounts({ ...multiUomCounts, [detail.product_inventory_id]: newCounts })
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'var(--primary)',
                                      fontSize: 12,
                                      fontWeight: 500,
                                      cursor: 'pointer',
                                      padding: '4px 0',
                                      width: 'fit-content'
                                    }}
                                  >
                                    <Plus size={14} /> Add UoM Count
                                  </button>
                                </>
                              )
                            })()}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {detail.count_items && detail.count_items.length > 0 ? (
                              detail.count_items.map((ci: any, idx: number) => {
                                const uomLabel =
                                  ci.uom?.code ||
                                  ci.uom?.name ||
                                  allKnownUomsMap.get(ci.uom_id)?.code ||
                                  `UoM #${ci.uom_id}`
                                return (
                                  <span key={idx} style={{ fontWeight: 600, fontSize: 13 }}>
                                    {ci.counted_qty} {uomLabel}
                                  </span>
                                )
                              })
                            ) : (
                              <span style={{ fontWeight: 600, fontSize: 13 }}>
                                {isZeroOrEmpty ? '___________' : detail.counted_qty}
                              </span>
                            )}
                          </div>
                        )}
                        {isDraft && (
                          <div className="print-only" style={{ fontWeight: 600 }}>
                            {isZeroOrEmpty
                              ? '___________'
                              : counts
                                  .map((c) => {
                                    const uomLabel =
                                      allKnownUomsMap.get(c.uom_id)?.code ||
                                      allKnownUomsMap.get(c.uom_id)?.name ||
                                      ''
                                    return `${c.counted_qty} ${uomLabel}`.trim()
                                  })
                                  .join(' + ')}
                          </div>
                        )}
                      </td>
                      <td className="print-hidden" style={{ ...tdStyle, color: diffColor, fontWeight: 600, verticalAlign: 'top' }}>
                        {isDraft ? '—' : ((detail.variance ?? 0) > 0 ? `+${detail.variance}` : detail.variance)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const cardLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const cardValueStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--foreground)',
}

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
}

const tdStyle: React.CSSProperties = {
  padding: '16px',
  fontSize: 13,
  color: 'var(--foreground)',
}
