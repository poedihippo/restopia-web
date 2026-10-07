'use client'
import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDate, toInputDate } from '@/utils/date'
import {
  stockOpnamesService,
  StockOpnameResponse,
  StockOpnameProductGroup,
  StockOpnameDetailItem,
  UpdateStockOpnameRequest,
  UpdateStockOpnameDetailLineRequest,
} from '@/services/stock-opnames.service'
import { getProductUomName } from '@/utils/productUomName'
import { toastMutationApiError } from '@/utils/apiError'
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  Search,
  X,
} from 'lucide-react'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'var(--foreground-muted)', bg: 'var(--surface)' },
  counting: { label: 'Counting', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  completed: { label: 'Completed', color: 'var(--success)', bg: 'var(--success-bg)' },
  cancelled: { label: 'Cancelled', color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
}

interface LineCountState {
  counted_qty: number | null
  count_items: Array<{ id?: number; uom_id: number; counted_qty: number | string }>
  description: string
}

function getLineKey(d: StockOpnameDetailItem): string {
  if (d.id != null && d.id !== 0) return `so-${d.id}`
  if (d.product_inventory_id != null) return `inv-${d.product_inventory_id}`
  if (d.product_inventory?.id != null) return `inv-${d.product_inventory.id}`
  return `unk-${d.product_uom_id ?? 0}`
}

function getInventoryId(d: StockOpnameDetailItem): number | undefined {
  if (d.product_inventory_id != null) return Number(d.product_inventory_id)
  if (d.product_inventory?.id != null) return Number(d.product_inventory.id)
  return undefined
}

function isCountedState(s?: LineCountState): boolean {
  if (!s) return false
  if (Array.isArray(s.count_items) && s.count_items.length > 0) {
    return s.count_items.some((ci) => ci.counted_qty !== '' && ci.counted_qty !== null && ci.counted_qty !== undefined)
  }
  return s.counted_qty !== null && s.counted_qty !== undefined
}

function hasVarianceState(detail: StockOpnameDetailItem, state?: LineCountState): boolean {
  if (!isCountedState(state)) return false
  if (Array.isArray(state!.count_items) && state!.count_items.length > 0) {
    return (detail.variance ?? 0) !== 0
  }
  if (state!.counted_qty === null || state!.counted_qty === undefined) return false
  return Number(state!.counted_qty) !== Number(detail.system_qty)
}

function getVariance(detail: StockOpnameDetailItem, state?: LineCountState): number | null {
  if (!isCountedState(state)) return null
  if (Array.isArray(state!.count_items) && state!.count_items.length > 0) {
    return detail.variance ?? 0
  }
  if (state!.counted_qty === null || state!.counted_qty === undefined) return null
  return Number(state!.counted_qty) - Number(detail.system_qty)
}

interface StockOpnameDetailProps {
  idProp?: number | string
  initialData?: StockOpnameResponse
}

export default function StockOpnameDetail({ idProp, initialData }: StockOpnameDetailProps) {
  const router = useRouter()
  const resolvedId = idProp ? String(idProp) : router.query.id ? String(router.query.id) : ''
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['stock-opnames', resolvedId],
    queryFn: () =>
      stockOpnamesService
        .findById(Number(resolvedId), { include: 'products,stock_opname_details,branch,created_by' })
        .then((r) => r.data),
    enabled: !!resolvedId,
    initialData: initialData
      ? { success: true, message: 'OK', data: initialData }
      : undefined,
  })

  const item: StockOpnameResponse | undefined = (data as any)?.data

  const [headerDate, setHeaderDate] = useState<string>('')
  const [headerDescription, setHeaderDescription] = useState<string>('')
  const [lineCounts, setLineCounts] = useState<Record<string, LineCountState>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'counted' | 'variance'>('all')

  useEffect(() => {
    if (item) {
      setHeaderDate(toInputDate(item.date))
      setHeaderDescription(item.description || '')
    }
  }, [item?.id, item?.date, item?.description])

  const productGroups: StockOpnameProductGroup[] = useMemo(() => {
    if (!item) return []
    if (item.products && item.products.length > 0) return item.products
    if (item.stock_opname_details && item.stock_opname_details.length > 0) {
      const groupMap = new Map<number, StockOpnameProductGroup>()
      item.stock_opname_details.forEach((d) => {
        const puId = d.product_inventory?.product_uom_id || d.product_inventory?.product_uom?.id || d.id
        if (!groupMap.has(puId)) {
          groupMap.set(puId, {
            product_uom_id: puId,
            product_uom: d.product_inventory?.product_uom,
            stock_opname_details: [],
          })
        }
        groupMap.get(puId)!.stock_opname_details.push(d)
      })
      return Array.from(groupMap.values())
    }
    return []
  }, [item])

  useEffect(() => {
    if (!item) return
    const initialCounts: Record<string, LineCountState> = {}

    const processDetail = (d: StockOpnameDetailItem) => {
      const hasCountItems = Array.isArray(d.count_items) && d.count_items.length > 0
      const hasCountedQty = d.counted_qty !== null && d.counted_qty !== undefined
      initialCounts[getLineKey(d)] = {
        counted_qty: hasCountedQty ? Number(d.counted_qty) : null,
        count_items: hasCountItems
          ? d.count_items!.map((ci) => ({
              id: ci.id,
              uom_id: Number(ci.uom_id),
              counted_qty: ci.counted_qty ?? '',
            }))
          : [],
        description: d.description || '',
      }
    }

    if (item.products && item.products.length > 0) {
      item.products.forEach((g) => g.stock_opname_details?.forEach(processDetail))
    } else if (item.stock_opname_details) {
      item.stock_opname_details.forEach(processDetail)
    }

    setLineCounts(initialCounts)
  }, [item])

  const allLines = useMemo(() => {
    return productGroups.flatMap((g) =>
      (g.stock_opname_details || []).map((d) => ({ group: g, detail: d }))
    )
  }, [productGroups])

  const countedLines = allLines.filter(({ detail }) => isCountedState(lineCounts[getLineKey(detail)])).length
  const varianceLines = allLines.filter(({ detail }) =>
    hasVarianceState(detail, lineCounts[getLineKey(detail)])
  ).length
  const totalLines = allLines.length
  const remainingLines = totalLines - countedLines
  const progressPercent = totalLines > 0 ? Math.round((countedLines / totalLines) * 100) : 0
  const isAllCounted = totalLines > 0 && countedLines === totalLines

  const filteredLines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return allLines.filter(({ group, detail }) => {
      const state = lineCounts[getLineKey(detail)]
      const counted = isCountedState(state)
      const variance = hasVarianceState(detail, state)

      if (filterMode === 'pending' && counted) return false
      if (filterMode === 'counted' && !counted) return false
      if (filterMode === 'variance' && !variance) return false

      if (!q) return true
      const name =
        getProductUomName(group.product_uom, group.product_uom?.product?.name) ||
        group.product_uom?.code ||
        ''
      const batch = detail.product_inventory?.product_uom_batch?.batch_code || ''
      const code = group.product_uom?.product?.code || ''
      return (
        name.toLowerCase().includes(q) ||
        batch.toLowerCase().includes(q) ||
        code.toLowerCase().includes(q)
      )
    })
  }, [allLines, lineCounts, searchQuery, filterMode])

  const status = item?.status?.toLowerCase() || 'draft'
  const isReadOnly = status === 'completed' || status === 'cancelled'
  const statusMeta = STATUS_META[status] || STATUS_META.draft

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateStockOpnameRequest) =>
      stockOpnamesService.update(Number(resolvedId), payload),
    onSuccess: () => {
      toast.success('Stock Opname saved')
      queryClient.invalidateQueries({ queryKey: ['stock-opnames'] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to save'),
  })

  const completeMutation = useMutation({
    mutationFn: () => stockOpnamesService.complete(Number(resolvedId)),
    onSuccess: () => {
      toast.success('Stock Opname completed')
      queryClient.invalidateQueries({ queryKey: ['stock-opnames'] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to complete'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => stockOpnamesService.cancel(Number(resolvedId)),
    onSuccess: () => {
      toast.success('Stock Opname cancelled')
      queryClient.invalidateQueries({ queryKey: ['stock-opnames'] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to cancel'),
  })

  const handleSave = () => {
    if (!item) return

    const payloadProducts = productGroups.map((g) => {
      const count_lines = (g.stock_opname_details || []).map((d) => {
        const lineKey = getLineKey(d)
        const state = lineCounts[lineKey]
        const invId = getInventoryId(d)
        const line: UpdateStockOpnameDetailLineRequest = {
          ...(invId != null ? { product_inventory_id: invId } : {}),
          product_uom_id: Number(g.product_uom_id),
        }
        if (state?.description) line.description = state.description
        if (Array.isArray(state?.count_items) && state.count_items.length > 0) {
          const validItems = state.count_items
            .filter((ci) => ci.uom_id && ci.counted_qty !== '' && ci.counted_qty !== null)
            .map((ci) => ({
              ...(ci.id ? { id: ci.id } : {}),
              uom_id: Number(ci.uom_id),
              counted_qty: Number(ci.counted_qty),
            }))
          if (validItems.length > 0) line.count_items = validItems
        }
        if (state && state.counted_qty !== null && state.counted_qty !== undefined) {
          line.counted_qty = Number(state.counted_qty)
        }
        return line
      })
      return { product_uom_id: Number(g.product_uom_id), count_lines }
    })

    updateMutation.mutate({
      date: headerDate || toInputDate(item.date) || undefined,
      description: headerDescription || undefined,
      products: payloadProducts,
    })
  }

  const handleComplete = () => {
    if (!isAllCounted) {
      toast.error(`Cannot complete: ${remainingLines} line(s) remain uncounted.`)
      return
    }
    if (confirm('Complete this Stock Opname? Inventory will be adjusted permanently.')) {
      completeMutation.mutate()
    }
  }

  const handleCancel = () => {
    if (confirm('Cancel this Stock Opname?')) {
      cancelMutation.mutate()
    }
  }

  const updateQty = (lineKey: string, val: string) => {
    setLineCounts((prev) => {
      const current = prev[lineKey] || { counted_qty: null, count_items: [], description: '' }
      return {
        ...prev,
        [lineKey]: {
          ...current,
          counted_qty: val === '' ? null : Number(val),
        },
      }
    })
  }

  if (isLoading || !item) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--foreground-muted)' }} />
        <p style={{ marginTop: 12, color: 'var(--foreground-muted)', fontSize: 14 }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          paddingBottom: 16,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <button
            onClick={() => router.push('/products/product-inventory/stock-opname')}
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--foreground)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontWeight: 600,
                  margin: 0,
                  color: 'var(--foreground)',
                }}
              >
                Stock Opname {item.code}
              </h1>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: statusMeta.color,
                  backgroundColor: statusMeta.bg,
                  border: '1px solid var(--border)',
                }}
              >
                {statusMeta.label}
              </span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--foreground-muted)' }}>
              {formatDate(item.date)} · {item.branch?.name || '—'}
              {item.created_by?.name ? ` · ${item.created_by.name}` : ''}
            </p>
          </div>
        </div>

        {!isReadOnly && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending || completeMutation.isPending || cancelMutation.isPending}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                background: 'var(--accent)',
                border: '1px solid var(--accent)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {updateMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save Progress
            </button>
            <button
              onClick={handleComplete}
              disabled={!isAllCounted || completeMutation.isPending || updateMutation.isPending}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                background: isAllCounted ? 'var(--success)' : 'var(--surface)',
                border: `1px solid ${isAllCounted ? 'var(--success)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 600,
                color: isAllCounted ? '#fff' : 'var(--foreground-muted)',
                cursor: !isAllCounted ? 'not-allowed' : 'pointer',
                opacity: !isAllCounted ? 0.6 : 1,
              }}
            >
              {completeMutation.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              Complete {isAllCounted ? '' : `(${remainingLines} left)`}
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelMutation.isPending || completeMutation.isPending}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 14px',
                background: 'transparent',
                border: '1px solid var(--destructive)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--destructive)',
                cursor: 'pointer',
              }}
            >
              <XCircle size={15} />
              Cancel
            </button>
          </div>
        )}
      </div>

      {isReadOnly && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: status === 'completed' ? 'var(--success-bg)' : 'var(--destructive-bg)',
            color: status === 'completed' ? 'var(--success)' : 'var(--destructive)',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {status === 'completed'
            ? 'This Stock Opname is completed and read-only.'
            : 'This Stock Opname is cancelled and read-only.'}
        </div>
      )}

      {/* Progress summary */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
          <div>
            <span style={{ color: 'var(--foreground-muted)' }}>Total Lines: </span>
            <strong>{totalLines}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--foreground-muted)' }}>Counted: </span>
            <strong style={{ color: countedLines > 0 ? 'var(--success)' : 'var(--foreground)' }}>
              {countedLines}
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--foreground-muted)' }}>Uncounted: </span>
            <strong style={{ color: remainingLines > 0 ? 'var(--warning)' : 'var(--success)' }}>
              {remainingLines}
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--foreground-muted)' }}>Discrepancy: </span>
            <strong style={{ color: varianceLines > 0 ? 'var(--warning)' : 'var(--foreground)' }}>
              {varianceLines}
            </strong>
          </div>
        </div>

        <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: isAllCounted ? 'var(--success)' : 'var(--accent)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
          {progressPercent}% complete
          {!isReadOnly && remainingLines > 0
            ? ' — fill the Counted Qty column for each line, then click Save Progress.'
            : ''}
        </div>
      </div>

      {/* Notes */}
      {!isReadOnly && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 16,
          }}
        >
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: 6 }}>
            Notes (optional)
          </label>
          <input
            type="text"
            placeholder="Notes for this stock opname..."
            value={headerDescription}
            onChange={(e) => setHeaderDescription(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              color: 'var(--foreground)',
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* Search + Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 400 }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--foreground-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Filter product, batch code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              color: 'var(--foreground)',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--foreground-muted)',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {(
            [
              { id: 'all', label: `All Lines (${totalLines})` },
              { id: 'pending', label: `Uncounted (${remainingLines})` },
              { id: 'counted', label: `Counted (${countedLines})` },
              { id: 'variance', label: `Discrepancy (${varianceLines})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterMode(tab.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                border: filterMode === tab.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: filterMode === tab.id ? 'var(--accent)' : 'var(--surface)',
                color: filterMode === tab.id ? '#fff' : 'var(--foreground-muted)',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count sheet table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {filteredLines.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>
            {totalLines === 0 ? 'No items to count.' : 'No matching items found.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                  <th style={thStyle}>No</th>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>Batch</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>System Qty</th>
                  <th style={{ ...thStyle, minWidth: 140 }}>Counted Qty</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Variance</th>
                </tr>
              </thead>
              <tbody>
                {filteredLines.map(({ group, detail }, idx) => {
                  const lineKey = getLineKey(detail)
                  const state = lineCounts[lineKey] || { counted_qty: null, count_items: [], description: '' }
                  const counted = isCountedState(state)
                  const variance = getVariance(detail, state)

                  const productName =
                    getProductUomName(group.product_uom, group.product_uom?.product?.name) ||
                    group.product_uom?.code ||
                    `Item #${group.product_uom_id}`
                  const uomLabel =
                    group.product_uom?.uom?.name ||
                    group.product_uom?.uom?.code ||
                    group.product_uom?.product?.base_uom?.name ||
                    ''
                  const batchCode = detail.product_inventory?.product_uom_batch?.batch_code || '—'
                  const expiry = detail.product_inventory?.product_uom_batch?.expiry_date

                  let varianceText = '—'
                  let varianceColor = 'var(--foreground-muted)'
                  if (variance !== null) {
                    varianceText = variance > 0 ? `+${variance}` : String(variance)
                    varianceColor = variance > 0 ? 'var(--success)' : variance < 0 ? 'var(--destructive)' : 'var(--foreground-muted)'
                  }

                  return (
                    <tr
                      key={lineKey}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: counted ? 'transparent' : 'var(--warning-bg)',
                      }}
                    >
                      <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', width: 48 }}>
                        {idx + 1}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{productName}</div>
                        {uomLabel && (
                          <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 2 }}>
                            {uomLabel}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: 13, fontFamily: 'monospace' }}>{batchCode}</div>
                        {expiry && (
                          <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 2 }}>
                            Exp: {formatDate(expiry)}
                          </div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{detail.system_qty}</div>
                        {uomLabel && (
                          <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>{uomLabel}</div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {isReadOnly ? (
                          <div style={{ fontSize: 14, fontWeight: 600 }}>
                            {counted
                              ? state.counted_qty !== null && state.counted_qty !== undefined
                                ? `${state.counted_qty}${uomLabel ? ` ${uomLabel}` : ''}`
                                : state.count_items.map((ci) => `${ci.counted_qty}`).join(' + ')
                              : '—'}
                          </div>
                        ) : (
                          <input
                            type="number"
                            step="any"
                            min={0}
                            placeholder="Enter qty"
                            value={state.counted_qty === null || state.counted_qty === undefined ? '' : state.counted_qty}
                            onChange={(e) => updateQty(lineKey, e.target.value)}
                            style={{
                              width: 120,
                              padding: '8px 10px',
                              background: 'var(--background)',
                              border: `1px solid ${counted ? 'var(--success)' : 'var(--border)'}`,
                              borderRadius: 'var(--radius-md)',
                              fontSize: 14,
                              fontWeight: 600,
                              color: 'var(--foreground)',
                              outline: 'none',
                            }}
                          />
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: varianceColor,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background:
                              varianceColor === 'var(--success)'
                                ? 'var(--success-bg)'
                                : varianceColor === 'var(--destructive)'
                                ? 'var(--destructive-bg)'
                                : 'transparent',
                          }}
                        >
                          {varianceText}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isReadOnly && totalLines > 0 && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--foreground-muted)' }}>
          Fill the <strong>Counted Qty</strong> column with the physical stock count.{' '}
          <strong>Variance</strong> is calculated automatically. After all lines are filled, click{' '}
          <strong>Save Progress</strong> then <strong>Complete</strong>.
        </p>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: 13,
  color: 'var(--foreground)',
  verticalAlign: 'middle',
}
