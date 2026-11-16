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
import { useAuth } from '@/hooks/useAuth'
import { convertUp, convertDown, type ConversionEntry } from '@/utils/unitDisplay'
import {
  CheckCircle2,
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
  Info,
  Layers,
  PackagePlus,
} from 'lucide-react'
import BackLink from '@/components/BackLink'

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
  /** Baris tanpa batch: kode batch / kedaluwarsa (opsional) untuk batch baru. */
  batch_code?: string
  expiry_date?: string
}

function getLineKey(d: StockOpnameDetailItem): string {
  if (d.id != null && d.id !== 0) return `so-${d.id}`
  if (d.product_inventory_id != null && d.product_inventory_id !== 0) return `inv-${d.product_inventory_id}`
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
    // Lines without a product_inventory_id are product UOMs the branch has
    // no batch/stock for yet (system_qty = 0). They are still part of the
    // opname — the counter may find stock on the shelf — so they stay on the
    // count sheet. The API accepts count_lines without product_inventory_id
    // (UpdateStockOpnameDetailLineRequest: product_uom_id + counted_qty).
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

function hasVarianceState(
  detail: StockOpnameDetailItem,
  state?: LineCountState,
  countedBase?: number | null,
): boolean {
  if (!isCountedState(state)) return false
  if (state!.isMultiUom) return (detail.variance ?? 0) !== 0
  const counted = countedBase ?? Number(state!.counted_qty)
  return counted !== Number(detail.system_qty)
}

function getVariance(
  detail: StockOpnameDetailItem,
  state?: LineCountState,
  countedBase?: number | null,
): number | null {
  if (!isCountedState(state)) return null
  if (state!.isMultiUom) return detail.variance ?? 0
  const counted = countedBase ?? Number(state!.counted_qty)
  return counted - Number(detail.system_qty)
}

/**
 * Satuan terkecil di rantai konversi = target_uom yang tidak pernah menjadi
 * uom sumber (mis. PACK→KG, KG→GR ⇒ GR). Jika ada lebih dari satu, ambil
 * yang dicapai dengan amount terbesar (paling granular).
 */
function smallestUomCode(conversions: ConversionEntry[]): string | null {
  if (conversions.length === 0) return null
  const sources = new Set(conversions.map((c) => c.uom_code))
  const sinks = conversions.filter((c) => !sources.has(c.target_uom_code))
  if (sinks.length === 0) return null
  return sinks.reduce((best, c) => (c.amount > best.amount ? c : best), sinks[0]).target_uom_code
}

/**
 * Konversi dua arah: satuan tampilan bisa lebih besar (KG di outlet) atau
 * lebih kecil (GR di production) dari satuan sumber opname.
 */
function convertBetween(
  qty: number,
  fromUomCode: string,
  toUomCode: string,
  conversions: ConversionEntry[],
): number | null {
  return convertDown(qty, fromUomCode, toUomCode, conversions) ?? convertUp(qty, fromUomCode, toUomCode, conversions)
}

interface StockOpnameDetailProps {
  idProp?: number | string
  initialData?: StockOpnameResponse
}

export default function StockOpnameDetail({ idProp, initialData }: StockOpnameDetailProps) {
  const router = useRouter()
  const resolvedId = idProp ? String(idProp) : router.query.id ? String(router.query.id) : ''
  const queryClient = useQueryClient()
  const { user, hasPermission } = useAuth()
  const userBranchType = ((user as any)?.branch?.type as string) ?? ''

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
  // Global product-UOMs (opsi multi-satuan). 200 baris tidak cukup — total
  // 1055, jadi dinaikkan agar satuan branch-type jarang termuat tetap ada.
  const { data: productUomsData } = useQuery({
    queryKey: ['product-uoms', 'stock-opname'],
    queryFn: () =>
      productUomsService.list({ per_page: 1000, include: 'product,uom' }).then((r) => (r.data as any)?.data || []).catch(() => []),
  })
  // Konversi global dipakai sebagai fallback saat nested product.conversions
  // tidak ikut — total 302, jadi 200 baris membuat sebagian produk kehilangan
  // konversi (dan satuan branch-type tidak tampil).
  const { data: productConversionsData } = useQuery({
    queryKey: ['product-conversions', 'stock-opname'],
    queryFn: () =>
      productConversionsService
        .list({ per_page: 1000, include: 'product,uom,target_uom' })
        .then((r) => (r.data as any)?.data || [])
        .catch(() => []),
  })

  const rawGlobalUoms: any[] = (uomsData as any) || []
  const rawConversions: any[] = (productConversionsData as any) || []

  const [headerDate, setHeaderDate] = useState<string>('')
  const [headerDescription, setHeaderDescription] = useState<string>('')
  const [lineCounts, setLineCounts] = useState<Record<string, LineCountState>>({})
  const [extraBatches, setExtraBatches] = useState<Record<number, StockOpnameDetailItem[]>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'counted' | 'variance'>('all')
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({})
  const [openBatchFields, setOpenBatchFields] = useState<Record<string, boolean>>({})
  // Satuan lain = product_uom lain dari produk yang sama → grup/baris sendiri
  // (product_uom_batches punya product_uom_id sendiri). `afterPuId` = grup
  // asal, supaya baris baru tampil tepat di bawahnya.
  const [extraGroups, setExtraGroups] = useState<Array<StockOpnameProductGroup & { afterPuId: number }>>([])
  const [modalAddUnitGroup, setModalAddUnitGroup] = useState<StockOpnameProductGroup | null>(null)
  const [addingUnitPuId, setAddingUnitPuId] = useState<number | null>(null)

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

  // Product ids yang benar-benar ada di opname ini — dipakai untuk fetch
  // targeted product-UOMs (global query hanya per_page 200 sehingga SKU
  // branch-type jarang termuat).
  const opnameProductIds = useMemo(() => {
    const ids = new Set<number>()
    productGroups.forEach((g) => {
      const pid = Number(g.product_uom?.product_id || g.product_uom?.product?.id || 0)
      if (pid) ids.add(pid)
    })
    return Array.from(ids)
  }, [productGroups])

  // Product-UOMs untuk produk opname dengan branch_type = branch.type user,
  // include product (nested conversions) untuk konversi tampilan.
  // Catatan: filter[product_ids] TIDAK didukung backend (diabaikan), jadi
  // yang menyaring adalah filter[branch_type] (terbukti bekerja) dengan
  // per_page 1000 — jumlah baris per branch type jauh di bawah itu.
  const { data: branchPuomsData } = useQuery({
    queryKey: [
      'product-uoms',
      'stock-opname-branch-type',
      userBranchType,
      opnameProductIds.slice().sort((a, b) => a - b).join(','),
    ],
    enabled: !!userBranchType && opnameProductIds.length > 0,
    queryFn: () =>
      productUomsService
        .list({
          per_page: 1000,
          include: 'product,product.conversions,uom',
          'filter[branch_type]': userBranchType,
          'filter[is_active]': true,
        } as any)
        .then((r) => (r.data as any)?.data || [])
        .catch(() => []),
  })

  // Global product-UOMs (untuk opsi multi-satuan) + targeted branch-type rows
  const rawProductUoms = useMemo(() => {
    const base: any[] = (productUomsData as any) || []
    const branchRows: any[] = (branchPuomsData as any) || []
    const map = new Map<number, any>()
    for (const pu of [...base, ...branchRows]) {
      if (pu?.id && !map.has(pu.id)) map.set(pu.id, pu)
    }
    return Array.from(map.values())
  }, [productUomsData, branchPuomsData])

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
  // + grup satuan baru (extraGroups) tepat di bawah grup asalnya.
  const groupsWithLines = useMemo(() => {
    const serverPuIds = new Set(productGroups.map((g) => g.product_uom_id))
    const pendingExtras = extraGroups.filter((g) => !serverPuIds.has(g.product_uom_id))
    const ordered: StockOpnameProductGroup[] = []
    const placed = new Set<number>()
    const place = (g: StockOpnameProductGroup) => {
      if (placed.has(g.product_uom_id)) return
      placed.add(g.product_uom_id)
      ordered.push(g)
      pendingExtras.filter((x) => x.afterPuId === g.product_uom_id).forEach(place)
    }
    productGroups.forEach(place)
    pendingExtras.forEach(place)
    return ordered
      .map((g) => {
        const extras = extraBatches[g.product_uom_id] || []
        return { ...g, allLines: [...(g.stock_opname_details || []), ...extras] }
      })
      .filter((g) => g.allLines.length > 0)
  }, [productGroups, extraGroups, extraBatches])

  // Product-UOM aktif per produk yang tersedia untuk branch type user
  // (backend menolak product_uom di luar branch type — assertProductUomInBranchType).
  const productUomsByProductId = useMemo(() => {
    const map = new Map<number, any[]>()
    const bt = userBranchType.toLowerCase()
    rawProductUoms.forEach((pu: any) => {
      const pid = Number(pu?.product_id)
      if (!pid || !pu?.id || pu.is_active === false) return
      if (bt && Array.isArray(pu.branch_types) && !pu.branch_types.some((t: string) => String(t).toLowerCase() === bt)) return
      const arr = map.get(pid) ?? []
      arr.push(pu)
      map.set(pid, arr)
    })
    return map
  }, [rawProductUoms, userBranchType])

  const allLines = useMemo(() => {
    return groupsWithLines.flatMap((g) => g.allLines.map((d) => ({ group: g, detail: d })))
  }, [groupsWithLines])

  // Precompute pilihan UoM per baris SEKALI per perubahan data/opsi —
  // bukan per render. Sebelumnya getDetailUomOptions dipanggil per baris
  // setiap kali satu karakter diketik (iterasi ratusan conversion/uom),
  // menyebabkan delay beberapa detik saat mengetik hitungan.
  const uomOptionsByKey = useMemo(() => {
    const map: Record<string, ReturnType<typeof getDetailUomOptions>> = {}
    groupsWithLines.forEach((g) => {
      ;(g.allLines || []).forEach((d) => {
        map[getLineKey(d)] = getDetailUomOptions(d, g)
      })
    })
    return map
  }, [groupsWithLines, allKnownUomsMap, rawConversions, rawProductUoms])

  // ── Konversi tampilan per branch type ─────────────────────────────────
  // Backend menerima counted_qty dalam BASE unit (mis. 1700 GR), tapi user
  // melihat/mengisi hitungan dalam satuan product-UOM yang branch_type-nya
  // cocok dengan branch.type dari auth/me (mis. 1,7 KG).
  const convByProductId = useMemo(() => {
    const map = new Map<number, ConversionEntry[]>()
    rawConversions.forEach((c: any) => {
      const entry: ConversionEntry = {
        uom_code: c.uom_code ?? c.uom?.code ?? '',
        uom_name: c.uom_name ?? c.uom?.name ?? '',
        target_uom_code: c.target_uom_code ?? c.target_uom?.code ?? '',
        target_uom_name: c.target_uom_name ?? c.target_uom?.name ?? '',
        amount: Number(c.amount ?? 0),
      }
      if (!entry.uom_code || !entry.target_uom_code || !(entry.amount > 0)) return
      const key = Number(c.product_id)
      if (!key) return
      const arr = map.get(key) ?? []
      arr.push(entry)
      map.set(key, arr)
    })
    return map
  }, [rawConversions])

  const isProductionBranch = userBranchType.toLowerCase() === 'production'

  // Pilih SATU satuan tampilan per produk:
  //   • branch production → satuan TERKECIL dari rantai konversi (GR, ML, …)
  //   • branch lain       → product-UOM yang branch_type-nya cocok dengan
  //                         branch.type user (hasil fetch targeted di atas).
  // Konversi diambil dari nested product.conversions (ikut include),
  // fallback ke global conversions.
  const branchDisplayByProductId = useMemo(() => {
    const map = new Map<number, { branchUomCode: string; conversions: ConversionEntry[] }>()
    if (!userBranchType) return map

    const toEntries = (source: any[]): ConversionEntry[] =>
      source
        .map((c: any): ConversionEntry => ({
          uom_code: c.uom_code ?? c.uom?.code ?? '',
          uom_name: c.uom_name ?? c.uom?.name ?? '',
          target_uom_code: c.target_uom_code ?? c.target_uom?.code ?? '',
          target_uom_name: c.target_uom_name ?? c.target_uom?.name ?? '',
          amount: Number(c.amount ?? 0),
        }))
        .filter((c: ConversionEntry) => c.uom_code && c.target_uom_code && c.amount > 0)

    if (isProductionBranch) {
      const nestedByProductId = new Map<number, any[]>()
      rawProductUoms.forEach((pu: any) => {
        const pid = Number(pu.product_id)
        const nested: any[] = Array.isArray(pu.product?.conversions) ? pu.product.conversions : []
        if (pid && nested.length > 0 && !nestedByProductId.has(pid)) nestedByProductId.set(pid, nested)
      })
      opnameProductIds.forEach((pid) => {
        const conversions = toEntries(nestedByProductId.get(pid) ?? convByProductId.get(pid) ?? [])
        const smallest = smallestUomCode(conversions)
        if (smallest) map.set(pid, { branchUomCode: smallest, conversions })
      })
      return map
    }

    rawProductUoms.forEach((pu: any) => {
      const pid = Number(pu.product_id)
      if (!pid || map.has(pid)) return
      if (!pu.branch_types || !Array.isArray(pu.branch_types)) return
      if (!pu.branch_types.some((bt: string) => String(bt).toLowerCase() === userBranchType.toLowerCase())) return
      const branchUomCode = pu.uom?.code ?? ''
      if (!branchUomCode) return
      const nested: any[] = Array.isArray(pu.product?.conversions) ? pu.product.conversions : []
      const conversions = toEntries(nested.length > 0 ? nested : convByProductId.get(pid) ?? [])
      if (conversions.length === 0) return
      map.set(pid, { branchUomCode, conversions })
    })
    return map
  }, [rawProductUoms, convByProductId, userBranchType, isProductionBranch, opnameProductIds])

  const getLineDisplay = (detail: StockOpnameDetailItem, group: StockOpnameProductGroup) => {
    const productId = Number(
      group.product_uom?.product_id ||
        group.product_uom?.product?.id ||
        detail.product_inventory?.product_uom?.product_id ||
        detail.product_inventory?.product_uom_batch?.product_uom?.product_id ||
        0,
    )
    if (!productId) return null
    const target = branchDisplayByProductId.get(productId)
    if (!target) return null
    // system_qty/baris dalam satuan product_uom grup opname (mis. GR) —
    // itulah unit sumber konversi, bukan base_uom yang mungkin tak di-include.
    const sourceUomCode =
      group.product_uom?.uom?.code ??
      detail.product_inventory?.product_uom_batch?.product_uom?.uom?.code ??
      ''
    if (!sourceUomCode || sourceUomCode === target.branchUomCode) return null
    // Satuan sumber harus terhubung ke satuan tampilan di rantai konversi.
    if (convertBetween(1, sourceUomCode, target.branchUomCode, target.conversions) === null) return null
    return { sourceUomCode, branchUomCode: target.branchUomCode, conversions: target.conversions }
  }

  type LineDisplayInfo = NonNullable<ReturnType<typeof getLineDisplay>>

  const lineDisplayByKey = useMemo(() => {
    const map: Record<string, LineDisplayInfo | null> = {}
    groupsWithLines.forEach((g) => {
      ;(g.allLines || []).forEach((d) => {
        map[getLineKey(d)] = getLineDisplay(d, g)
      })
    })
    return map
  }, [groupsWithLines, branchDisplayByProductId])

  /** counted_qty dalam state (satuan display) → base unit untuk backend/variance. */
  const countedBaseOf = (detail: StockOpnameDetailItem): number | null => {
    const state = lineCounts[getLineKey(detail)]
    if (!state || state.isMultiUom) return null
    if (state.counted_qty === null || state.counted_qty === undefined) return null
    const disp = lineDisplayByKey[getLineKey(detail)]
    if (!disp) return Number(state.counted_qty)
    return (
      convertBetween(Number(state.counted_qty), disp.branchUomCode, disp.sourceUomCode, disp.conversions) ??
      Number(state.counted_qty)
    )
  }

  const fmtQty = (n: number) => {
    const rounded = Math.round(n * 100) / 100
    return rounded.toLocaleString('id-ID', { maximumFractionDigits: 2 })
  }

  // Seed hitungan dari server — counted_qty backend dalam base unit, state
  // disimpan dalam satuan display. Re-seed saat data konversi selesai load
  // (dijaga dirtyRef agar input user yang sedang diketik tidak ditimpa).
  useEffect(() => {
    if (!item) return
    // Jangan timpa angka yang sedang diketik user dengan data dari server
    if (dirtyRef.current) return
    const initialCounts: Record<string, LineCountState> = {}

    const processDetail = (d: StockOpnameDetailItem, g: StockOpnameProductGroup) => {
      const hasCountItems = Array.isArray(d.count_items) && d.count_items.length > 0
      const hasCountedQty = d.counted_qty !== null && d.counted_qty !== undefined
      let counted = hasCountedQty ? Number(d.counted_qty) : null
      if (counted !== null && !hasCountItems) {
        const disp = getLineDisplay(d, g)
        if (disp) {
          counted = convertBetween(counted, disp.sourceUomCode, disp.branchUomCode, disp.conversions) ?? counted
        }
      }
      initialCounts[getLineKey(d)] = {
        counted_qty: counted,
        isMultiUom: hasCountItems,
        count_items: hasCountItems
          ? d.count_items!.map((ci) => ({ id: ci.id, uom_id: Number(ci.uom_id), counted_qty: ci.counted_qty ?? '' }))
          : [],
        description: d.description || '',
      }
    }

    // Use same normalized groups as the UI so state keys always match rendered rows
    buildProductGroups(item).forEach((g) => {
      g.stock_opname_details?.forEach((d) => processDetail(d, g))
    })

    setLineCounts(initialCounts)
  }, [item, lineDisplayByKey])

  const totalLines = allLines.length
  const countedLines = useMemo(
    () => allLines.filter(({ detail }) => isCountedState(lineCounts[getLineKey(detail)])).length,
    [allLines, lineCounts],
  )
  const varianceLines = useMemo(
    () => allLines.filter(({ detail }) => hasVarianceState(detail, lineCounts[getLineKey(detail)], countedBaseOf(detail))).length,
    [allLines, lineCounts, lineDisplayByKey],
  )
  const remainingLines = totalLines - countedLines
  const progressPercent = totalLines > 0 ? Math.round((countedLines / totalLines) * 100) : 0
  const isAllCounted = totalLines > 0 && countedLines === totalLines

  const unitCountByProductId = useMemo(() => {
    const map = new Map<number, number>()
    groupsWithLines.forEach((g) => {
      const pid = Number(g.product_uom?.product_id || g.product_uom?.product?.id || 0)
      if (pid) map.set(pid, (map.get(pid) ?? 0) + 1)
    })
    return map
  }, [groupsWithLines])

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return groupsWithLines
      .map((g) => {
        const productName =
          getProductUomName(g.product_uom, g.product_uom?.product?.name) || g.product_uom?.code || `Produk #${g.product_uom_id}`
        const productCode = g.product_uom?.product?.code || g.product_uom?.code || ''
        // Satuan (UOM) product_uom + SKU product_uom bila berbeda dari kode produk.
        const unitCode = g.product_uom?.uom?.code || g.product_uom?.uom?.name || ''
        const unitName = g.product_uom?.uom?.name || ''
        const skuCode = g.product_uom?.code && g.product_uom.code !== productCode ? g.product_uom.code : ''
        const groupMatches =
          !q || [productName, productCode, skuCode, unitCode, unitName].some((v) => v && v.toLowerCase().includes(q))

        const displayLines = g.allLines.filter((detail) => {
          const state = lineCounts[getLineKey(detail)]
          const counted = isCountedState(state)
          const variance = hasVarianceState(detail, state, countedBaseOf(detail))
          if (filterMode === 'pending' && counted) return false
          if (filterMode === 'counted' && !counted) return false
          if (filterMode === 'variance' && !variance) return false
          if (!q || groupMatches) return true
          const batch = detail.product_inventory?.product_uom_batch?.batch_code?.toLowerCase() || ''
          return batch.includes(q)
        })

        // Produk yang punya >1 satuan di lembar ini → satuannya ditonjolkan.
        const pid = Number(g.product_uom?.product_id || g.product_uom?.product?.id || 0)
        const multiUnit = !!pid && (unitCountByProductId.get(pid) ?? 0) > 1
        const isNewUnit = extraGroups.some((x) => x.product_uom_id === g.product_uom_id)
        return { ...g, productName, productCode, skuCode, unitCode, unitName, multiUnit, displayLines, isNewUnit }
      })
      .filter((g) => g.displayLines.length > 0)
  }, [groupsWithLines, lineCounts, searchQuery, filterMode, unitCountByProductId, extraGroups])
  // "No." numbering runs continuously across product groups.
  const groupRowOffsets: number[] = []
  filteredGroups.reduce((acc, g, i) => {
    groupRowOffsets[i] = acc
    return acc + g.displayLines.length
  }, 0)

  const status = item?.status?.toLowerCase() || 'draft'
  // Save / complete / cancel all go through stock-opname.update (stock-opnames/.../stock_opname_route.go)
  const isReadOnly = status === 'completed' || status === 'cancelled' || !hasPermission('stock-opname.update')
  const statusMeta = STATUS_META[status] || STATUS_META.draft

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateStockOpnameRequest) => stockOpnamesService.update(Number(resolvedId), payload),
    onSuccess: () => {
      toast.success('Hasil hitungan sudah disimpan')
      setExtraBatches({})
      setExtraGroups([])
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
              // id baris dari server — wajib untuk baris tanpa batch, kalau
              // tidak backend membuat baris + batch duplikat.
              ...(d.id != null && d.id > 0 ? { id: Number(d.id) } : {}),
              ...(invId != null ? { product_inventory_id: invId } : {}),
              product_uom_id: puId,
            }
            if (state?.description) line.description = state.description
            if (invId == null) {
              if (state?.batch_code?.trim()) line.batch_code = state.batch_code.trim()
              if (state?.expiry_date) line.expiry_date = state.expiry_date
            }
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
                // State disimpan dalam satuan display → kirim base unit ke backend
                line.counted_qty = countedBaseOf(d) ?? Number(state.counted_qty)
              }
            } else if (state && state.counted_qty !== null && state.counted_qty !== undefined) {
              // State disimpan dalam satuan display → kirim base unit ke backend
              line.counted_qty = countedBaseOf(d) ?? Number(state.counted_qty)
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

  // Hitungan tidak boleh negatif: tanda minus/plus/eksponen diblok saat
  // diketik, dan nilai negatif (paste, panah bawah) dijadikan positif.
  const blockNonQtyKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault()
  }
  const blockNegativePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    if (/[-+eE]/.test(text)) {
      e.preventDefault()
      const cleaned = text.replace(/[^0-9.,]/g, '').replace(',', '.')
      if (cleaned !== '' && !Number.isNaN(Number(cleaned))) {
        const el = e.currentTarget
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        setter?.call(el, cleaned)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
  }
  const nonNegative = (val: string): string => {
    if (val === '') return ''
    const n = Number(val)
    return Number.isNaN(n) ? '' : n < 0 ? String(Math.abs(n)) : val
  }

  const updateLineSingleQty = (lineKey: string, rawVal: string) => {
    const val = nonNegative(rawVal)
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

  const updateLineBatchField = (lineKey: string, field: 'batch_code' | 'expiry_date', val: string) => {
    setDirty(true)
    setLineCounts((prev) => {
      const current = prev[lineKey] || emptyState()
      return { ...prev, [lineKey]: { ...current, [field]: val } }
    })
  }

  const updateLineDescription = (lineKey: string, desc: string) => {
    setDirty(true)
    setLineCounts((prev) => {
      const current = prev[lineKey] || emptyState()
      return { ...prev, [lineKey]: { ...current, description: desc } }
    })
  }

  // Isi massal HANYA baris yang belum dihitung — hitungan manual tidak ditimpa.
  const handleBulkFillEmpty = (mode: 'system' | 'zero') => {
    const emptyLines = allLines.filter(({ detail }) => !isCountedState(lineCounts[getLineKey(detail)]))
    if (emptyLines.length === 0) return
    const modeLabel = mode === 'system' ? 'stok sistem' : '0'
    if (!window.confirm(`Isi ${emptyLines.length} baris yang belum dihitung dengan ${modeLabel}? Hitungan yang sudah ada tidak akan berubah.`)) {
      return
    }
    setDirty(true)
    setLineCounts((prev) => {
      const next = { ...prev }
      emptyLines.forEach(({ detail }) => {
        const key = getLineKey(detail)
        const current = next[key] || emptyState()
        const disp = lineDisplayByKey[key]
        const systemShown = disp
          ? convertBetween(Number(detail.system_qty) || 0, disp.sourceUomCode, disp.branchUomCode, disp.conversions)
          : null
        next[key] = {
          ...current,
          counted_qty: mode === 'system' ? (systemShown ?? (Number(detail.system_qty) || 0)) : 0,
          isMultiUom: false,
          count_items: [],
        }
      })
      return next
    })
    toast.success(`${emptyLines.length} baris diisi dengan ${modeLabel}`)
  }

  // Batch baru yang belum tercatat di sistem: baris tanpa product_inventory_id.
  // Backend membuat batch + inventory baru (kode otomatis, stok sistem 0)
  // saat disimpan — hanya jika baris ini diisi hitungannya.
  const handleAddNewBatch = (group: StockOpnameProductGroup) => {
    const puId = Number(group.product_uom_id)
    if (!puId) {
      toast.error('Produk tidak valid')
      return
    }
    const newDetail = {
      id: -Date.now(),
      product_inventory_id: null,
      product_uom_id: puId,
      system_qty: 0,
      counted_qty: null,
      variance: null,
      description: '',
      count_items: [],
      isNewBatch: true,
    } as StockOpnameDetailItem
    const key = getLineKey(newDetail)
    setDirty(true)
    setExtraBatches((prev) => ({ ...prev, [puId]: [...(prev[puId] || []), newDetail] }))
    setLineCounts((prev) => ({ ...prev, [key]: emptyState() }))
    toast.success('Batch baru ditambahkan. Isi hitungan (dan kode batch bila ada), lalu klik Simpan.')
    setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`[data-line-key="${key}"]`)
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      row?.querySelector<HTMLInputElement>('input[data-count-input="true"]')?.focus()
    }, 80)
  }

  const handleRemoveExtra = (puId: number, lineKey: string) => {
    setExtraBatches((prev) => ({ ...prev, [puId]: (prev[puId] || []).filter((b) => getLineKey(b) !== lineKey) }))
    setLineCounts((prev) => {
      const copy = { ...prev }
      delete copy[lineKey]
      return copy
    })
  }

  const focusFirstLineOf = (puId: number) => {
    const g = groupsWithLines.find((x) => x.product_uom_id === puId)
    const first = g?.allLines[0]
    if (!first) return
    setSearchQuery('')
    setFilterMode('all')
    setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`[data-line-key="${getLineKey(first)}"]`)
      if (!row) return
      row.scrollIntoView({ block: 'center', behavior: 'smooth' })
      row.querySelector<HTMLInputElement>('input[data-count-input="true"]')?.focus()
    }, 50)
  }

  // Satuan lain: product_uom lain dari produk yang sama jadi grup/baris
  // sendiri. Batch aktif product_uom itu di branch ini ikut dimuat (stok
  // sistem = stok batch). Tanpa batch → satu baris tanpa product_inventory_id
  // (backend membuat batch baru dengan stok sistem 0 saat disimpan).
  const handleSelectUnit = async (sourceGroup: StockOpnameProductGroup, pu: any) => {
    const puId = Number(pu?.id)
    if (!puId) return
    if (groupsWithLines.some((g) => g.product_uom_id === puId)) {
      setModalAddUnitGroup(null)
      focusFirstLineOf(puId)
      return
    }
    setAddingUnitPuId(puId)
    let inventories: any[] = []
    try {
      const r = await productInventoriesService.list({
        per_page: 200,
        include: 'product_uom_batch',
        'filter[branch_id]': item?.branch_id ? String(item.branch_id) : undefined,
        'filter[product_uom_ids]': String(puId),
        'filter[status]': 'active',
      } as any)
      const body = (r.data as any)?.data ?? (r.data as any)
      inventories = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : []
    } catch (err) {
      toastMutationApiError(err, 'Gagal memuat batch satuan ini')
      setAddingUnitPuId(null)
      return
    }
    const base = -Date.now()
    const lines: StockOpnameDetailItem[] =
      inventories.length > 0
        ? inventories.map((inv, i) => ({
            id: base - i,
            product_inventory_id: inv.id,
            product_uom_id: puId,
            system_qty: inv.base_stock ?? inv.display_qty ?? inv.stock ?? inv.qty ?? 0,
            counted_qty: null,
            variance: null,
            description: '',
            product_inventory: inv,
            count_items: [],
          }))
        : [
            {
              id: base,
              product_inventory_id: null,
              product_uom_id: puId,
              system_qty: 0,
              counted_qty: null,
              variance: null,
              description: '',
              count_items: [],
            } as StockOpnameDetailItem,
          ]
    setDirty(true)
    setExtraGroups((prev) => [
      ...prev,
      { product_uom_id: puId, product_uom: pu, stock_opname_details: [], afterPuId: sourceGroup.product_uom_id },
    ])
    setExtraBatches((prev) => ({ ...prev, [puId]: [...(prev[puId] || []), ...lines] }))
    setLineCounts((prev) => {
      const next = { ...prev }
      lines.forEach((l) => {
        next[getLineKey(l)] = emptyState()
      })
      return next
    })
    setAddingUnitPuId(null)
    setModalAddUnitGroup(null)
    toast.success(`Satuan ${pu?.uom?.code || pu?.uom?.name || ''} ditambahkan sebagai baris baru. Isi hitungannya lalu klik Simpan.`)
    setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`[data-line-key="${getLineKey(lines[0])}"]`)
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      row?.querySelector<HTMLInputElement>('input[data-count-input="true"]')?.focus()
    }, 80)
  }

  // Klik/fokus kolom hitungan → seluruh angka terblok, jadi user langsung
  // mengetik angka baru tanpa menghapus dulu. Ditunda satu tick karena
  // mouseup setelah klik bisa membatalkan seleksi.
  const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    setTimeout(() => {
      if (document.activeElement === el) el.select()
    }, 0)
  }

  // Tekan Enter di kolom hitungan → langsung pindah ke barang berikutnya
  const handleCountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    blockNonQtyKeys(e)
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

  type DisplayGroup = (typeof filteredGroups)[number]

  // Nama produk + satuan (UOM) product_uom-nya — satuan selalu tampil karena
  // satu produk bisa dihitung dalam beberapa product_uom (GR, PACK, …).
  const renderProductName = (group: DisplayGroup) => (
    <div className="so-name">
      <span className="so-name-text">{group.productName}</span>
      {group.unitCode && (
        <span
          className="so-uom"
          data-multi={group.multiUnit ? 'true' : undefined}
          title={group.unitName && group.unitName !== group.unitCode ? `Satuan: ${group.unitName}` : 'Satuan'}
        >
          {group.unitCode}
        </span>
      )}
      {group.isNewUnit && <span className="so-new">Satuan baru</span>}
    </div>
  )

  const renderProductCodes = (group: DisplayGroup) => (
    <>
      {group.productCode && (
        <span className="so-code" title="Kode produk">
          {group.productCode}
        </span>
      )}
      {group.skuCode && (
        <span className="so-code" title="Kode SKU satuan">
          {group.skuCode}
        </span>
      )}
    </>
  )

  // Satu baris hitung. `single` = produk hanya punya satu baris → nama produk
  // ditampilkan di baris itu sendiri (tanpa baris judul grup terpisah).
  const renderLine = (
    group: (typeof filteredGroups)[number],
    detail: StockOpnameDetailItem,
    rowNo: number,
    single: boolean,
    uomLabel: string,
  ) => {
    const lineKey = getLineKey(detail)
    const state = lineCounts[lineKey] || emptyState()
    const counted = isCountedState(state)
    const isNew = detail.id != null && detail.id < 0
    const batchCode = detail.product_inventory?.product_uom_batch?.batch_code || ''
    const expiry = detail.product_inventory?.product_uom_batch?.expiry_date
    const isExpired = expiry && new Date(expiry).getTime() < Date.now()
    const uomOptions = uomOptionsByKey[lineKey] ?? []
    const noteVisible = !!state.description || !!openNotes[lineKey]

    // Konversi tampilan branch type: stok sistem (base) → satuan branch;
    // hitungan user dikonversi balik saat save.
    const disp = lineDisplayByKey[lineKey] ?? null
    const systemShown = disp
      ? convertBetween(Number(detail.system_qty) || 0, disp.sourceUomCode, disp.branchUomCode, disp.conversions)
      : null
    const lineUomLabel = systemShown !== null && disp ? disp.branchUomCode : uomLabel
    const varianceBase = getVariance(detail, state, countedBaseOf(detail))
    const variance =
      varianceBase !== null && disp
        ? convertBetween(varianceBase, disp.sourceUomCode, disp.branchUomCode, disp.conversions) ?? varianceBase
        : varianceBase
    const hasDiff = variance !== null && variance !== 0

    let varianceText = '—'
    let varianceTone: 'none' | 'zero' | 'plus' | 'minus' = 'none'
    if (variance !== null) {
      if (variance > 0) {
        varianceText = `+${fmtQty(variance)}`
        varianceTone = 'plus'
      } else if (variance < 0) {
        varianceText = fmtQty(variance)
        varianceTone = 'minus'
      } else {
        varianceText = '0'
        varianceTone = 'zero'
      }
    }

    const batchLine = (
      <>
        {batchCode ? (
          <span className="so-batch" title="Kode batch">
            Batch {batchCode}
          </span>
        ) : detail.isNewBatch ? (
          <span className="so-sub">Batch baru · kode otomatis jika dikosongkan</span>
        ) : !single ? (
          <span className="so-sub">Tanpa batch</span>
        ) : null}
        {isNew && <span className="so-new">Baru</span>}
        {expiry && (
          <span className="so-sub" style={{ color: isExpired ? 'var(--destructive)' : undefined }}>
            Exp {formatDate(expiry)}
          </span>
        )}
      </>
    )
    const hasBatchLine = !!batchCode || isNew || !!expiry

    return (
      <tr
        key={lineKey}
        data-line-key={lineKey}
        data-state={hasDiff ? 'diff' : counted ? 'counted' : 'pending'}
        data-child={single ? undefined : 'true'}
        className="so-line"
      >
        <td className="so-no">{rowNo}</td>
        <td>
          {single ? (
            <div style={{ minWidth: 0 }}>
              {renderProductName(group)}
              <div className="so-meta">
                {renderProductCodes(group)}
                {hasBatchLine && batchLine}
              </div>
            </div>
          ) : (
            <div className="so-meta" style={{ paddingLeft: 14 }}>
              {batchLine}
            </div>
          )}
        </td>
        <td style={{ textAlign: 'right' }}>
          <span className="so-qty">{systemShown !== null ? fmtQty(systemShown) : fmtQty(Number(detail.system_qty) || 0)}</span>
          {lineUomLabel && <span className="so-unit">{lineUomLabel}</span>}
        </td>
        <td>
          {isReadOnly ? (
            <div>
              <span className="so-qty">
                {state.isMultiUom && state.count_items.length > 0
                  ? state.count_items
                      .map((ci) => `${ci.counted_qty} ${allKnownUomsMap.get(Number(ci.uom_id))?.code || uomLabel}`)
                      .join(' + ')
                  : counted
                  ? `${state.counted_qty}${lineUomLabel ? ` ${lineUomLabel}` : ''}`
                  : '—'}
              </span>
              {state.description && <div className="so-sub" style={{ fontStyle: 'italic' }}>{state.description}</div>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {!state.isMultiUom ? (
                <div className="so-count">
                  <input
                    type="number"
                    inputMode="decimal"
                    data-count-input="true"
                    className="v2-input so-count-input"
                    step="any"
                    min={0}
                    placeholder="Jumlah"
                    aria-label={`Hitungan ${group.productName}${batchCode ? ` batch ${batchCode}` : ''}`}
                    value={state.counted_qty === null || state.counted_qty === undefined ? '' : state.counted_qty}
                    onChange={(e) => updateLineSingleQty(lineKey, e.target.value)}
                    onKeyDown={handleCountKeyDown}
                    onPaste={blockNegativePaste}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    onFocus={selectOnFocus}
                  />
                  <span className="so-unit so-unit-fixed">{lineUomLabel}</span>
                  <button
                    type="button"
                    className="v2-btn v2-btn-sm so-quick print-hidden"
                    onClick={() =>
                      updateLineSingleQty(
                        lineKey,
                        String(systemShown !== null ? Math.round(systemShown * 10000) / 10000 : detail.system_qty),
                      )
                    }
                    title="Isi hitungan sama dengan stok sistem"
                  >
                    Sama
                  </button>
                  <button
                    type="button"
                    className="v2-btn v2-btn-sm so-quick print-hidden"
                    onClick={() => updateLineSingleQty(lineKey, '0')}
                    title="Barang tidak ada / kosong"
                  >
                    0
                  </button>
                </div>
              ) : (
                <div className="so-multi">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--foreground-muted)' }}>Beberapa satuan</span>
                    <button
                      type="button"
                      className="v2-btn v2-btn-ghost v2-btn-sm so-tiny"
                      onClick={() => toggleMultiUom(lineKey, detail, group)}
                      title="Kembali ke satu satuan"
                    >
                      Satuan tunggal
                    </button>
                  </div>
                  {state.count_items.map((ci, ciIdx) => (
                    <div key={ciIdx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        inputMode="decimal"
                        className="v2-input so-count-input"
                        style={{ width: 84 }}
                        step="any"
                        placeholder="Jumlah"
                        value={ci.counted_qty}
                        onChange={(e) => updateCountItem(lineKey, ciIdx, 'counted_qty', nonNegative(e.target.value))}
                        onKeyDown={blockNonQtyKeys}
                        onPaste={blockNegativePaste}
                        min={0}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    onFocus={selectOnFocus}
                      />
                      <select
                        className="v2-select"
                        value={ci.uom_id}
                        onChange={(e) => updateCountItem(lineKey, ciIdx, 'uom_id', e.target.value)}
                        style={{ width: 96, height: 30 }}
                      >
                        {uomOptions.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.code || u.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="v2-icon-btn"
                        data-tone="danger"
                        onClick={() => removeCountItem(lineKey, ciIdx)}
                        title="Hapus baris satuan ini"
                        aria-label="Hapus baris satuan ini"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="v2-btn v2-btn-ghost v2-btn-sm so-tiny"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => addCountItem(lineKey, group)}
                  >
                    <Plus size={12} /> Tambah satuan
                  </button>
                </div>
              )}
              {!getInventoryId(detail) &&
                (detail.isNewBatch || (!state.isMultiUom && state.counted_qty != null && Number(state.counted_qty) > 0)) && (
                  openBatchFields[lineKey] || state.batch_code || state.expiry_date ? (
                    <div className="so-newbatch">
                      <input
                        type="text"
                        className="v2-input"
                        placeholder="Kode batch"
                        aria-label="Kode batch baru (opsional)"
                        title="Kode batch baru (opsional — dibuat otomatis jika kosong)"
                        value={state.batch_code ?? ''}
                        onChange={(e) => updateLineBatchField(lineKey, 'batch_code', e.target.value)}
                        autoFocus={!state.batch_code && !state.expiry_date}
                        style={{ width: 120 }}
                      />
                      <input
                        type="date"
                        className="v2-input"
                        data-empty={state.expiry_date ? undefined : 'true'}
                        aria-label="Tanggal kedaluwarsa batch baru (opsional)"
                        title="Tanggal kedaluwarsa (opsional)"
                        value={state.expiry_date ?? ''}
                        onChange={(e) => updateLineBatchField(lineKey, 'expiry_date', e.target.value)}
                        style={{ width: 132 }}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="so-linkbtn"
                      onClick={() => setOpenBatchFields((p) => ({ ...p, [lineKey]: true }))}
                    >
                      <Plus size={12} /> Kode batch &amp; kedaluwarsa
                    </button>
                  )
                )}
              {noteVisible && (
                <input
                  type="text"
                  className="v2-input so-note"
                  placeholder="Catatan, mis. ditemukan di laci, rusak..."
                  value={state.description}
                  onChange={(e) => updateLineDescription(lineKey, e.target.value)}
                  autoFocus={!state.description}
                />
              )}
            </div>
          )}
        </td>
        <td style={{ textAlign: 'right' }}>
          <span className="so-var" data-tone={varianceTone}>
            {varianceText}
          </span>
        </td>
        {!isReadOnly && (
          <td className="print-hidden" style={{ textAlign: 'right' }}>
            <div className="so-actions">
              {single && (
                <button
                  type="button"
                  className="v2-icon-btn"
                  onClick={() => handleAddNewBatch(group)}
                  title="Tambah batch baru (belum tercatat di sistem)"
                  aria-label="Tambah batch baru"
                >
                  <PackagePlus size={15} />
                </button>
              )}
              <button
                type="button"
                className="v2-icon-btn"
                data-active={state.isMultiUom ? 'true' : undefined}
                onClick={() => (state.isMultiUom ? toggleMultiUom(lineKey, detail, group) : setModalAddUnitGroup(group))}
                title={state.isMultiUom ? 'Kembali ke satu satuan' : 'Tambah satuan lain sebagai baris baru'}
                aria-label="Satuan lain"
              >
                <Layers size={15} />
              </button>
              <button
                type="button"
                className="v2-icon-btn"
                data-active={noteVisible ? 'true' : undefined}
                disabled={!!state.description}
                onClick={() => setOpenNotes((p) => ({ ...p, [lineKey]: !p[lineKey] }))}
                title={state.description ? 'Catatan terisi — kosongkan teksnya untuk menyembunyikan' : 'Tambah catatan'}
                aria-label="Catatan"
              >
                <MessageSquarePlus size={15} />
              </button>
              {isNew ? (
                <button
                  type="button"
                  className="v2-icon-btn"
                  data-tone="danger"
                  onClick={() => handleRemoveExtra(group.product_uom_id, lineKey)}
                  title="Hapus batch yang baru ditambahkan ini"
                  aria-label="Hapus batch"
                >
                  <Trash2 size={15} />
                </button>
              ) : (
                <span style={{ width: 28, flexShrink: 0 }} />
              )}
            </div>
          </td>
        )}
      </tr>
    )
  }

  return (
    <div className="stock-opname-sheet" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{`
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .print-hidden { display: none !important; }
          .stock-opname-sheet { gap: 6px !important; }
          .so-card { box-shadow: none !important; border-color: #ccc !important; }
          .so-table th, .so-table td { padding: 3px 6px !important; height: auto !important; font-size: 10px !important; position: static !important; }
          .so-table tr { break-inside: avoid; }
        }
        .so-count-input::-webkit-outer-spin-button,
        .so-count-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .so-count-input { -moz-appearance: textfield; }

        :root .stock-opname-sheet .so-card { overflow: clip; }

        /* Tabel hitung */
        :root .stock-opname-sheet .v2-table.so-table thead th { padding: 0 12px; height: 36px; }
        :root .stock-opname-sheet .v2-table.so-table tbody td {
          height: 52px; padding: 8px 12px; vertical-align: middle;
        }
        :root .stock-opname-sheet .so-table tbody tr.so-line { transition: background 120ms ease; }
        :root .stock-opname-sheet .so-table tbody tr.so-line:hover { background: var(--surface-muted); }
        :root .stock-opname-sheet .so-table tbody tr.so-line[data-state="counted"] {
          background: color-mix(in srgb, var(--success-bg) 45%, var(--surface));
        }
        :root .stock-opname-sheet .so-table tbody tr.so-line[data-state="diff"] {
          background: color-mix(in srgb, var(--warning-bg) 60%, var(--surface));
        }
        :root .stock-opname-sheet .so-table tbody tr.so-line td:first-child { box-shadow: inset 3px 0 0 transparent; }
        :root .stock-opname-sheet .so-table tbody tr.so-line[data-state="counted"] td:first-child { box-shadow: inset 3px 0 0 var(--success); }
        :root .stock-opname-sheet .so-table tbody tr.so-line[data-state="diff"] td:first-child { box-shadow: inset 3px 0 0 var(--warning); }
        :root .stock-opname-sheet .so-table tbody tr.so-line[data-child] td { border-bottom-style: dashed; }
        :root .stock-opname-sheet .so-table tbody tr.so-group td {
          height: 40px; padding: 8px 12px; background: var(--surface); border-bottom: 1px dashed var(--border);
        }

        :root .stock-opname-sheet .so-no { width: 44px; text-align: center; color: var(--foreground-subtle); font-size: 11.5px; font-variant-numeric: tabular-nums; }
        :root .stock-opname-sheet .so-name { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; font-weight: 500; color: var(--foreground); }
        :root .stock-opname-sheet .so-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; font-weight: 400; color: var(--foreground-subtle);
        }
        :root .stock-opname-sheet .so-meta > * + *::before {
          content: '·'; margin-right: 8px; color: var(--foreground-subtle); font-family: var(--font-sans);
        }
        :root .stock-opname-sheet .so-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
        :root .stock-opname-sheet .so-batch { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; color: var(--foreground-muted); }
        :root .stock-opname-sheet .so-sub { font-size: 11px; color: var(--foreground-subtle); }
        :root .stock-opname-sheet .so-new {
          font-size: 10px; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase;
          color: var(--accent); background: var(--accent-light-bg); padding: 1px 6px; border-radius: 999px;
        }
        :root .stock-opname-sheet .so-uom {
          display: inline-flex; align-items: center; height: 18px; padding: 0 7px; border-radius: 999px;
          font-size: 10.5px; font-weight: 600; letter-spacing: 0.02em; white-space: nowrap;
          color: var(--foreground-muted); background: var(--surface-muted); border: 1px solid var(--border);
        }
        :root .stock-opname-sheet .so-uom[data-multi] { color: var(--accent); background: var(--accent-light-bg); border-color: transparent; }
        :root .stock-opname-sheet .so-name-text { min-width: 0; }
        :root .stock-opname-sheet .so-qty { font-size: 13px; font-weight: 600; color: var(--foreground); font-variant-numeric: tabular-nums; }
        :root .stock-opname-sheet .so-unit { margin-left: 4px; font-size: 11px; color: var(--foreground-muted); }
        :root .stock-opname-sheet .so-unit-fixed { margin-left: 0; min-width: 28px; }
        :root .stock-opname-sheet .so-count { display: flex; align-items: center; gap: 6px; }
        :root .stock-opname-sheet .v2-input.so-count-input {
          width: 104px; height: 30px; text-align: right; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums;
        }
        :root .stock-opname-sheet .v2-input.so-count-input::placeholder { font-weight: 400; color: var(--foreground-subtle); }
        :root .stock-opname-sheet tr[data-state="counted"] .v2-input.so-count-input,
        :root .stock-opname-sheet tr[data-state="diff"] .v2-input.so-count-input { background: var(--surface); }
        /* Sama / 0: tombol cepat bernada karamel agar jelas bisa diklik. */
        :root .stock-opname-sheet .v2-btn.so-quick {
          height: 28px; padding: 0 11px; font-size: 12px; font-weight: 600;
          color: var(--accent); background: var(--accent-light-bg);
          border: 1px solid color-mix(in srgb, var(--accent-light) 45%, transparent);
          box-shadow: 0 1px 0 rgba(42, 26, 19, 0.06);
        }
        :root .stock-opname-sheet .v2-btn.so-quick:hover:not(:disabled) {
          background: color-mix(in srgb, var(--accent-light-bg) 65%, var(--accent-light));
          border-color: var(--accent-light);
        }
        :root .stock-opname-sheet .v2-btn.so-quick:active:not(:disabled) { transform: translateY(1px); box-shadow: none; }
        :root .stock-opname-sheet .v2-btn.so-quick:focus-visible { outline: 2px solid var(--accent-light); outline-offset: 1px; }
        :root .stock-opname-sheet .v2-btn.so-tiny { height: 24px; padding: 0 8px; font-size: 11.5px; }
        :root .stock-opname-sheet .so-newbatch { display: flex; align-items: center; gap: 6px; }
        :root .stock-opname-sheet .so-newbatch .v2-input { height: 28px; font-size: 12px; padding: 0 8px; }
        :root .stock-opname-sheet .so-newbatch input[type="date"][data-empty] { color: var(--foreground-subtle); }
        :root .stock-opname-sheet .so-linkbtn {
          display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; padding: 2px 4px; margin-left: -4px;
          border: none; border-radius: 4px; background: transparent; cursor: pointer;
          font-family: var(--font-sans); font-size: 11.5px; color: var(--foreground-muted);
        }
        :root .stock-opname-sheet .so-linkbtn:hover { color: var(--accent); background: var(--accent-light-bg); }
        :root .stock-opname-sheet .so-multi { display: flex; flex-direction: column; gap: 6px; max-width: 280px; }
        :root .stock-opname-sheet .v2-input.so-note { width: 100%; max-width: 360px; height: 30px; font-size: 12px; }
        :root .stock-opname-sheet .so-var {
          display: inline-block; min-width: 36px; padding: 2px 8px; border-radius: 999px; text-align: center;
          font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--foreground-subtle);
        }
        :root .stock-opname-sheet .so-var[data-tone="zero"] { color: var(--success); }
        :root .stock-opname-sheet .so-var[data-tone="plus"] { color: var(--success); background: var(--success-bg); }
        :root .stock-opname-sheet .so-var[data-tone="minus"] { color: var(--destructive); background: var(--destructive-bg); }
        :root .stock-opname-sheet .so-actions { display: inline-flex; align-items: center; justify-content: flex-end; gap: 2px; }
        :root .stock-opname-sheet .v2-icon-btn[data-active="true"] { color: var(--accent); background: var(--accent-light-bg); }
        :root .stock-opname-sheet .v2-icon-btn[data-active="true"]:disabled { opacity: 1; cursor: default; }

        /* Tombol */
        :root .stock-opname-sheet .v2-btn.so-soft { background: var(--accent-light-bg); color: var(--accent); border: 1px solid transparent; }
        :root .stock-opname-sheet .v2-btn.so-soft:hover:not(:disabled) {
          background: color-mix(in srgb, var(--accent-light-bg) 75%, var(--accent-light)); border-color: transparent;
        }
        :root .stock-opname-sheet .v2-btn.so-danger { color: var(--destructive); }
        :root .stock-opname-sheet .v2-btn.so-danger:hover:not(:disabled) { background: var(--destructive-bg); border-color: var(--destructive-bg); }
        :root .stock-opname-sheet .v2-btn.so-success { background: var(--success); border: 1px solid var(--success); color: #fff; }
        :root .stock-opname-sheet .v2-btn.so-success:hover:not(:disabled) { background: color-mix(in srgb, var(--success) 88%, #000); }
        :root .stock-opname-sheet .so-seg > button { white-space: nowrap; }
        :root .stock-opname-sheet .so-seg .so-seg-n { margin-left: 5px; font-variant-numeric: tabular-nums; color: var(--foreground-subtle); }
        :root .stock-opname-sheet .so-seg > button[aria-selected="true"] .so-seg-n { color: var(--foreground-muted); }
      `}</style>

      {/* Back to list — confirms first when there are unsaved counts */}
      <div
        className="print-hidden"
        style={{ alignSelf: 'flex-start', marginBottom: -6 }}
        onClickCapture={(e) => {
          if (dirty && !confirm('Ada hitungan yang belum disimpan. Tetap keluar dari halaman ini?')) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        <BackLink href="/products/product-inventory/stock-opname" label="Stock Opnames" />
      </div>

      {/* Header: judul + status + aksi */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, color: 'var(--foreground)' }}>Stock Opname {item.code}</h1>
            <span
              style={{
                padding: '2px 9px',
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 500,
                color: statusMeta.color,
                background: status === 'draft' ? 'var(--surface-muted)' : statusMeta.bg,
              }}
            >
              {statusMeta.label}
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--foreground-muted)' }}>
            {formatDate(item.date)} · {item.branch?.name || '—'}
            {item.created_by?.name ? ` · ${item.created_by.name}` : ''}
          </p>
        </div>

        <div className="print-hidden" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="v2-btn v2-btn-ghost" onClick={() => window.print()}>
            <Printer size={14} /> Cetak
          </button>
          {!isReadOnly && (
            <button type="button" className="v2-btn v2-btn-ghost so-danger" onClick={handleCancel} disabled={isBusy}>
              <XCircle size={14} /> Batalkan
            </button>
          )}
        </div>
      </div>

      {isReadOnly && (
        <div
          className="print-hidden"
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: status === 'completed' ? 'var(--success-bg)' : 'var(--destructive-bg)',
            color: status === 'completed' ? 'var(--success)' : 'var(--destructive)',
            fontSize: 12.5,
            fontWeight: 500,
          }}
        >
          {status === 'completed'
            ? 'Stock Opname ini sudah selesai dan hanya bisa dilihat.'
            : 'Stock Opname ini sudah dibatalkan dan hanya bisa dilihat.'}
        </div>
      )}

      {/* Ringkasan progres + tanggal/catatan */}
      <div className="v2-card so-card print-hidden" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 600, color: isAllCounted ? 'var(--success)' : 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                {countedLines}
                <span style={{ color: 'var(--foreground-subtle)', fontWeight: 500 }}> / {totalLines}</span>
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>barang dihitung</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>
              Selisih{' '}
              <strong style={{ fontWeight: 600, color: varianceLines > 0 ? 'var(--warning)' : 'var(--foreground)' }}>{varianceLines}</strong>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>
              <strong style={{ fontWeight: 600, color: 'var(--foreground)' }}>{progressPercent}%</strong> selesai
            </div>
          </div>
          {!isReadOnly && remainingLines > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="v2-btn v2-btn-ghost v2-btn-sm"
                onClick={() => handleBulkFillEmpty('system')}
                title="Isi semua hitungan yang masih kosong dengan stok sistem"
              >
                Isi sesuai sistem
              </button>
              <button
                type="button"
                className="v2-btn v2-btn-ghost v2-btn-sm"
                onClick={() => handleBulkFillEmpty('zero')}
                title="Isi semua hitungan yang masih kosong dengan 0"
              >
                Isi semua 0
              </button>
              <button type="button" className="v2-btn v2-btn-sm so-soft" onClick={jumpToFirstPending}>
                <ArrowDown size={13} /> Ke yang belum dihitung
              </button>
            </div>
          )}
        </div>
        <div style={{ height: 6, background: 'var(--surface-muted)', borderRadius: 999, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: isAllCounted ? 'var(--success)' : 'var(--accent-light)',
              borderRadius: 999,
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {!isReadOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="date"
              className="v2-input"
              aria-label="Tanggal opname"
              value={headerDate}
              onChange={(e) => {
                setHeaderDate(e.target.value)
                setDirty(true)
              }}
              style={{ width: 150 }}
            />
            <input
              type="text"
              className="v2-input"
              aria-label="Catatan opname"
              placeholder="Catatan opname (opsional)"
              value={headerDescription}
              onChange={(e) => {
                setHeaderDescription(e.target.value)
                setDirty(true)
              }}
              style={{ flex: 1, minWidth: 200 }}
            />
            <span
              title="Lihat stok sistem → ketik jumlah asli di kolom hitungan (Enter untuk lanjut ke barang berikutnya) → klik Simpan. Boleh disimpan berkali-kali."
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--foreground-subtle)', cursor: 'help' }}
            >
              <Info size={14} /> Cara hitung
            </span>
          </div>
        )}
      </div>

      {/* Daftar hitung */}
      <div className="v2-card so-card">
        <div
          className="print-hidden"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            padding: '12px 14px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-subtle)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              className="v2-input"
              placeholder="Cari produk / batch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: 32, paddingRight: 30 }}
            />
            {searchQuery && (
              <button
                type="button"
                className="v2-icon-btn"
                onClick={() => setSearchQuery('')}
                title="Hapus pencarian"
                aria-label="Hapus pencarian"
                style={{ position: 'absolute', right: 3, top: '50%', transform: 'translateY(-50%)', width: 24, height: 24 }}
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div className="v2-seg so-seg" role="tablist">
            {(
              [
                { id: 'all', label: 'Semua', n: totalLines },
                { id: 'pending', label: 'Belum', n: remainingLines },
                { id: 'counted', label: 'Sudah', n: countedLines },
                { id: 'variance', label: 'Selisih', n: varianceLines },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filterMode === tab.id}
                data-fast-click
                onClick={() => setFilterMode(tab.id)}
              >
                {tab.label}
                <span className="so-seg-n">{tab.n}</span>
              </button>
            ))}
          </div>
        </div>

        {filteredGroups.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>
            {totalLines === 0 ? (
              <>
                <Search size={22} style={{ color: 'var(--foreground-subtle)', marginBottom: 8 }} />
                <div>Tidak ada barang yang perlu dihitung.</div>
              </>
            ) : filterMode === 'pending' && remainingLines === 0 ? (
              <>
                <CheckCircle2 size={22} style={{ color: 'var(--success)', marginBottom: 8 }} />
                <div>Hebat! Semua barang sudah dihitung.</div>
              </>
            ) : (
              <>
                <Search size={22} style={{ color: 'var(--foreground-subtle)', marginBottom: 8 }} />
                <div>Tidak ada barang yang cocok. Coba ubah kata pencarian atau filter.</div>
              </>
            )}
          </div>
        ) : (
          <table className="v2-table so-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: 44 }}>No.</th>
                <th>Produk / Batch</th>
                <th style={{ textAlign: 'right', width: 130 }}>Stok sistem</th>
                <th style={{ minWidth: 260 }}>Hitungan</th>
                <th style={{ textAlign: 'right', width: 90 }}>Selisih</th>
                {!isReadOnly && <th className="print-hidden" style={{ width: 128 }} aria-label="Aksi" />}
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((group, groupIdx) => {
                const uomLabel =
                  group.product_uom?.uom?.name || group.product_uom?.uom?.code || group.product_uom?.product?.base_uom?.name || ''
                const offset = groupRowOffsets[groupIdx] ?? 0
                const single = group.displayLines.length === 1

                if (single) return renderLine(group, group.displayLines[0], offset + 1, true, uomLabel)

                const groupCounted = group.displayLines.filter((d) => isCountedState(lineCounts[getLineKey(d)])).length
                const groupComplete = groupCounted === group.displayLines.length
                return (
                  <React.Fragment key={group.product_uom_id}>
                    <tr className="so-group">
                      <td className="so-no">
                        {groupComplete ? (
                          <CheckCircle2 size={14} style={{ color: 'var(--success)', verticalAlign: 'middle' }} aria-label="Semua batch sudah dihitung" />
                        ) : null}
                      </td>
                      <td colSpan={4}>
                        {renderProductName(group)}
                        <div className="so-meta">
                          {renderProductCodes(group)}
                          <span className="so-sub">
                            {groupCounted}/{group.displayLines.length} batch dihitung
                          </span>
                        </div>
                      </td>
                      {!isReadOnly && (
                        <td className="print-hidden" style={{ textAlign: 'right' }}>
                          <div className="so-actions">
                            <button
                              type="button"
                              className="v2-icon-btn"
                              onClick={() => handleAddNewBatch(group)}
                              title="Tambah batch baru (belum tercatat di sistem)"
                              aria-label="Tambah batch baru"
                            >
                              <PackagePlus size={15} />
                            </button>
                            <span style={{ width: 90, flexShrink: 0 }} />
                          </div>
                        </td>
                      )}
                    </tr>
                    {group.displayLines.map((detail, lineIdx) => renderLine(group, detail, offset + lineIdx + 1, false, uomLabel))}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bar aksi utama — sticky di bawah */}
      {!isReadOnly && (
        <div
          className="v2-card print-hidden"
          style={{
            position: 'sticky',
            bottom: 12,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            padding: '10px 14px',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, fontSize: 12.5 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 500,
                color: dirty ? 'var(--warning)' : 'var(--success)',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 999, background: 'currentColor' }} />
              {dirty ? 'Belum disimpan' : 'Tersimpan'}
            </span>
            <span style={{ color: 'var(--foreground-muted)' }}>{completeHint}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="v2-btn v2-btn-primary" onClick={handleSaveProgress} disabled={isBusy || !dirty}>
              {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Simpan
            </button>
            <button
              type="button"
              className={`v2-btn ${isAllCounted && !dirty ? 'so-success' : 'v2-btn-ghost'}`}
              onClick={handleComplete}
              disabled={!isAllCounted || dirty || isBusy}
              title={!isAllCounted ? 'Hitung semua barang dulu' : dirty ? 'Simpan perubahan dulu' : 'Selesaikan Stock Opname'}
            >
              {completeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Selesai
            </button>
          </div>
        </div>
      )}


      {/* Modal tambah satuan (product_uom lain → baris baru) */}
      {modalAddUnitGroup && (() => {
        const g = modalAddUnitGroup
        const pid = Number(g.product_uom?.product_id || g.product_uom?.product?.id || 0)
        const onSheet = new Set(groupsWithLines.map((x) => x.product_uom_id))
        const options = (productUomsByProductId.get(pid) ?? []).filter((pu) => pu.id !== g.product_uom_id)
        return (
          <AddUnitModal
            productName={getProductUomName(g.product_uom, g.product_uom?.product?.name) || g.product_uom?.code || `Produk #${g.product_uom_id}`}
            currentUom={g.product_uom?.uom?.code || g.product_uom?.uom?.name || ''}
            options={options}
            onSheet={onSheet}
            loadingPuId={addingUnitPuId}
            onClose={() => setModalAddUnitGroup(null)}
            onSelect={(pu) => handleSelectUnit(g, pu)}
          />
        )
      })()}
    </div>
  )
}

function AddUnitModal({
  productName,
  currentUom,
  options,
  onSheet,
  loadingPuId,
  onClose,
  onSelect,
}: {
  productName: string
  currentUom: string
  options: any[]
  onSheet: Set<number>
  loadingPuId: number | null
  onClose: () => void
  onSelect: (pu: any) => void
}) {
  return (
    <div
      onClick={onClose}
      className="v2-overlay"
      style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20, background: 'rgba(0, 0, 0, 0.45)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="v2-dialog"
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          width: '100%',
          maxWidth: 460,
          maxHeight: '78vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, color: 'var(--foreground)' }}>Tambah satuan lain</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--foreground-muted)', lineHeight: 1.45 }}>
              Pilih satuan <strong style={{ fontWeight: 500, color: 'var(--foreground)' }}>{productName}</strong> selain {currentUom || 'satuan ini'}.
              Satuan itu jadi baris hitung sendiri, lengkap dengan batch-nya di cabang ini.
            </p>
          </div>
          <button type="button" className="v2-icon-btn" onClick={onClose} title="Tutup" aria-label="Tutup">
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 10, overflowY: 'auto', flex: 1 }}>
          {options.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>
              Tidak ada satuan lain untuk produk ini di tipe cabang Anda.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {options.map((pu) => {
                const exists = onSheet.has(pu.id)
                const loading = loadingPuId === pu.id
                return (
                  <button
                    key={pu.id}
                    type="button"
                    className="so-unit-option"
                    disabled={loadingPuId != null}
                    onClick={() => onSelect(pu)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{pu.uom?.code || pu.uom?.name || `#${pu.id}`}</span>
                      {pu.uom?.name && pu.uom?.code && pu.uom.name !== pu.uom.code && (
                        <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{pu.uom.name}</span>
                      )}
                      {pu.code && (
                        <span style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: 'var(--foreground-subtle)' }}>{pu.code}</span>
                      )}
                    </span>
                    <span style={{ fontSize: 11.5, color: exists ? 'var(--foreground-muted)' : 'var(--accent)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {loading ? <Loader2 size={13} className="animate-spin" /> : null}
                      {exists ? 'Sudah di daftar — lihat' : 'Tambah baris'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <style>{`
          .so-unit-option {
            display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%;
            padding: 10px 12px; border: 1px solid transparent; border-radius: var(--radius-md);
            background: transparent; cursor: pointer; text-align: left; transition: background 120ms ease, border-color 120ms ease;
          }
          .so-unit-option:hover:not(:disabled) { background: var(--surface-muted); border-color: var(--border); }
          .so-unit-option:disabled { cursor: progress; opacity: 0.7; }
        `}</style>
      </div>
    </div>
  )
}
