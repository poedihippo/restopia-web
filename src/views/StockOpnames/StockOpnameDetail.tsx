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
  UpdateStockOpnameCountLine,
} from '@/services/stock-opnames.service'
import { uomsService } from '@/services/uoms.service'
import { productUomsService } from '@/services/product-uoms.service'
import { productConversionsService } from '@/services/product-conversions.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { toastMutationApiError } from '@/utils/apiError'
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Printer,
  Save,
  Plus,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Boxes,
  Calendar,
  Building,
  User,
  X,
} from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft: {
    label: 'Draft',
    color: '#64748b',
    bg: '#f8fafc',
    border: '#cbd5e1',
  },
  counting: {
    label: 'Counting',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
  },
  completed: {
    label: 'Completed',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
  },
  cancelled: {
    label: 'Cancelled',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
  },
}

interface LineCountState {
  counted_qty: number | null
  isMultiUom: boolean
  count_items: Array<{ id?: number; uom_id: number; counted_qty: number | string }>
  description: string
  isNewBatch?: boolean
}

interface StockOpnameDetailProps {
  idProp?: number | string
  initialData?: StockOpnameResponse
}

export default function StockOpnameDetail({ idProp, initialData }: StockOpnameDetailProps) {
  const router = useRouter()
  const resolvedId = idProp ? String(idProp) : router.query.id ? String(router.query.id) : ''
  const queryClient = useQueryClient()

  // 1. Queries
  const { data, isLoading } = useQuery({
    queryKey: ['stock-opnames', resolvedId],
    queryFn: () =>
      stockOpnamesService.findById(Number(resolvedId), { include: 'products' }).then((r) => r.data),
    enabled: !!resolvedId,
    initialData: initialData
      ? {
          success: true,
          message: 'OK',
          data: initialData,
        }
      : undefined,
  })

  const item: StockOpnameResponse | undefined = (data as any)?.data

  const { data: uomsData } = useQuery({
    queryKey: ['uoms', 'all'],
    queryFn: () => uomsService.list({ per_page: 200 }).then((r) => (r.data as any)?.data || []).catch(() => []),
  })

  const { data: productUomsData } = useQuery({
    queryKey: ['product-uoms', 'stock-opname'],
    queryFn: () => productUomsService.list({ per_page: 200, include: 'product,uom' }).then((r) => (r.data as any)?.data || []).catch(() => []),
  })

  const { data: productConversionsData } = useQuery({
    queryKey: ['product-conversions', 'stock-opname'],
    queryFn: () => productConversionsService.list({ per_page: 200, include: 'product,uom,target_uom' }).then((r) => (r.data as any)?.data || []).catch(() => []),
  })

  const rawGlobalUoms: any[] = (uomsData as any) || []
  const rawProductUoms: any[] = (productUomsData as any) || []
  const rawConversions: any[] = (productConversionsData as any) || []

  // 2. State
  const [headerDate, setHeaderDate] = useState<string>('')
  const [headerDescription, setHeaderDescription] = useState<string>('')
  const [lineCounts, setLineCounts] = useState<Record<number, LineCountState>>({})
  const [extraBatches, setExtraBatches] = useState<Record<number, StockOpnameDetailItem[]>>({})

  // UI filter & accordion states
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'counted' | 'variance'>('all')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<number, boolean>>({})
  const [modalAddBatchGroup, setModalAddBatchGroup] = useState<StockOpnameProductGroup | null>(null)

  // Sync header info when item loads
  useEffect(() => {
    if (item) {
      setHeaderDate(toInputDate(item.date))
      setHeaderDescription(item.description || '')
    }
  }, [item?.id, item?.date, item?.description])

  // Normalize product groups (support new products[] and legacy flat stock_opname_details)
  const productGroups: StockOpnameProductGroup[] = useMemo(() => {
    if (!item) return []
    if (item.products && item.products.length > 0) {
      return item.products
    }
    if (item.stock_opname_details && item.stock_opname_details.length > 0) {
      const groupMap = new Map<number, StockOpnameProductGroup>()
      item.stock_opname_details.forEach((d) => {
        const puId =
          d.product_inventory?.product_uom_id ||
          d.product_inventory?.product_uom?.id ||
          d.id
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

  // Sync line counts from loaded item
  useEffect(() => {
    if (!item) return
    const initialCounts: Record<number, LineCountState> = {}

    const processDetail = (d: StockOpnameDetailItem) => {
      const hasCountItems = Array.isArray(d.count_items) && d.count_items.length > 0
      const hasCountedQty = d.counted_qty !== null && d.counted_qty !== undefined

      initialCounts[d.product_inventory_id] = {
        counted_qty: hasCountedQty ? Number(d.counted_qty) : null,
        isMultiUom: hasCountItems,
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
      item.products.forEach((g) => {
        g.stock_opname_details?.forEach(processDetail)
      })
    } else if (item.stock_opname_details) {
      item.stock_opname_details.forEach(processDetail)
    }

    setLineCounts((prev) => {
      const merged = { ...initialCounts }
      Object.entries(prev).forEach(([idStr, state]) => {
        if (state.isNewBatch && !merged[Number(idStr)]) {
          merged[Number(idStr)] = state
        }
      })
      return merged
    })
  }, [item])

  // Helper map for all known UoMs
  const allKnownUomsMap = useMemo(() => {
    const map = new Map<number, { id: number; name: string; code: string }>()
    const addUom = (u: any) => {
      if (u && typeof u.id === 'number' && u.id > 0 && !map.has(u.id)) {
        map.set(u.id, {
          id: u.id,
          name: u.name || u.code || `UoM #${u.id}`,
          code: u.code || u.name || `UoM #${u.id}`,
        })
      }
    }
    rawGlobalUoms.forEach(addUom)
    rawProductUoms.forEach((pu: any) => addUom(pu.uom))
    rawConversions.forEach((conv: any) => {
      addUom(conv.uom)
      addUom(conv.target_uom)
    })
    return map
  }, [rawGlobalUoms, rawProductUoms, rawConversions])

  // Get available UoM options for a row
  const getDetailUomOptions = (detail: StockOpnameDetailItem, group: StockOpnameProductGroup) => {
    const rowMap = new Map<number, { id: number; name: string; code: string }>()
    const addRowUom = (u: any) => {
      if (u && typeof u.id === 'number' && u.id > 0 && !rowMap.has(u.id)) {
        rowMap.set(u.id, {
          id: u.id,
          name: u.name || u.code || `UoM #${u.id}`,
          code: u.code || u.name || `UoM #${u.id}`,
        })
      }
    }

    // Group UoM and Product Base UoM
    addRowUom(group.product_uom?.uom)
    addRowUom(group.product_uom?.product?.base_uom)
    // Row inventory UoM
    addRowUom(detail.product_inventory?.product_uom_batch?.product_uom?.uom)
    addRowUom(detail.product_inventory?.product_uom?.uom)
    addRowUom(detail.product_inventory?.product_uom_batch?.product_uom?.product?.base_uom)
    addRowUom(detail.product_inventory?.product_uom?.product?.base_uom)

    const productId =
      group.product_uom?.product_id ||
      group.product_uom?.product?.id ||
      detail.product_inventory?.product_uom?.product_id ||
      detail.product_inventory?.product_uom_batch?.product_uom?.product_id

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

    allKnownUomsMap.forEach((uom, uomId) => {
      if (!rowMap.has(uomId)) {
        rowMap.set(uomId, uom)
      }
    })

    return Array.from(rowMap.values())
  }

  // 3. Stats calculation
  const allCurrentLines = useMemo(() => {
    const list: { group: StockOpnameProductGroup; detail: StockOpnameDetailItem }[] = []
    productGroups.forEach((g) => {
      const lines = [
        ...(g.stock_opname_details || []),
        ...(extraBatches[g.product_uom_id] || []),
      ]
      lines.forEach((d) => list.push({ group: g, detail: d }))
    })
    return list
  }, [productGroups, extraBatches])

  const totalLinesCount = allCurrentLines.length

  const countedLinesCount = useMemo(() => {
    return allCurrentLines.filter(({ detail }) => {
      const state = lineCounts[detail.product_inventory_id]
      if (!state) return false
      if (state.isMultiUom) {
        return state.count_items.some(
          (ci) => ci.counted_qty !== '' && ci.counted_qty !== null && ci.counted_qty !== undefined
        )
      }
      return state.counted_qty !== null && state.counted_qty !== undefined
    }).length
  }, [allCurrentLines, lineCounts])

  const linesWithVarianceCount = useMemo(() => {
    return allCurrentLines.filter(({ detail }) => {
      const state = lineCounts[detail.product_inventory_id]
      if (!state) return false
      if (state.isMultiUom) {
        return (detail.variance ?? 0) !== 0
      }
      if (state.counted_qty === null || state.counted_qty === undefined) return false
      return Number(state.counted_qty) !== Number(detail.system_qty)
    }).length
  }, [allCurrentLines, lineCounts])

  const isAllCounted = totalLinesCount > 0 && countedLinesCount === totalLinesCount
  const progressPercent = totalLinesCount > 0 ? Math.round((countedLinesCount / totalLinesCount) * 100) : 0

  const status = item?.status?.toLowerCase() || 'draft'
  const isReadOnly = status === 'completed' || status === 'cancelled'
  const statusMeta = STATUS_CONFIG[status] || STATUS_CONFIG.draft

  // 4. Mutations
  const updateMutation = useMutation({
    mutationFn: (payload: UpdateStockOpnameRequest) =>
      stockOpnamesService.update(Number(resolvedId), payload),
    onSuccess: (res) => {
      toast.success('Stock Opname progress saved')
      setExtraBatches({})
      queryClient.setQueryData(['stock-opnames', resolvedId], res)
      queryClient.invalidateQueries({ queryKey: ['stock-opnames'] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to save progress'),
  })

  const completeMutation = useMutation({
    mutationFn: () => stockOpnamesService.complete(Number(resolvedId)),
    onSuccess: (res) => {
      toast.success('Stock Opname marked as completed!')
      queryClient.setQueryData(['stock-opnames', resolvedId], res)
      queryClient.invalidateQueries({ queryKey: ['stock-opnames'] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to complete'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => stockOpnamesService.cancel(Number(resolvedId)),
    onSuccess: (res) => {
      toast.success('Stock Opname cancelled')
      queryClient.setQueryData(['stock-opnames', resolvedId], res)
      queryClient.invalidateQueries({ queryKey: ['stock-opnames'] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to cancel'),
  })

  // 5. Actions Handlers
  const handleSaveProgress = () => {
    if (!item) return

    const payloadProducts = productGroups.map((g) => {
      const allLines = [
        ...(g.stock_opname_details || []),
        ...(extraBatches[g.product_uom_id] || []),
      ]

      const count_lines: UpdateStockOpnameCountLine[] = allLines.map((d) => {
        const state = lineCounts[d.product_inventory_id]
        const line: UpdateStockOpnameCountLine = {
          product_inventory_id: Number(d.product_inventory_id),
        }

        if (state?.description) {
          line.description = state.description
        }

        if (state?.isMultiUom) {
          const validItems = state.count_items
            .filter((ci) => ci.uom_id && ci.counted_qty !== '' && ci.counted_qty !== null)
            .map((ci) => ({
              ...(ci.id ? { id: ci.id } : {}),
              uom_id: Number(ci.uom_id),
              counted_qty: String(ci.counted_qty),
            }))
          if (validItems.length > 0) {
            line.count_items = validItems
          }
          if (state.counted_qty !== null && state.counted_qty !== undefined) {
            line.counted_qty = Number(state.counted_qty)
          }
        } else if (state && state.counted_qty !== null && state.counted_qty !== undefined) {
          line.counted_qty = Number(state.counted_qty)
        }

        return line
      })

      return {
        product_uom_id: Number(g.product_uom_id),
        count_lines,
      }
    })

    const payload: UpdateStockOpnameRequest = {
      date: headerDate || toInputDate(item.date) || undefined,
      description: headerDescription || undefined,
      products: payloadProducts,
    }

    updateMutation.mutate(payload)
  }

  const handleComplete = () => {
    if (!isAllCounted) {
      toast.error(
        `Cannot complete: ${totalLinesCount - countedLinesCount} line(s) remain uncounted. All lines must be counted before completing.`
      )
      return
    }

    if (
      confirm(
        `Are you sure you want to complete this Stock Opname?\n\nAll ${totalLinesCount} lines have been counted. This will finalize inventory stock balances and write journals permanently.`
      )
    ) {
      completeMutation.mutate()
    }
  }

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel this Stock Opname? This action cannot be undone.')) {
      cancelMutation.mutate()
    }
  }

  // Row count changes
  const updateLineSingleQty = (invId: number, val: string) => {
    setLineCounts((prev) => {
      const current = prev[invId] || {
        counted_qty: null,
        isMultiUom: false,
        count_items: [],
        description: '',
      }
      return {
        ...prev,
        [invId]: {
          ...current,
          counted_qty: val === '' ? null : Number(val),
        },
      }
    })
  }

  const toggleMultiUom = (
    invId: number,
    detail: StockOpnameDetailItem,
    group: StockOpnameProductGroup
  ) => {
    setLineCounts((prev) => {
      const current = prev[invId] || {
        counted_qty: null,
        isMultiUom: false,
        count_items: [],
        description: '',
      }

      if (current.isMultiUom) {
        return {
          ...prev,
          [invId]: {
            ...current,
            isMultiUom: false,
          },
        }
      } else {
        const defaultUomId =
          group.product_uom?.uom_id ||
          group.product_uom?.uom?.id ||
          detail.product_inventory?.product_uom?.uom_id ||
          rawGlobalUoms[0]?.id ||
          1
        const initialCountItems =
          current.count_items.length > 0
            ? current.count_items
            : [
                {
                  uom_id: Number(defaultUomId),
                  counted_qty: current.counted_qty ?? 0,
                },
              ]

        return {
          ...prev,
          [invId]: {
            ...current,
            isMultiUom: true,
            count_items: initialCountItems,
          },
        }
      }
    })
  }

  const updateCountItem = (invId: number, idx: number, field: 'uom_id' | 'counted_qty', val: any) => {
    setLineCounts((prev) => {
      const current = prev[invId]
      if (!current) return prev
      const newItems = [...current.count_items]
      newItems[idx] = {
        ...newItems[idx],
        [field]: field === 'uom_id' ? Number(val) : val,
      }
      return {
        ...prev,
        [invId]: {
          ...current,
          count_items: newItems,
        },
      }
    })
  }

  const addCountItem = (invId: number, group: StockOpnameProductGroup) => {
    setLineCounts((prev) => {
      const current = prev[invId]
      if (!current) return prev
      const defaultUomId = group.product_uom?.uom_id || group.product_uom?.uom?.id || rawGlobalUoms[0]?.id || 1
      return {
        ...prev,
        [invId]: {
          ...current,
          count_items: [...current.count_items, { uom_id: Number(defaultUomId), counted_qty: 0 }],
        },
      }
    })
  }

  const removeCountItem = (invId: number, idx: number) => {
    setLineCounts((prev) => {
      const current = prev[invId]
      if (!current) return prev
      const newItems = current.count_items.filter((_, i) => i !== idx)
      return {
        ...prev,
        [invId]: {
          ...current,
          count_items: newItems,
        },
      }
    })
  }

  const updateLineDescription = (invId: number, desc: string) => {
    setLineCounts((prev) => {
      const current = prev[invId] || {
        counted_qty: null,
        isMultiUom: false,
        count_items: [],
        description: '',
      }
      return {
        ...prev,
        [invId]: {
          ...current,
          description: desc,
        },
      }
    })
  }

  // Filter & Search matching
  const filteredProductGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return productGroups
      .map((group) => {
        const allLines = [
          ...(group.stock_opname_details || []),
          ...(extraBatches[group.product_uom_id] || []),
        ]

        const groupMatches =
          !q ||
          group.product_uom?.product?.name?.toLowerCase().includes(q) ||
          group.product_uom?.product?.code?.toLowerCase().includes(q) ||
          group.product_uom?.code?.toLowerCase().includes(q)

        const matchingLines = allLines.filter((detail) => {
          const state = lineCounts[detail.product_inventory_id]
          const isCounted = state?.isMultiUom
            ? state.count_items.some((ci) => ci.counted_qty !== '' && ci.counted_qty !== null)
            : state?.counted_qty !== null && state?.counted_qty !== undefined

          const hasVariance =
            isCounted &&
            (state?.isMultiUom
              ? (detail.variance ?? 0) !== 0
              : Number(state?.counted_qty) !== Number(detail.system_qty))

          if (filterMode === 'pending' && isCounted) return false
          if (filterMode === 'counted' && !isCounted) return false
          if (filterMode === 'variance' && !hasVariance) return false

          if (!q) return true
          if (groupMatches) return true

          const batchCode = detail.product_inventory?.product_uom_batch?.batch_code?.toLowerCase() || ''
          const location = detail.product_inventory?.location_ref?.toLowerCase() || ''
          const owner = detail.product_inventory?.owner_ref?.toLowerCase() || ''
          const stage = detail.product_inventory?.stage?.toLowerCase() || ''
          const desc = state?.description?.toLowerCase() || ''

          return (
            batchCode.includes(q) ||
            location.includes(q) ||
            owner.includes(q) ||
            stage.includes(q) ||
            desc.includes(q)
          )
        })

        return {
          ...group,
          displayLines: matchingLines,
          totalLinesInGroup: allLines.length,
        }
      })
      .filter((g) => g.displayLines.length > 0 || !q)
  }, [productGroups, extraBatches, lineCounts, searchQuery, filterMode])

  if (isLoading || !item) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 80,
          gap: 16,
        }}
      >
        <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary)' }} />
        <p style={{ margin: 0, color: 'var(--foreground-muted)', fontSize: 14 }}>
          Loading Stock Opname count sheet...
        </p>
      </div>
    )
  }

  return (
    <div className="stock-opname-sheet" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Print Styles */}
      <style>{`
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .print-hidden { display: none !important; }
          .print-only { display: block !important; }
          .stock-opname-sheet { gap: 12px !important; }
          .product-group-card { break-inside: avoid; border: 1px solid #ccc !important; box-shadow: none !important; margin-bottom: 12px !important; }
          th, td { padding: 4px 8px !important; font-size: 11px !important; }
          .count-blank-line { display: inline-block; width: 60px; border-bottom: 1px solid #000; height: 14px; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>

      {/* Top Navigation Bar */}
      <div
        className="print-hidden"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 20,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <button
            onClick={() => router.push('/products/product-inventory/stock-opname')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--foreground)',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
            title="Back to Stock Opnames"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 24,
                  fontWeight: 600,
                  margin: 0,
                  color: 'var(--foreground)',
                }}
              >
                Stock Opname {item.code}
              </h1>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: statusMeta.color,
                  backgroundColor: statusMeta.bg,
                  border: `1px solid ${statusMeta.border}`,
                }}
              >
                {statusMeta.label}
              </span>
            </div>
            <p
              style={{
                fontSize: 13,
                color: 'var(--foreground-muted)',
                margin: '6px 0 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={14} /> {formatDate(item.date)}
              </span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Building size={14} /> {item.branch?.name || 'Current Branch'}
              </span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <User size={14} /> {item.created_by?.name || 'Staff'}
              </span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => window.print()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--foreground)',
              cursor: 'pointer',
            }}
          >
            <Printer size={15} />
            <span>Print Sheet</span>
          </button>

          {!isReadOnly && (
            <>
              <button
                id="btn-save-progress"
                onClick={handleSaveProgress}
                disabled={updateMutation.isPending || completeMutation.isPending || cancelMutation.isPending}
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
                  opacity: updateMutation.isPending ? 0.7 : 1,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                {updateMutation.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                <span>Save Progress</span>
              </button>

              <button
                id="btn-complete-opname"
                onClick={handleComplete}
                disabled={!isAllCounted || completeMutation.isPending || updateMutation.isPending}
                title={
                  !isAllCounted
                    ? `Cannot complete: ${totalLinesCount - countedLinesCount} lines remain uncounted.`
                    : 'Complete and finalize stock movements'
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  background: isAllCounted ? '#16a34a' : 'var(--surface)',
                  border: `1px solid ${isAllCounted ? '#16a34a' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: isAllCounted ? '#fff' : 'var(--foreground-muted)',
                  cursor: !isAllCounted || completeMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: !isAllCounted ? 0.6 : 1,
                  boxShadow: isAllCounted ? '0 2px 4px rgba(22, 163, 74, 0.25)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {completeMutation.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                <span>
                  Complete {isAllCounted ? '' : `(${totalLinesCount - countedLinesCount} left)`}
                </span>
              </button>

              <button
                onClick={handleCancel}
                disabled={cancelMutation.isPending || completeMutation.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  background: 'transparent',
                  border: '1px solid var(--destructive)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--destructive)',
                  cursor: cancelMutation.isPending ? 'not-allowed' : 'pointer',
                }}
              >
                <XCircle size={15} />
                <span>Cancel</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Read-Only Status Banner */}
      {isReadOnly && (
        <div
          className="print-hidden"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderRadius: 'var(--radius-lg)',
            background: status === 'completed' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${status === 'completed' ? '#bbf7d0' : '#fecaca'}`,
            color: status === 'completed' ? '#166534' : '#991b1b',
          }}
        >
          {status === 'completed' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              This Stock Opname is {statusMeta.label} (Read-Only)
            </div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              {status === 'completed'
                ? 'Stock movements have been posted and inventory balances adjusted permanently.'
                : 'This document has been cancelled. No stock movements were applied.'}
            </div>
          </div>
        </div>
      )}

      {/* Top Metric Cards */}
      <div
        className="print-hidden"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={kpiLabelStyle}>Products & Batches</span>
            <Boxes size={18} style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)' }}>
              {productGroups.length}
            </span>
            <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
              products ({totalLinesCount} batch lines)
            </span>
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={kpiLabelStyle}>Counting Progress</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: isAllCounted ? '#16a34a' : 'var(--primary)',
              }}
            >
              {progressPercent}%
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)' }}>
              {countedLinesCount}
            </span>
            <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
              of {totalLinesCount} lines counted
            </span>
          </div>
          {/* Visual Progress Bar */}
          <div
            style={{
              height: 6,
              width: '100%',
              background: 'var(--border)',
              borderRadius: 3,
              marginTop: 10,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: isAllCounted ? '#16a34a' : 'var(--primary)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={kpiLabelStyle}>Variance Detected</span>
            <AlertTriangle
              size={18}
              style={{ color: linesWithVarianceCount > 0 ? '#d97706' : 'var(--foreground-muted)' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: linesWithVarianceCount > 0 ? '#d97706' : 'var(--foreground)',
              }}
            >
              {linesWithVarianceCount}
            </span>
            <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
              lines with stock discrepancy
            </span>
          </div>
        </div>
      </div>

      {/* Document Header Fields (Editable in Draft/Counting) */}
      <div
        className="print-hidden"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          background: 'var(--surface)',
          padding: 18,
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle}>Date</label>
          <input
            type="date"
            value={headerDate}
            disabled={isReadOnly}
            onChange={(e) => setHeaderDate(e.target.value)}
            style={{
              ...inputStyle,
              background: isReadOnly ? 'transparent' : 'var(--background)',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle}>Branch</label>
          <div
            style={{
              ...inputStyle,
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {item.branch?.name || '—'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Opname Notes / Description</label>
          <input
            type="text"
            placeholder="Add general notes for this stock opname session..."
            value={headerDescription}
            disabled={isReadOnly}
            onChange={(e) => setHeaderDescription(e.target.value)}
            style={{
              ...inputStyle,
              background: isReadOnly ? 'transparent' : 'var(--background)',
            }}
          />
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div
        className="print-hidden"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 440 }}>
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
            placeholder="Filter product, batch code, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              ...inputStyle,
              paddingLeft: 38,
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
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {(
            [
              { id: 'all', label: `All Lines (${totalLinesCount})` },
              { id: 'pending', label: `Uncounted (${totalLinesCount - countedLinesCount})` },
              { id: 'counted', label: `Counted (${countedLinesCount})` },
              { id: 'variance', label: `Discrepancy (${linesWithVarianceCount})` },
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
                border: filterMode === tab.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: filterMode === tab.id ? 'var(--primary)' : 'var(--surface)',
                color: filterMode === tab.id ? '#fff' : 'var(--foreground-muted)',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}

          {/* Toggle All Groups */}
          <button
            onClick={() => {
              const allCollapsed = productGroups.every((g) => collapsedGroups[g.product_uom_id])
              const newMap: Record<number, boolean> = {}
              productGroups.forEach((g) => {
                newMap[g.product_uom_id] = !allCollapsed
              })
              setCollapsedGroups(newMap)
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--foreground)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {productGroups.every((g) => collapsedGroups[g.product_uom_id]) ? (
              <>
                <ChevronDown size={14} /> Expand All
              </>
            ) : (
              <>
                <ChevronUp size={14} /> Collapse All
              </>
            )}
          </button>
        </div>
      </div>

      {/* Product Groups & Batches Count Sheet */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {filteredProductGroups.length === 0 ? (
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              padding: 48,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Boxes size={36} style={{ color: 'var(--foreground-muted)' }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>No matching items found</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--foreground-muted)' }}>
              Try adjusting your search query or filter criteria.
            </p>
          </div>
        ) : (
          filteredProductGroups.map((group) => {
            const isCollapsed = !!collapsedGroups[group.product_uom_id]
            const productName =
              group.product_uom?.product?.name ||
              group.product_uom?.code ||
              `Product UoM #${group.product_uom_id}`
            const productCode = group.product_uom?.product?.code || group.product_uom?.code || ''
            const uomLabel =
              group.product_uom?.uom?.name ||
              group.product_uom?.uom?.code ||
              group.product_uom?.product?.base_uom?.name ||
              'Unit'

            const groupLines = group.displayLines
            const groupTotalLines = group.totalLinesInGroup
            const groupCountedLines = groupLines.filter((d) => {
              const state = lineCounts[d.product_inventory_id]
              return state?.isMultiUom
                ? state.count_items.some((ci) => ci.counted_qty !== '' && ci.counted_qty !== null)
                : state?.counted_qty !== null && state?.counted_qty !== undefined
            }).length

            const isGroupFullyCounted = groupTotalLines > 0 && groupCountedLines === groupTotalLines

            return (
              <div
                key={group.product_uom_id}
                className="product-group-card"
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                {/* Group Heading */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    background: 'var(--surface-muted, rgba(0,0,0,0.02))',
                    borderBottom: isCollapsed ? 'none' : '1px solid var(--border)',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  onClick={() =>
                    setCollapsedGroups((prev) => ({
                      ...prev,
                      [group.product_uom_id]: !isCollapsed,
                    }))
                  }
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      className="print-hidden"
                      type="button"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 2,
                        display: 'flex',
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                    </button>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)' }}>
                          {productName}
                        </span>
                        {productCode && (
                          <span
                            style={{
                              fontSize: 11,
                              fontFamily: 'monospace',
                              padding: '2px 6px',
                              background: 'var(--background)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--foreground-muted)',
                            }}
                          >
                            {productCode}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            background: 'var(--primary-light, rgba(99, 102, 241, 0.1))',
                            color: 'var(--primary)',
                            borderRadius: 'var(--radius-full)',
                            fontWeight: 600,
                          }}
                        >
                          {uomLabel}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--foreground-muted)',
                          marginTop: 2,
                        }}
                      >
                        {groupTotalLines} batch {groupTotalLines === 1 ? 'line' : 'lines'} •{' '}
                        <span style={{ color: isGroupFullyCounted ? '#16a34a' : 'var(--foreground-muted)' }}>
                          {groupCountedLines}/{groupTotalLines} counted
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className="print-hidden"
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => setModalAddBatchGroup(group)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 10px',
                          background: 'var(--surface)',
                          border: '1px dashed var(--border)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12,
                          fontWeight: 500,
                          color: 'var(--primary)',
                          cursor: 'pointer',
                        }}
                        title="Add unlisted batch belonging to this product"
                      >
                        <Plus size={14} /> Add Batch
                      </button>
                    )}
                  </div>
                </div>

                {/* Group Details Table */}
                {!isCollapsed && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: 'var(--background)',
                          }}
                        >
                          <th style={{ ...thStyle, width: 40, textAlign: 'center' }}>#</th>
                          <th style={thStyle}>Batch Code & Expiry</th>
                          <th style={thStyle}>Dimensions</th>
                          <th style={{ ...thStyle, textAlign: 'right', width: 120 }}>
                            System Qty
                          </th>
                          <th style={{ ...thStyle, minWidth: 260 }}>Physical Count</th>
                          <th
                            className="print-hidden"
                            style={{ ...thStyle, textAlign: 'right', width: 120 }}
                          >
                            Variance
                          </th>
                          {!isReadOnly && (
                            <th
                              className="print-hidden"
                              style={{ ...thStyle, width: 40, textAlign: 'center' }}
                            ></th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {groupLines.map((detail, lineIdx) => {
                          const state = lineCounts[detail.product_inventory_id] || {
                            counted_qty: null,
                            isMultiUom: false,
                            count_items: [],
                            description: '',
                          }

                          const batchObj = detail.product_inventory?.product_uom_batch
                          const batchCode = batchObj?.batch_code || '—'
                          const expiryDate = batchObj?.expiry_date
                            ? formatDate(batchObj.expiry_date)
                            : 'No Expiry'
                          const isExpired =
                            batchObj?.expiry_date &&
                            new Date(batchObj.expiry_date).getTime() < Date.now()

                          const stage = detail.product_inventory?.stage
                          const owner = detail.product_inventory?.owner_ref
                          const location = detail.product_inventory?.location_ref

                          const isLineCounted = state.isMultiUom
                            ? state.count_items.some(
                                (ci) => ci.counted_qty !== '' && ci.counted_qty !== null
                              )
                            : state.counted_qty !== null && state.counted_qty !== undefined

                          // Variance computation
                          let varianceDisplay = '—'
                          let varianceColor = 'var(--foreground-muted)'
                          if (isLineCounted) {
                            if (state.isMultiUom) {
                              const bVariance = detail.variance ?? 0
                              varianceDisplay = bVariance > 0 ? `+${bVariance}` : `${bVariance}`
                              varianceColor =
                                bVariance > 0 ? '#16a34a' : bVariance < 0 ? '#dc2626' : '#64748b'
                            } else {
                              const diff = Number(state.counted_qty) - Number(detail.system_qty)
                              varianceDisplay = diff > 0 ? `+${diff}` : `${diff}`
                              varianceColor = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#64748b'
                            }
                          }

                          const uomOptions = getDetailUomOptions(detail, group)

                          return (
                            <tr
                              key={detail.id || detail.product_inventory_id}
                              style={{
                                borderBottom: '1px solid var(--border)',
                                background: detail.isNewBatch
                                  ? 'rgba(99, 102, 241, 0.03)'
                                  : isLineCounted
                                  ? 'transparent'
                                  : 'rgba(245, 158, 11, 0.02)',
                              }}
                            >
                              {/* # Row Index */}
                              <td
                                style={{
                                  ...tdStyle,
                                  textAlign: 'center',
                                  fontSize: 12,
                                  color: 'var(--foreground-muted)',
                                  verticalAlign: 'top',
                                }}
                              >
                                {lineIdx + 1}
                              </td>

                              {/* Batch Code & Expiry */}
                              <td style={{ ...tdStyle, verticalAlign: 'top' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span
                                      style={{
                                        fontWeight: 600,
                                        fontFamily: 'monospace',
                                        fontSize: 13,
                                      }}
                                    >
                                      {batchCode}
                                    </span>
                                    {detail.isNewBatch && (
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 700,
                                          background: 'var(--primary-light, #e0e7ff)',
                                          color: 'var(--primary)',
                                          padding: '1px 5px',
                                          borderRadius: 3,
                                        }}
                                      >
                                        NEW BATCH
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: isExpired ? '#dc2626' : 'var(--foreground-muted)',
                                      fontWeight: isExpired ? 600 : 400,
                                    }}
                                  >
                                    Exp: {expiryDate} {isExpired ? '(Expired)' : ''}
                                  </span>
                                  <span style={{ fontSize: 10, color: 'var(--foreground-muted)' }}>
                                    INV-{detail.product_inventory_id}
                                  </span>
                                </div>
                              </td>

                              {/* Dimensions (Stage, Owner, Location) */}
                              <td style={{ ...tdStyle, verticalAlign: 'top' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
                                  {location && (
                                    <span style={{ color: 'var(--foreground)' }}>
                                      Loc: <b>{location}</b>
                                    </span>
                                  )}
                                  {stage && (
                                    <span style={{ color: 'var(--foreground-muted)' }}>
                                      Stage: {stage}
                                    </span>
                                  )}
                                  {owner && (
                                    <span style={{ color: 'var(--foreground-muted)' }}>
                                      Owner: {owner}
                                    </span>
                                  )}
                                  {!location && !stage && !owner && (
                                    <span style={{ color: 'var(--foreground-muted)' }}>—</span>
                                  )}
                                </div>
                              </td>

                              {/* System Qty */}
                              <td style={{ ...tdStyle, textAlign: 'right', verticalAlign: 'top' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                                    {detail.system_qty}
                                  </span>
                                  <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                                    {uomLabel}
                                  </span>
                                </div>
                              </td>

                              {/* Physical Count */}
                              <td style={{ ...tdStyle, verticalAlign: 'top' }}>
                                {isReadOnly ? (
                                  /* Read Only Display */
                                  <div>
                                    {state.isMultiUom && state.count_items.length > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        {state.count_items.map((ci, ciIdx) => {
                                          const ciUom = allKnownUomsMap.get(ci.uom_id)?.code || uomLabel
                                          return (
                                            <span key={ciIdx} style={{ fontSize: 13, fontWeight: 600 }}>
                                              {ci.counted_qty} {ciUom}
                                            </span>
                                          )
                                        })}
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: 14, fontWeight: 600 }}>
                                        {state.counted_qty !== null ? `${state.counted_qty} ${uomLabel}` : '—'}
                                      </span>
                                    )}
                                    {state.description && (
                                      <p style={{ margin: '4px 0 0 0', fontSize: 11, color: 'var(--foreground-muted)', fontStyle: 'italic' }}>
                                        Note: {state.description}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  /* Editable Count Input */
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {!state.isMultiUom ? (
                                      /* Single UoM Input */
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <div style={{ position: 'relative', width: 110 }}>
                                          <input
                                            type="number"
                                            step="any"
                                            placeholder="Enter qty"
                                            value={state.counted_qty === null ? '' : state.counted_qty}
                                            onChange={(e) =>
                                              updateLineSingleQty(detail.product_inventory_id, e.target.value)
                                            }
                                            style={{
                                              ...inputStyle,
                                              fontSize: 14,
                                              fontWeight: 600,
                                              borderColor: isLineCounted ? 'var(--primary)' : 'var(--border)',
                                            }}
                                          />
                                        </div>

                                        <span style={{ fontSize: 12, color: 'var(--foreground-muted)', fontWeight: 500 }}>
                                          {uomLabel}
                                        </span>

                                        {/* Quick Match / Zero buttons */}
                                        <div className="print-hidden" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateLineSingleQty(
                                                detail.product_inventory_id,
                                                String(detail.system_qty)
                                              )
                                            }
                                            style={quickBtnStyle}
                                            title="Set counted equal to system stock"
                                          >
                                            Match ({detail.system_qty})
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => updateLineSingleQty(detail.product_inventory_id, '0')}
                                            style={quickBtnStyle}
                                            title="Set count to 0"
                                          >
                                            Zero (0)
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => toggleMultiUom(detail.product_inventory_id, detail, group)}
                                            style={{
                                              ...quickBtnStyle,
                                              color: 'var(--primary)',
                                              borderColor: 'var(--primary)',
                                            }}
                                            title="Split count into multiple units"
                                          >
                                            Multi-UoM
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      /* Multi-UoM Count Items */
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>
                                            Multi-UoM Breakdown
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => toggleMultiUom(detail.product_inventory_id, detail, group)}
                                            style={{
                                              background: 'transparent',
                                              border: 'none',
                                              color: 'var(--foreground-muted)',
                                              fontSize: 11,
                                              cursor: 'pointer',
                                              textDecoration: 'underline',
                                            }}
                                          >
                                            Switch to Single UoM
                                          </button>
                                        </div>

                                        {state.count_items.map((ci, ciIdx) => (
                                          <div key={ciIdx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <input
                                              type="number"
                                              step="any"
                                              placeholder="Qty"
                                              value={ci.counted_qty}
                                              onChange={(e) =>
                                                updateCountItem(
                                                  detail.product_inventory_id,
                                                  ciIdx,
                                                  'counted_qty',
                                                  e.target.value
                                                )
                                              }
                                              style={{
                                                ...inputStyle,
                                                width: 80,
                                                padding: '5px 8px',
                                                fontSize: 13,
                                                fontWeight: 600,
                                              }}
                                            />

                                            <select
                                              value={ci.uom_id}
                                              onChange={(e) =>
                                                updateCountItem(
                                                  detail.product_inventory_id,
                                                  ciIdx,
                                                  'uom_id',
                                                  e.target.value
                                                )
                                              }
                                              style={{
                                                ...inputStyle,
                                                width: 130,
                                                padding: '5px 8px',
                                                fontSize: 12,
                                              }}
                                            >
                                              {uomOptions.map((u) => (
                                                <option key={u.id} value={u.id}>
                                                  {u.code || u.name}
                                                </option>
                                              ))}
                                            </select>

                                            <button
                                              type="button"
                                              onClick={() => removeCountItem(detail.product_inventory_id, ciIdx)}
                                              style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--destructive)',
                                                cursor: 'pointer',
                                                padding: 4,
                                              }}
                                              title="Remove UoM row"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                        ))}

                                        <button
                                          type="button"
                                          onClick={() => addCountItem(detail.product_inventory_id, group)}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--primary)',
                                            fontSize: 11,
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            padding: '2px 0',
                                            width: 'fit-content',
                                          }}
                                        >
                                          <Plus size={13} /> Add Unit Row
                                        </button>
                                      </div>
                                    )}

                                    {/* Line Note Input */}
                                    <input
                                      type="text"
                                      placeholder="Line note (e.g. found in drawer, damaged)..."
                                      value={state.description}
                                      onChange={(e) =>
                                        updateLineDescription(detail.product_inventory_id, e.target.value)
                                      }
                                      style={{
                                        ...inputStyle,
                                        fontSize: 11,
                                        padding: '4px 8px',
                                        background: 'transparent',
                                        borderStyle: 'dashed',
                                      }}
                                    />
                                  </div>
                                )}

                                {/* Print Only representation */}
                                <div className="print-only">
                                  <span className="count-blank-line"></span> {uomLabel}
                                </div>
                              </td>

                              {/* Variance */}
                              <td
                                className="print-hidden"
                                style={{
                                  ...tdStyle,
                                  textAlign: 'right',
                                  verticalAlign: 'top',
                                }}
                              >
                                <span
                                  style={{
                                    display: 'inline-block',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: varianceColor,
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                    background:
                                      varianceColor === '#16a34a'
                                        ? '#f0fdf4'
                                        : varianceColor === '#dc2626'
                                        ? '#fef2f2'
                                        : 'transparent',
                                  }}
                                >
                                  {varianceDisplay}
                                </span>
                              </td>

                              {/* Delete newly added batch line if not saved yet */}
                              {!isReadOnly && (
                                <td
                                  className="print-hidden"
                                  style={{
                                    ...tdStyle,
                                    textAlign: 'center',
                                    verticalAlign: 'top',
                                  }}
                                >
                                  {detail.isNewBatch && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExtraBatches((prev) => ({
                                          ...prev,
                                          [group.product_uom_id]: (prev[group.product_uom_id] || []).filter(
                                            (b) => b.product_inventory_id !== detail.product_inventory_id
                                          ),
                                        }))
                                        setLineCounts((prev) => {
                                          const copy = { ...prev }
                                          delete copy[detail.product_inventory_id]
                                          return copy
                                        })
                                      }}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--destructive)',
                                        cursor: 'pointer',
                                        padding: 4,
                                      }}
                                      title="Remove uncommitted batch line"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Modal: Add New Batch Line for a Product */}
      {modalAddBatchGroup && (
        <AddBatchModal
          branchId={item.branch_id}
          group={modalAddBatchGroup}
          existingInventoryIds={allCurrentLines.map((l) => l.detail.product_inventory_id)}
          onClose={() => setModalAddBatchGroup(null)}
          onSelectBatch={(selectedInventory) => {
            const newDetail: StockOpnameDetailItem = {
              id: -Date.now(),
              product_inventory_id: selectedInventory.id,
              system_qty: selectedInventory.stock ?? selectedInventory.qty ?? 0,
              counted_qty: null,
              variance: null,
              description: '',
              product_inventory: selectedInventory,
              count_items: [],
              isNewBatch: true,
            }

            setExtraBatches((prev) => ({
              ...prev,
              [modalAddBatchGroup.product_uom_id]: [
                ...(prev[modalAddBatchGroup.product_uom_id] || []),
                newDetail,
              ],
            }))

            setLineCounts((prev) => ({
              ...prev,
              [selectedInventory.id]: {
                counted_qty: null,
                isMultiUom: false,
                count_items: [],
                description: '',
                isNewBatch: true,
              },
            }))

            setModalAddBatchGroup(null)
            toast.success(
              `Batch ${selectedInventory.product_uom_batch?.batch_code || selectedInventory.id} added. Enter count and click Save Progress.`
            )
          }}
        />
      )}
    </div>
  )
}

