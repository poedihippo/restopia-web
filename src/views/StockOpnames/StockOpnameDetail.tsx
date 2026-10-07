'use client'
import React, { useState, useEffect, useMemo, useRef } from 'react'
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
import { uomsService } from '@/services/uoms.service'
import { productUomsService } from '@/services/product-uoms.service'
import { productConversionsService } from '@/services/product-conversions.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { getProductUomName } from '@/utils/productUomName'
import { toastMutationApiError } from '@/utils/apiError'
import {
  ChevronLeft,
  CheckCircle2,
  Circle,
  XCircle,
  Loader2,
  Printer,
  Save,
  Plus,
  Trash2,
  Search,
  X,
  ArrowDown,
  MessageSquarePlus,
} from 'lucide-react'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'var(--foreground-muted)', bg: 'var(--surface)' },
  counting: { label: 'Sedang dihitung', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  completed: { label: 'Selesai', color: 'var(--success)', bg: 'var(--success-bg)' },
  cancelled: { label: 'Dibatalkan', color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
}

interface LineCountState {
  counted_qty: number | null
  isMultiUom: boolean
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
  if (d.product_inventory_id != null && d.product_inventory_id !== 0) return Number(d.product_inventory_id)
  if (d.product_inventory?.id != null) return Number(d.product_inventory.id)
  return undefined
}

function getProductUomIdFromDetail(d: StockOpnameDetailItem): number | undefined {
  if (d.product_uom_id != null && d.product_uom_id !== 0) return Number(d.product_uom_id)
  if (d.product_inventory?.product_uom_id != null) return Number(d.product_inventory.product_uom_id)
  if (d.product_inventory?.product_uom?.id != null) return Number(d.product_inventory.product_uom.id)
  if (d.product_inventory?.product_uom_batch?.product_uom_id != null)
    return Number(d.product_inventory.product_uom_batch.product_uom_id)
  if (d.product_inventory?.product_uom_batch?.product_uom?.id != null)
    return Number(d.product_inventory.product_uom_batch.product_uom.id)
  return undefined
}

/** Unwrap API body → entity. Handles { data: X } and { success, data: X }
 *  and { success, data: { data: X } } without breaking existing shapes. */
function unwrapEntity(body: any): any {
  if (!body || typeof body !== 'object') return body
  // Already an entity (has id / products / stock_opname_details / code)
  if (body.id != null || body.code != null || body.products || body.stock_opname_details) {
    // Nested { data: entity }
    if (body.data && typeof body.data === 'object' && !Array.isArray(body.data) &&
        (body.data.id != null || body.data.code != null || body.data.products || body.data.stock_opname_details)) {
      return body.data
    }
    return body
  }
  // { success, data: entity } or { data: entity }
  if (body.data && typeof body.data === 'object') {
    return unwrapEntity(body.data)
  }
  return body
}

/**
 * Build product groups from the API entity.
 *
 * Backend shape (new):
 *   products: [{ id, product_uom_id, product_uom, stock_opname_details: [{ id, system_qty, counted_qty, ... }] }]
 *
 * Nested stock_opname_details often do NOT carry product_inventory_id / product_inventory.
 * The parent product's product_uom_id MUST be used as the group key.
 */
function buildProductGroups(entity: any): StockOpnameProductGroup[] {
  if (!entity) return []

  const groupMap = new Map<number, StockOpnameProductGroup>()
  const seenDetailKeys = new Set<string>()

  const attachDetail = (puId: number, rawDetail: any, productUom?: any) => {
    if (!rawDetail || typeof rawDetail !== 'object') return
    const key = getLineKey(rawDetail)
    if (seenDetailKeys.has(key)) return
    seenDetailKeys.add(key)

    // Ensure detail carries product_uom_id for save payload
    const detail: StockOpnameDetailItem =
      rawDetail.product_uom_id == null ? { ...rawDetail, product_uom_id: puId } : rawDetail

    if (!groupMap.has(puId)) {
      groupMap.set(puId, {
        product_uom_id: puId,
        product_uom: productUom,
        stock_opname_details: [],
      })
    }
    groupMap.get(puId)!.stock_opname_details.push(detail)
  }

  // PRIMARY: products[] with nested stock_opname_details
  // Use the PARENT product's product_uom_id — details may not have it themselves.
  if (Array.isArray(entity.products)) {
    entity.products.forEach((g: any) => {
      const puId = Number(g?.product_uom_id) || 0
      if (!puId) return
      const details = Array.isArray(g?.stock_opname_details) ? g.stock_opname_details : []
      // Even if nested details array is empty, keep the product if it exists
      // (backend may only return headers). But for count sheet we need lines.
      if (details.length === 0) return
      details.forEach((d: any) => attachDetail(puId, d, g?.product_uom))
    })
  }

  // FALLBACK: flat stock_opname_details when products[] is empty/missing
  if (groupMap.size === 0 && Array.isArray(entity.stock_opname_details)) {
    entity.stock_opname_details.forEach((d: any) => {
      const puId = getProductUomIdFromDetail(d)
      if (puId != null) {
        attachDetail(
          puId,
          d,
          d.product_inventory?.product_uom || d.product_inventory?.product_uom_batch?.product_uom
        )
        return
      }
      // No product_uom link available — still show the row under a synthetic group
      // keyed by detail id so the user can count it.
      const syntheticKey = d.id != null ? -(Number(d.id) || 0) : 0
      attachDetail(syntheticKey, d, undefined)
    })
  }

  // LAST RESORT: product_uoms[] legacy shape
  if (groupMap.size === 0 && Array.isArray(entity.product_uoms)) {
    entity.product_uoms.forEach((d: any) => {
      const puId = Number(d?.product_uom_id || d?.id) || 0
      if (!puId) return
      attachDetail(puId, d, d.product_uom || d)
    })
  }

  return Array.from(groupMap.values()).filter((g) => (g.stock_opname_details?.length ?? 0) > 0)
}

function isCountedState(s?: LineCountState): boolean {
  if (!s) return false
  if (s.isMultiUom && Array.isArray(s.count_items)) {
    return s.count_items.some((ci) => ci.counted_qty !== '' && ci.counted_qty !== null && ci.counted_qty !== undefined)
  }
  return s.counted_qty !== null && s.counted_qty !== undefined
}

function hasVarianceState(detail: StockOpnameDetailItem, state?: LineCountState): boolean {
  if (!isCountedState(state)) return false
  if (state!.isMultiUom) return (detail.variance ?? 0) !== 0
  return Number(state!.counted_qty) !== Number(detail.system_qty)
}

function getVariance(detail: StockOpnameDetailItem, state?: LineCountState): number | null {
  if (!isCountedState(state)) return null
  if (state!.isMultiUom) return detail.variance ?? 0
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
    initialData: initialData ? { success: true, message: 'OK', data: initialData } : undefined,
  })

  // Unwrap: queryFn already did r.data (body). Body may be { data: entity }
  // or { success, data: entity } or { success, data: { data: entity } }.
  const item: StockOpnameResponse | undefined = useMemo(() => {
    const body = (data as any)?.data ?? (data as any)
    const entity = unwrapEntity(body)
    return entity && typeof entity === 'object' ? (entity as StockOpnameResponse) : undefined
  }, [data])

  const { data: uomsData } = useQuery({
    queryKey: ['uoms', 'all'],
    queryFn: () => uomsService.list({ per_page: 200 }).then((r) => (r.data as any)?.data || []).catch(() => []),
  })
  const { data: productUomsData } = useQuery({
    queryKey: ['product-uoms', 'stock-opname'],
    queryFn: () =>
      productUomsService.list({ per_page: 200, include: 'product,uom' }).then((r) => (r.data as any)?.data || []).catch(() => []),
  })
  const { data: productConversionsData } = useQuery({
    queryKey: ['product-conversions', 'stock-opname'],
    queryFn: () =>
      productConversionsService
        .list({ per_page: 200, include: 'product,uom,target_uom' })
        .then((r) => (r.data as any)?.data || [])
        .catch(() => []),
  })

  const rawGlobalUoms: any[] = (uomsData as any) || []
  const rawProductUoms: any[] = (productUomsData as any) || []
  const rawConversions: any[] = (productConversionsData as any) || []

  const [headerDate, setHeaderDate] = useState<string>('')
  const [headerDescription, setHeaderDescription] = useState<string>('')
  const [lineCounts, setLineCounts] = useState<Record<string, LineCountState>>({})
  const [extraBatches, setExtraBatches] = useState<Record<number, StockOpnameDetailItem[]>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'counted' | 'variance'>('all')
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({})
  const [modalAddBatchGroup, setModalAddBatchGroup] = useState<
    (StockOpnameProductGroup & { allLines?: StockOpnameDetailItem[] }) | null
  >(null)

  // Ada perubahan yang belum disimpan?
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  // Peringatan jika user menutup halaman sebelum menyimpan
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  useEffect(() => {
    if (item) {
      setHeaderDate(toInputDate(item.date))
      setHeaderDescription(item.description || '')
    }
  }, [item?.id, item?.date, item?.description])

  const productGroups: StockOpnameProductGroup[] = useMemo(() => {
    return buildProductGroups(item)
  }, [item])

  useEffect(() => {
    if (!item) return
    // Jangan timpa angka yang sedang diketik user dengan data dari server
    if (dirtyRef.current) return
    const initialCounts: Record<string, LineCountState> = {}

    const processDetail = (d: StockOpnameDetailItem) => {
      const hasCountItems = Array.isArray(d.count_items) && d.count_items.length > 0
      const hasCountedQty = d.counted_qty !== null && d.counted_qty !== undefined
      initialCounts[getLineKey(d)] = {
        counted_qty: hasCountedQty ? Number(d.counted_qty) : null,
        isMultiUom: hasCountItems,
        count_items: hasCountItems
          ? d.count_items!.map((ci) => ({ id: ci.id, uom_id: Number(ci.uom_id), counted_qty: ci.counted_qty ?? '' }))
          : [],
        description: d.description || '',
      }
    }

    // Use same normalized groups as the UI so state keys always match rendered rows
    buildProductGroups(item).forEach((g) => {
      g.stock_opname_details?.forEach(processDetail)
    })

    setLineCounts(initialCounts)
  }, [item])

  // All known UoMs for multi-UoM options
  const allKnownUomsMap = useMemo(() => {
    const map = new Map<number, { id: number; name: string; code: string }>()
    const addUom = (u: any) => {
      if (u && typeof u.id === 'number' && u.id > 0 && !map.has(u.id)) {
        map.set(u.id, { id: u.id, name: u.name || u.code || `UoM #${u.id}`, code: u.code || u.name || `UoM #${u.id}` })
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

  const getDetailUomOptions = (detail: StockOpnameDetailItem, group: StockOpnameProductGroup) => {
    const rowMap = new Map<number, { id: number; name: string; code: string }>()
    const addRowUom = (u: any) => {
      if (u && typeof u.id === 'number' && u.id > 0 && !rowMap.has(u.id)) {
        rowMap.set(u.id, { id: u.id, name: u.name || u.code || `UoM #${u.id}`, code: u.code || u.name || `UoM #${u.id}` })
      }
    }
    addRowUom(group.product_uom?.uom)
    addRowUom(group.product_uom?.product?.base_uom)
    addRowUom(detail.product_inventory?.product_uom_batch?.product_uom?.uom)
    addRowUom(detail.product_inventory?.product_uom?.uom)
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
        if (pu.product_id === productId) addRowUom(pu.uom)
      })
    }
    allKnownUomsMap.forEach((uom, uomId) => {
      if (!rowMap.has(uomId)) rowMap.set(uomId, uom)
    })
    return Array.from(rowMap.values())
  }

  // Merge groups with extra batches per product
  const groupsWithLines = useMemo(() => {
    return productGroups.map((g) => {
      const extras = extraBatches[g.product_uom_id] || []
      return { ...g, allLines: [...(g.stock_opname_details || []), ...extras] }
    })
  }, [productGroups, extraBatches])

  const allLines = useMemo(() => {
    return groupsWithLines.flatMap((g) => g.allLines.map((d) => ({ group: g, detail: d })))
  }, [groupsWithLines])

  const totalLines = allLines.length
  const countedLines = allLines.filter(({ detail }) => isCountedState(lineCounts[getLineKey(detail)])).length
  const varianceLines = allLines.filter(({ detail }) => hasVarianceState(detail, lineCounts[getLineKey(detail)])).length
  const remainingLines = totalLines - countedLines
  const progressPercent = totalLines > 0 ? Math.round((countedLines / totalLines) * 100) : 0
  const isAllCounted = totalLines > 0 && countedLines === totalLines

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return groupsWithLines
      .map((g) => {
        const productName =
          getProductUomName(g.product_uom, g.product_uom?.product?.name) || g.product_uom?.code || `Produk #${g.product_uom_id}`
        const productCode = g.product_uom?.product?.code || g.product_uom?.code || ''
        const groupMatches = !q || productName.toLowerCase().includes(q) || productCode.toLowerCase().includes(q)

        const displayLines = g.allLines.filter((detail) => {
          const state = lineCounts[getLineKey(detail)]
          const counted = isCountedState(state)
          const variance = hasVarianceState(detail, state)
          if (filterMode === 'pending' && counted) return false
          if (filterMode === 'counted' && !counted) return false
          if (filterMode === 'variance' && !variance) return false
          if (!q || groupMatches) return true
          const batch = detail.product_inventory?.product_uom_batch?.batch_code?.toLowerCase() || ''
          return batch.includes(q)
        })

        return { ...g, productName, productCode, displayLines }
      })
      .filter((g) => g.displayLines.length > 0)
  }, [groupsWithLines, lineCounts, searchQuery, filterMode])

  const status = item?.status?.toLowerCase() || 'draft'
  const isReadOnly = status === 'completed' || status === 'cancelled'
  const statusMeta = STATUS_META[status] || STATUS_META.draft

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateStockOpnameRequest) => stockOpnamesService.update(Number(resolvedId), payload),
    onSuccess: () => {
      toast.success('Hasil hitungan sudah disimpan')
      setExtraBatches({})
      dirtyRef.current = false
      setDirty(false)
      queryClient.invalidateQueries({ queryKey: ['stock-opnames'] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal menyimpan hasil hitungan'),
  })

  const completeMutation = useMutation({
    mutationFn: () => stockOpnamesService.complete(Number(resolvedId)),
    onSuccess: () => {
      toast.success('Stock Opname selesai!')
      queryClient.invalidateQueries({ queryKey: ['stock-opnames'] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal menyelesaikan Stock Opname'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => stockOpnamesService.cancel(Number(resolvedId)),
    onSuccess: () => {
      toast.success('Stock Opname dibatalkan')
      queryClient.invalidateQueries({ queryKey: ['stock-opnames'] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal membatalkan Stock Opname'),
  })

  const isBusy = updateMutation.isPending || completeMutation.isPending || cancelMutation.isPending

  const handleSaveProgress = () => {
    if (!item) return
    const products = groupsWithLines
      .map((g) => {
        const puId = Number(g.product_uom_id)
        if (!puId) return null
        const count_lines = g.allLines
          .map((d) => {
            const lineKey = getLineKey(d)
            const state = lineCounts[lineKey]
            const invId = getInventoryId(d)
            const line: UpdateStockOpnameDetailLineRequest = {
              ...(invId != null ? { product_inventory_id: invId } : {}),
              product_uom_id: puId,
            }
            if (state?.description) line.description = state.description
            if (state?.isMultiUom) {
              const validItems = state.count_items
                .filter((ci) => ci.uom_id && ci.counted_qty !== '' && ci.counted_qty !== null)
                .map((ci) => ({
                  ...(ci.id ? { id: ci.id } : {}),
                  uom_id: Number(ci.uom_id),
                  counted_qty: Number(ci.counted_qty),
                }))
              if (validItems.length > 0) line.count_items = validItems
              if (state.counted_qty !== null && state.counted_qty !== undefined) {
                line.counted_qty = Number(state.counted_qty)
              }
            } else if (state && state.counted_qty !== null && state.counted_qty !== undefined) {
              line.counted_qty = Number(state.counted_qty)
            }
            return line
          })
          .filter((line) => line.product_inventory_id != null || line.counted_qty != null || (line.count_items?.length ?? 0) > 0)
        if (count_lines.length === 0) return null
        return { product_uom_id: puId, count_lines }
      })
      .filter((g): g is { product_uom_id: number; count_lines: UpdateStockOpnameDetailLineRequest[] } => g != null)

    if (products.length === 0) {
      toast.error('No count data to save. Fill in at least one Counted Qty.')
      return
    }

    updateMutation.mutate({
      date: headerDate || toInputDate(item.date) || undefined,
      description: headerDescription || undefined,
      products,
    })
  }

  const handleComplete = () => {
    if (dirty) {
      toast.error('Ada hitungan yang belum disimpan. Klik "Simpan" dulu, baru klik "Selesai".')
      return
    }
    if (!isAllCounted) {
      toast.error(`Belum bisa selesai: masih ada ${remainingLines} barang yang belum dihitung.`)
      return
    }
    if (
      confirm(
        'Yakin ingin menyelesaikan Stock Opname ini?\n\nStok akan disesuaikan dengan hasil hitungan dan jurnal akan dicatat secara permanen. Setelah ini tidak bisa diubah lagi.'
      )
    ) {
      completeMutation.mutate()
    }
  }

  const handleCancel = () => {
    if (confirm('Yakin ingin membatalkan Stock Opname ini? Pembatalan tidak bisa diurungkan.')) {
      cancelMutation.mutate()
    }
  }

  const emptyState = (): LineCountState => ({ counted_qty: null, isMultiUom: false, count_items: [], description: '' })

  const updateLineSingleQty = (lineKey: string, val: string) => {
    setDirty(true)
    setLineCounts((prev) => {
      const current = prev[lineKey] || emptyState()
      return { ...prev, [lineKey]: { ...current, counted_qty: val === '' ? null : Number(val) } }
    })
  }

  const toggleMultiUom = (lineKey: string, detail: StockOpnameDetailItem, group: StockOpnameProductGroup) => {
    setDirty(true)
    setLineCounts((prev) => {
      const current = prev[lineKey] || emptyState()
      if (current.isMultiUom) {
        return { ...prev, [lineKey]: { ...current, isMultiUom: false } }
      }
      const defaultUomId =
        group.product_uom?.uom_id || group.product_uom?.uom?.id || detail.product_inventory?.product_uom?.uom_id || rawGlobalUoms[0]?.id || 1
      const initialCountItems =
        current.count_items.length > 0
          ? current.count_items
          : [{ uom_id: Number(defaultUomId), counted_qty: current.counted_qty ?? 0 }]
      return { ...prev, [lineKey]: { ...current, isMultiUom: true, count_items: initialCountItems } }
    })
  }

  const updateCountItem = (lineKey: string, idx: number, field: 'uom_id' | 'counted_qty', val: any) => {
    setDirty(true)
    setLineCounts((prev) => {
      const current = prev[lineKey]
      if (!current) return prev
      const newItems = [...current.count_items]
      newItems[idx] = { ...newItems[idx], [field]: field === 'uom_id' ? Number(val) : val }
      return { ...prev, [lineKey]: { ...current, count_items: newItems } }
    })
  }

  const addCountItem = (lineKey: string, group: StockOpnameProductGroup) => {
    setDirty(true)
    setLineCounts((prev) => {
      const current = prev[lineKey]
      if (!current) return prev
      const defaultUomId = group.product_uom?.uom_id || group.product_uom?.uom?.id || rawGlobalUoms[0]?.id || 1
      return {
        ...prev,
        [lineKey]: { ...current, count_items: [...current.count_items, { uom_id: Number(defaultUomId), counted_qty: 0 }] },
      }
    })
  }

  const removeCountItem = (lineKey: string, idx: number) => {
    setDirty(true)
    setLineCounts((prev) => {
      const current = prev[lineKey]
      if (!current) return prev
      return { ...prev, [lineKey]: { ...current, count_items: current.count_items.filter((_, i) => i !== idx) } }
    })
  }

  const updateLineDescription = (lineKey: string, desc: string) => {
    setDirty(true)
    setLineCounts((prev) => {
      const current = prev[lineKey] || emptyState()
      return { ...prev, [lineKey]: { ...current, description: desc } }
    })
  }

  const handleSelectBatch = (group: StockOpnameProductGroup, inv: any) => {
    const puId = Number(group.product_uom_id)
    if (!puId) {
      toast.error('Produk tidak valid')
      return
    }
    const newDetail: StockOpnameDetailItem = {
      id: -Date.now(),
      product_inventory_id: inv.id,
      product_uom_id: puId,
      system_qty: inv.display_qty ?? inv.stock ?? inv.qty ?? 0,
      counted_qty: null,
      variance: null,
      description: '',
      product_inventory: inv,
      count_items: [],
    }
    setDirty(true)
    setExtraBatches((prev) => ({ ...prev, [puId]: [...(prev[puId] || []), newDetail] }))
    setLineCounts((prev) => ({ ...prev, [getLineKey(newDetail)]: emptyState() }))
    setModalAddBatchGroup(null)
    toast.success(`Batch ${inv.product_uom_batch?.batch_code || inv.id} ditambahkan. Isi hitungannya lalu klik Simpan.`)
  }

  const handleRemoveExtra = (puId: number, lineKey: string) => {
    setExtraBatches((prev) => ({ ...prev, [puId]: (prev[puId] || []).filter((b) => getLineKey(b) !== lineKey) }))
    setLineCounts((prev) => {
      const copy = { ...prev }
      delete copy[lineKey]
      return copy
    })
  }

  // Tekan Enter di kolom hitungan → langsung pindah ke barang berikutnya
  const handleCountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-count-input="true"]'))
    const idx = inputs.indexOf(e.currentTarget)
    const next = inputs[idx + 1]
    if (next) {
      next.focus()
      next.select()
      next.scrollIntoView({ block: 'center', behavior: 'smooth' })
    } else {
      e.currentTarget.blur()
      toast.info('Ini barang terakhir di daftar. Klik "Simpan" untuk menyimpan.')
    }
  }

  // Lompat ke barang pertama yang belum dihitung
  const jumpToFirstPending = () => {
    if (filterMode === 'counted' || filterMode === 'variance') setFilterMode('all')
    setTimeout(() => {
      const first = allLines.find(({ detail }) => !isCountedState(lineCounts[getLineKey(detail)]))
      if (!first) return
      const row = document.querySelector<HTMLElement>(`[data-line-key="${getLineKey(first.detail)}"]`)
      if (!row) return
      row.scrollIntoView({ block: 'center', behavior: 'smooth' })
      row.querySelector<HTMLInputElement>('input[data-count-input="true"]')?.focus()
    }, 50)
  }

  if (isLoading || !item) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--foreground-muted)' }} />
        <p style={{ marginTop: 12, color: 'var(--foreground-muted)', fontSize: 14 }}>Memuat Stock Opname...</p>
      </div>
    )
  }

  // Teks petunjuk di dekat tombol Selesai
  let completeHint = ''
  if (dirty) completeHint = 'Ada perubahan yang belum disimpan — klik Simpan dulu.'
  else if (!isAllCounted) completeHint = `Masih ${remainingLines} barang belum dihitung.`
  else completeHint = 'Semua sudah dihitung. Klik Selesai untuk menutup.'

  return (
    <div className="stock-opname-sheet" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <style>{`
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .print-hidden { display: none !important; }
          .stock-opname-sheet { gap: 10px !important; }
          .product-group-card { break-inside: avoid; border: 1px solid #ccc !important; margin-bottom: 10px !important; }
          th, td { padding: 6px 10px !important; font-size: 11px !important; }
        }
        .so-count-input::-webkit-outer-spin-button,
        .so-count-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .so-count-input { -moz-appearance: textfield; }
        .so-count-input:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 3px rgba(0,0,0,0.06); }
        .so-btn:focus-visible, .so-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      `}</style>

      {/* Header: judul + tombol sekunder */}
      <div
        className="print-hidden"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          paddingBottom: 14,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <button
            className="so-btn"
            onClick={() => {
              if (dirty && !confirm('Ada hitungan yang belum disimpan. Tetap keluar dari halaman ini?')) return
              router.push('/products/product-inventory/stock-opname')
            }}
            title="Kembali ke daftar"
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
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>
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

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="so-btn"
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
            <Printer size={15} /> Cetak
          </button>
          {!isReadOnly && (
            <button
              className="so-btn"
              onClick={handleCancel}
              disabled={isBusy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--destructive)',
                cursor: 'pointer',
              }}
            >
              <XCircle size={15} /> Batalkan Opname
            </button>
          )}
        </div>
      </div>

      {isReadOnly && (
        <div
          className="print-hidden"
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
            ? 'Stock Opname ini sudah selesai dan hanya bisa dilihat.'
            : 'Stock Opname ini sudah dibatalkan dan hanya bisa dilihat.'}
        </div>
      )}

      {/* Panduan 3 langkah */}
      {!isReadOnly && (
        <div
          className="print-hidden"
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'stretch',
          }}
        >
          {[
            { n: 1, title: 'Lihat stok sistem', desc: 'Jumlah yang tercatat di komputer.' },
            { n: 2, title: 'Hitung barang di rak', desc: 'Ketik jumlah aslinya di kolom “Hitungan Anda”.' },
            { n: 3, title: 'Klik Simpan', desc: 'Boleh disimpan berkali-kali, lanjutkan kapan saja.' },
          ].map((s) => (
            <div
              key={s.n}
              style={{
                flex: '1 1 220px',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: '10px 14px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {s.n}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{s.title}</div>
                <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 1 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Progres + tanggal + catatan */}
      <div
        className="print-hidden"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, color: 'var(--foreground)' }}>
            <strong style={{ fontSize: 20, color: isAllCounted ? 'var(--success)' : 'var(--accent)' }}>{countedLines}</strong>
            <span style={{ color: 'var(--foreground-muted)' }}> dari {totalLines} barang sudah dihitung</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
            <span style={{ color: 'var(--foreground-muted)' }}>
              Ada selisih:{' '}
              <strong style={{ color: varianceLines > 0 ? 'var(--warning)' : 'var(--foreground)' }}>{varianceLines}</strong>
            </span>
            {!isReadOnly && remainingLines > 0 && (
              <button
                className="so-btn"
                onClick={jumpToFirstPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--accent)',
                  color: 'var(--accent)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <ArrowDown size={14} /> Ke barang yang belum dihitung
              </button>
            )}
          </div>
        </div>
        <div style={{ height: 10, background: 'var(--border)', borderRadius: 5, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: isAllCounted ? 'var(--success)' : 'var(--accent)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {!isReadOnly && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={labelStyle}>Tanggal</label>
              <input
                type="date"
                value={headerDate}
                onChange={(e) => {
                  setHeaderDate(e.target.value)
                  setDirty(true)
                }}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 2, minWidth: 200 }}>
              <label style={labelStyle}>Catatan (boleh dikosongkan)</label>
              <input
                type="text"
                placeholder="Tulis catatan untuk stock opname ini..."
                value={headerDescription}
                onChange={(e) => {
                  setHeaderDescription(e.target.value)
                  setDirty(true)
                }}
                style={inputStyle}
              />
            </div>
          </div>
        )}
      </div>

      {/* Cari + filter */}
      <div
        className="print-hidden"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 340 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-muted)' }} />
          <input
            type="text"
            placeholder="Cari nama produk atau kode batch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ ...inputStyle, padding: '9px 32px 9px 36px', background: 'var(--surface)' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              title="Hapus pencarian"
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--foreground-muted)', cursor: 'pointer', padding: 2 }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(
            [
              { id: 'all', label: `Semua (${totalLines})` },
              { id: 'pending', label: `Belum dihitung (${remainingLines})` },
              { id: 'counted', label: `Sudah dihitung (${countedLines})` },
              { id: 'variance', label: `Ada selisih (${varianceLines})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              className="so-btn"
              onClick={() => setFilterMode(tab.id)}
              style={{
                padding: '7px 13px',
                borderRadius: 'var(--radius-full)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                border: filterMode === tab.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: filterMode === tab.id ? 'var(--accent)' : 'var(--surface)',
                color: filterMode === tab.id ? '#fff' : 'var(--foreground-muted)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Daftar produk */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filteredGroups.length === 0 ? (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 48,
              textAlign: 'center',
              color: 'var(--foreground-muted)',
              fontSize: 14,
            }}
          >
            {totalLines === 0
              ? 'Tidak ada barang yang perlu dihitung.'
              : filterMode === 'pending' && remainingLines === 0
              ? 'Hebat! Semua barang sudah dihitung.'
              : 'Tidak ada barang yang cocok. Coba ubah kata pencarian atau filter.'}
          </div>
        ) : (
          filteredGroups.map((group) => {
            const uomLabel =
              group.product_uom?.uom?.name || group.product_uom?.uom?.code || group.product_uom?.product?.base_uom?.name || ''
            const groupCounted = group.displayLines.filter((d) => isCountedState(lineCounts[getLineKey(d)])).length
            const groupComplete = groupCounted === group.displayLines.length

            return (
              <div
                key={group.product_uom_id}
                className="product-group-card"
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${groupComplete ? 'var(--success)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                }}
              >
                {/* Judul produk */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 18px',
                    background: groupComplete ? 'var(--success-bg)' : 'var(--background)',
                    borderBottom: '1px solid var(--border)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {groupComplete ? (
                      <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                    ) : (
                      <Circle size={18} style={{ color: 'var(--foreground-muted)' }} />
                    )}
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)' }}>{group.productName}</span>
                    {group.productCode && (
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: 'monospace',
                          padding: '2px 6px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--foreground-muted)',
                        }}
                      >
                        {group.productCode}
                      </span>
                    )}
                    {group.displayLines.length > 1 && (
                      <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                        {groupCounted}/{group.displayLines.length} batch dihitung
                      </span>
                    )}
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      className="so-btn"
                      onClick={() => setModalAddBatchGroup(group)}
                      title="Tambahkan batch lain dari produk ini yang belum ada di lembar hitung"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '6px 11px',
                        background: 'var(--surface)',
                        border: '1px dashed var(--accent)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--accent)',
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={14} /> Tambah Batch
                    </button>
                  )}
                </div>

                {/* Tabel baris hitung */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ ...thStyle, width: 44, textAlign: 'center' }}></th>
                        <th style={thStyle}>Kode Batch</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Stok Sistem</th>
                        <th style={{ ...thStyle, minWidth: 260 }}>Hitungan Anda</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Selisih</th>
                        {!isReadOnly && <th style={{ ...thStyle, width: 40 }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {group.displayLines.map((detail) => {
                        const lineKey = getLineKey(detail)
                        const state = lineCounts[lineKey] || emptyState()
                        const counted = isCountedState(state)
                        const variance = getVariance(detail, state)
                        const isNew = detail.id != null && detail.id < 0
                        const batchCode = detail.product_inventory?.product_uom_batch?.batch_code || '—'
                        const expiry = detail.product_inventory?.product_uom_batch?.expiry_date
                        const isExpired = expiry && new Date(expiry).getTime() < Date.now()
                        const uomOptions = getDetailUomOptions(detail, group)
                        const noteVisible = !!state.description || !!openNotes[lineKey]

                        // Selisih dalam kata-kata biasa
                        let varianceText = '—'
                        let varianceColor = 'var(--foreground-muted)'
                        let varianceBg = 'transparent'
                        if (variance !== null) {
                          if (variance > 0) {
                            varianceText = `Lebih ${variance}`
                            varianceColor = 'var(--success)'
                            varianceBg = 'var(--success-bg)'
                          } else if (variance < 0) {
                            varianceText = `Kurang ${Math.abs(variance)}`
                            varianceColor = 'var(--destructive)'
                            varianceBg = 'var(--destructive-bg)'
                          } else {
                            varianceText = 'Sesuai'
                            varianceColor = 'var(--success)'
                          }
                        }

                        return (
                          <tr
                            key={lineKey}
                            data-line-key={lineKey}
                            style={{
                              borderBottom: '1px solid var(--border)',
                              background: isNew ? 'rgba(44,24,16,0.04)' : counted ? 'transparent' : 'var(--warning-bg)',
                            }}
                          >
                            <td style={{ ...tdStyle, textAlign: 'center', width: 44 }}>
                              {counted ? (
                                <CheckCircle2 size={18} style={{ color: 'var(--success)' }} aria-label="Sudah dihitung" />
                              ) : (
                                <Circle size={18} style={{ color: 'var(--foreground-muted)' }} aria-label="Belum dihitung" />
                              )}
                            </td>
                            <td style={tdStyle}>
                              <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>
                                {batchCode}
                                {isNew && (
                                  <span
                                    style={{
                                      marginLeft: 6,
                                      fontSize: 10,
                                      fontWeight: 700,
                                      color: 'var(--accent)',
                                      background: 'var(--accent-light-bg, rgba(44,24,16,0.08))',
                                      padding: '2px 6px',
                                      borderRadius: 3,
                                    }}
                                  >
                                    BARU
                                  </span>
                                )}
                              </div>
                              {expiry && (
                                <div style={{ fontSize: 11, color: isExpired ? 'var(--destructive)' : 'var(--foreground-muted)', marginTop: 2 }}>
                                  {isExpired ? 'Kedaluwarsa: ' : 'Kedaluwarsa: '}
                                  {formatDate(expiry)}
                                </div>
                              )}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>{detail.system_qty}</div>
                              {uomLabel && <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>{uomLabel}</div>}
                            </td>
                            <td style={tdStyle}>
                              {isReadOnly ? (
                                <div style={{ fontSize: 14, fontWeight: 600 }}>
                                  {state.isMultiUom && state.count_items.length > 0
                                    ? state.count_items.map((ci) => `${ci.counted_qty} ${allKnownUomsMap.get(Number(ci.uom_id))?.code || uomLabel}`).join(' + ')
                                    : counted
                                    ? `${state.counted_qty}${uomLabel ? ` ${uomLabel}` : ''}`
                                    : '—'}
                                  {state.description && (
                                    <div style={{ fontSize: 11, color: 'var(--foreground-muted)', fontStyle: 'italic', marginTop: 3 }}>
                                      {state.description}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {!state.isMultiUom ? (
                                    <>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <input
                                          type="number"
                                          inputMode="decimal"
                                          data-count-input="true"
                                          className="so-count-input"
                                          step="any"
                                          min={0}
                                          placeholder="Ketik jumlah"
                                          value={state.counted_qty === null || state.counted_qty === undefined ? '' : state.counted_qty}
                                          onChange={(e) => updateLineSingleQty(lineKey, e.target.value)}
                                          onKeyDown={handleCountKeyDown}
                                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                          style={{
                                            width: 130,
                                            padding: '9px 10px',
                                            background: 'var(--background)',
                                            border: `2px solid ${counted ? 'var(--success)' : 'var(--border)'}`,
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 16,
                                            fontWeight: 700,
                                            color: 'var(--foreground)',
                                            outline: 'none',
                                          }}
                                        />
                                        {uomLabel && <span style={{ fontSize: 12, color: 'var(--foreground-muted)', fontWeight: 500 }}>{uomLabel}</span>}
                                        <button
                                          type="button"
                                          className="so-btn"
                                          onClick={() => updateLineSingleQty(lineKey, String(detail.system_qty))}
                                          style={miniBtnStyle}
                                          title="Isi hitungan dengan angka yang sama seperti stok sistem"
                                        >
                                          Sama dengan sistem
                                        </button>
                                        <button
                                          type="button"
                                          className="so-btn"
                                          onClick={() => updateLineSingleQty(lineKey, '0')}
                                          style={miniBtnStyle}
                                          title="Barang ini tidak ada / kosong"
                                        >
                                          Kosong (0)
                                        </button>
                                      </div>
                                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                                        {!noteVisible && (
                                          <button
                                            type="button"
                                            className="so-link"
                                            onClick={() => setOpenNotes((p) => ({ ...p, [lineKey]: true }))}
                                            style={linkBtnStyle}
                                          >
                                            <MessageSquarePlus size={12} /> Tambah catatan
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          className="so-link"
                                          onClick={() => toggleMultiUom(lineKey, detail, group)}
                                          style={linkBtnStyle}
                                          title="Pakai jika menghitung dengan satuan berbeda, misalnya 2 dus + 5 pcs"
                                        >
                                          <Plus size={12} /> Hitung dengan satuan lain (mis. dus + pcs)
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                                          Hitung dengan beberapa satuan
                                        </span>
                                        <button
                                          type="button"
                                          className="so-link"
                                          onClick={() => toggleMultiUom(lineKey, detail, group)}
                                          style={{ ...linkBtnStyle, color: 'var(--foreground-muted)', textDecoration: 'underline' }}
                                        >
                                          Kembali ke satu satuan
                                        </button>
                                      </div>
                                      {state.count_items.map((ci, ciIdx) => (
                                        <div key={ciIdx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <input
                                            type="number"
                                            inputMode="decimal"
                                            className="so-count-input"
                                            step="any"
                                            placeholder="Jumlah"
                                            value={ci.counted_qty}
                                            onChange={(e) => updateCountItem(lineKey, ciIdx, 'counted_qty', e.target.value)}
                                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                            style={{
                                              width: 90,
                                              padding: '8px 10px',
                                              background: 'var(--background)',
                                              border: '1px solid var(--border)',
                                              borderRadius: 'var(--radius-sm)',
                                              fontSize: 14,
                                              fontWeight: 600,
                                              color: 'var(--foreground)',
                                              outline: 'none',
                                            }}
                                          />
                                          <select
                                            value={ci.uom_id}
                                            onChange={(e) => updateCountItem(lineKey, ciIdx, 'uom_id', e.target.value)}
                                            style={{
                                              width: 120,
                                              padding: '8px 8px',
                                              background: 'var(--background)',
                                              border: '1px solid var(--border)',
                                              borderRadius: 'var(--radius-sm)',
                                              fontSize: 13,
                                              color: 'var(--foreground)',
                                              outline: 'none',
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
                                            className="so-btn"
                                            onClick={() => removeCountItem(lineKey, ciIdx)}
                                            title="Hapus baris satuan ini"
                                            style={{ background: 'transparent', border: 'none', color: 'var(--destructive)', cursor: 'pointer', padding: 6 }}
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      ))}
                                      <button
                                        type="button"
                                        className="so-link"
                                        onClick={() => addCountItem(lineKey, group)}
                                        style={{ ...linkBtnStyle, fontWeight: 600 }}
                                      >
                                        <Plus size={12} /> Tambah satuan lain
                                      </button>
                                    </div>
                                  )}
                                  {noteVisible && (
                                    <input
                                      type="text"
                                      placeholder="Catatan, mis. ditemukan di laci, rusak..."
                                      value={state.description}
                                      onChange={(e) => updateLineDescription(lineKey, e.target.value)}
                                      style={{
                                        width: '100%',
                                        padding: '7px 10px',
                                        background: 'transparent',
                                        border: '1px dashed var(--border)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: 12,
                                        color: 'var(--foreground)',
                                        outline: 'none',
                                      }}
                                    />
                                  )}
                                </div>
                              )}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: varianceColor,
                                  padding: '4px 9px',
                                  borderRadius: 'var(--radius-sm)',
                                  background: varianceBg,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {varianceText}
                              </span>
                            </td>
                            {!isReadOnly && (
                              <td style={{ ...tdStyle, textAlign: 'center' }}>
                                {isNew && (
                                  <button
                                    type="button"
                                    className="so-btn"
                                    onClick={() => handleRemoveExtra(group.product_uom_id, lineKey)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--destructive)', cursor: 'pointer', padding: 4 }}
                                    title="Hapus batch yang baru ditambahkan ini"
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
              </div>
            )
          })
        )}
      </div>

      {/* Bar aksi utama — selalu terlihat di bawah layar */}
      {!isReadOnly && (
        <div
          className="print-hidden"
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            padding: '12px 18px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ minWidth: 200 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: dirty ? 'var(--warning)' : 'var(--foreground)' }}>
              {dirty ? 'Ada perubahan yang belum disimpan' : 'Semua perubahan sudah tersimpan'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}>{completeHint}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="so-btn"
              onClick={handleSaveProgress}
              disabled={isBusy || !dirty}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '11px 22px',
                background: dirty ? 'var(--accent)' : 'var(--surface)',
                border: `1px solid ${dirty ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                fontWeight: 700,
                color: dirty ? '#fff' : 'var(--foreground-muted)',
                cursor: dirty && !isBusy ? 'pointer' : 'not-allowed',
              }}
            >
              {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Simpan
            </button>
            <button
              className="so-btn"
              onClick={handleComplete}
              disabled={!isAllCounted || dirty || isBusy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '11px 22px',
                background: isAllCounted && !dirty ? 'var(--success)' : 'var(--surface)',
                border: `1px solid ${isAllCounted && !dirty ? 'var(--success)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                fontWeight: 700,
                color: isAllCounted && !dirty ? '#fff' : 'var(--foreground-muted)',
                cursor: isAllCounted && !dirty && !isBusy ? 'pointer' : 'not-allowed',
                opacity: isAllCounted && !dirty ? 1 : 0.6,
              }}
            >
              {completeMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Selesai
            </button>
          </div>
        </div>
      )}

      {/* Modal tambah batch */}
      {modalAddBatchGroup && (
        <AddBatchModal
          branchId={item.branch_id}
          group={modalAddBatchGroup}
          existingInventoryIds={
            modalAddBatchGroup.allLines?.map((d) => getInventoryId(d)).filter((v): v is number => v != null) || []
          }
          onClose={() => setModalAddBatchGroup(null)}
          onSelect={(inv) => handleSelectBatch(modalAddBatchGroup, inv)}
        />
      )}
    </div>
  )
}

function AddBatchModal({
  branchId,
  group,
  existingInventoryIds,
  onClose,
  onSelect,
}: {
  branchId?: number
  group: StockOpnameProductGroup & { allLines?: StockOpnameDetailItem[] }
  existingInventoryIds: number[]
  onClose: () => void
  onSelect: (inventory: any) => void
}) {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['available-batches-for-opname', branchId, group.product_uom_id],
    queryFn: () =>
      productInventoriesService
        .list({
          per_page: 200,
          include: 'product_uom_batch',
          'filter[branch_id]': branchId ? String(branchId) : undefined,
          'filter[product_uom_ids]': String(group.product_uom_id),
          'filter[status]': 'active',
        } as any)
        .then((r) => {
          const body = (r.data as any)?.data ?? (r.data as any)
          // list may be { data: [] } or { success, data: { data: [] } }
          const list = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : []
          return list
        }),
    enabled: !!group.product_uom_id,
  })

  const rawList: any[] = data || []
  const availableList = useMemo(() => {
    return rawList
      .filter((inv) => !existingInventoryIds.includes(inv.id))
      .filter((inv) => {
        if (!search) return true
        const s = search.toLowerCase()
        const batch = inv.product_uom_batch?.batch_code?.toLowerCase() || ''
        return batch.includes(s)
      })
  }, [rawList, existingInventoryIds, search])

  const productName =
    getProductUomName(group.product_uom, group.product_uom?.product?.name) ||
    group.product_uom?.code ||
    `Produk #${group.product_uom_id}`

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          width: '100%',
          maxWidth: 520,
          maxHeight: '78vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--foreground)' }}>Tambah Batch</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--foreground-muted)' }}>
              Batch <strong>{productName}</strong> yang belum ada di lembar hitung. Klik salah satu untuk menambahkan.
            </p>
          </div>
          <button onClick={onClose} title="Tutup" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-muted)' }} />
            <input
              type="text"
              placeholder="Cari kode batch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              style={{ ...inputStyle, padding: '8px 10px 8px 30px' }}
            />
          </div>
        </div>

        <div style={{ padding: '10px 16px', overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ padding: 36, textAlign: 'center' }}>
              <Loader2 size={22} className="animate-spin" style={{ color: 'var(--foreground-muted)' }} />
            </div>
          ) : availableList.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>
              Tidak ada batch lain untuk produk ini.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {availableList.map((inv) => {
                const batchCode = inv.product_uom_batch?.batch_code || `INV-${inv.id}`
                const expiry = inv.product_uom_batch?.expiry_date
                const stock = inv.display_qty ?? inv.stock ?? inv.qty ?? 0
                const pu = inv.product_uom_batch?.product_uom || inv.product_uom
                const uom = inv.display_uom_code || pu?.uom?.name || pu?.uom?.code || ''

                return (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => onSelect(inv)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--foreground)', fontFamily: 'monospace' }}>{batchCode}</div>
                      <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 1 }}>
                        {expiry ? `Kedaluwarsa: ${formatDate(expiry)}` : 'Tanpa tanggal kedaluwarsa'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{stock}</div>
                      {uom && <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>{uom}</div>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 14px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              cursor: 'pointer',
              color: 'var(--foreground)',
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  color: 'var(--foreground)',
  outline: 'none',
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  whiteSpace: 'nowrap',
  background: 'var(--background)',
}

const tdStyle: React.CSSProperties = {
  padding: '14px',
  fontSize: 13,
  color: 'var(--foreground)',
  verticalAlign: 'top',
}

const miniBtnStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--foreground)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const linkBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  background: 'transparent',
  border: 'none',
  color: 'var(--accent)',
  fontSize: 12,
  cursor: 'pointer',
  padding: 0,
  width: 'fit-content',
}