// ── Modal to pick unseen product_inventory for a product UoM ──────────────────────
function AddBatchModal({
  branchId,
  group,
  existingInventoryIds,
  onClose,
  onSelectBatch,
}: {
  branchId?: number
  group: StockOpnameProductGroup
  existingInventoryIds: number[]
  onClose: () => void
  onSelectBatch: (inventory: any) => void
}) {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['available-batches-for-opname', branchId, group.product_uom_id],
    queryFn: () =>
      productInventoriesService
        .list({
          per_page: 200,
          include: 'product_uom_batch,product_uom,product_uom.product,product_uom.uom',
          'filter[branch_id]': branchId ? String(branchId) : undefined,
          'filter[product_uom_id]': String(group.product_uom_id),
        } as any)
        .then((r) => (r.data as any)?.data ?? []),
    enabled: !!group.product_uom_id,
  })

  const rawList: any[] = data || []
  const availableList = useMemo(() => {
    return rawList
      .filter((inv) => !existingInventoryIds.includes(inv.id))
      .filter((inv) => {
        if (!search) return true
        const s = search.toLowerCase()
        const batchCode = inv.product_uom_batch?.batch_code?.toLowerCase() || ''
        const loc = inv.location_ref?.toLowerCase() || ''
        return batchCode.includes(s) || loc.includes(s)
      })
  }, [rawList, existingInventoryIds, search])

  const productName =
    group.product_uom?.product?.name || group.product_uom?.code || `Product UoM #${group.product_uom_id}`

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          width: '100%',
          maxWidth: 620,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
              Add Batch Line
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--foreground-muted)' }}>
              Select an unlisted inventory batch for <b>{productName}</b>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--foreground-muted)',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--foreground-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Search batch code, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                ...inputStyle,
                paddingLeft: 34,
                fontSize: 13,
              }}
            />
          </div>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '12px 20px', overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary)', margin: '0 auto' }} />
            </div>
          ) : availableList.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--foreground-muted)' }}>
              <p style={{ margin: 0, fontSize: 13 }}>No unlisted batches found for this product.</p>
              <p style={{ margin: '4px 0 0 0', fontSize: 12 }}>
                All existing inventory batches are already present on the count sheet.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {availableList.map((inv) => {
                const batchCode = inv.product_uom_batch?.batch_code || `INV-${inv.id}`
                const expiry = inv.product_uom_batch?.expiry_date
                  ? formatDate(inv.product_uom_batch.expiry_date)
                  : 'No expiry'
                const stock = inv.stock ?? inv.qty ?? 0
                const uom = inv.product_uom?.uom?.name || 'Unit'

                return (
                  <div
                    key={inv.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, fontFamily: 'monospace' }}>
                        {batchCode}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 2 }}>
                        Exp: {expiry} {inv.location_ref ? `• Loc: ${inv.location_ref}` : ''}{' '}
                        {inv.stage ? `• Stage: ${inv.stage}` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{stock}</div>
                        <div style={{ fontSize: 10, color: 'var(--foreground-muted)' }}>{uom}</div>
                      </div>

                      <button
                        onClick={() => onSelectBatch(inv)}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--primary)',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Select
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'var(--surface-muted, rgba(0,0,0,0.02))',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              cursor: 'pointer',
              color: 'var(--foreground)',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────────
const kpiCardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '16px 20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
}

const kpiLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--foreground-muted)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  color: 'var(--foreground)',
  outline: 'none',
  transition: 'border-color 0.15s ease',
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
}

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: 13,
  color: 'var(--foreground)',
}

const quickBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: 11,
  fontWeight: 500,
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--foreground-muted)',
  cursor: 'pointer',
  transition: 'all 0.15s',
}
