'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/router'
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productionsService } from '@/services/productions.service'
import { toastMutationApiError } from '@/utils/apiError'
import { productInventoriesService } from '@/services/product-inventories.service'
import { productUomsService } from '@/services/product-uoms.service'
import api from '@/hooks/useApi'
import { useAuth } from '@/hooks/useAuth'
import { companiesService } from '@/services/companies.service'
import {
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Save,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import { FloatingPanel } from '@/components/FloatingPanel'
import { useFormKeyboardNavigation } from '@/hooks/useFormKeyboardNavigation'
import { getProductUomName, withProductType } from '@/utils/productUomName'

const GENERAL_OWNER_OPTION = { value: 'GENERAL', label: 'Umum (GENERAL)' }

// ── Schemas ──────────────────────────────────────────────────────────────────

const materialSchema = z.object({
  // Existing row id (edit) so the update patches it instead of recreating it.
  id: z.number().optional(),
  product_inventory_id: z.coerce.number().min(0),
  qty: z.coerce.number().min(0.001),
  base_ratio: z.number().optional(),
  owner_ref: z.string().nullable().optional(),
  stage: z.string().nullable().optional(),
  location_ref: z.string().nullable().optional(),
})

const detailSchema = z.object({
  id: z.number().optional(),
  recipe_id: z.number().optional(),
  product_uom_id: z.coerce.number().min(0, 'Product required'),
  qty: z.coerce.number().min(0.001, 'Qty required'),
  status: z.enum(['pending', 'final']),
  expiry_date: z.string().optional(),
  planned_batch_code: z.string().optional(),
  description: z.string().optional(),
  owner_ref: z.string().nullable().optional(),
  stage: z.string().nullable().optional(),
  location_ref: z.string().nullable().optional(),
  materials: z.array(materialSchema),
})

const schema = z.object({
  date: z.string().min(1, 'Date is required'),
  status: z.enum(['pending', 'final']),
  description: z.string().optional(),
  source_owner_ref: z.string().min(1, 'Owner sumber wajib diisi'),
  source_stage: z.string().min(1, 'Stage sumber wajib diisi'),
  source_location_ref: z.string().optional(),
  output_owner_ref: z.string().min(1, 'Owner output wajib diisi'),
  output_stage: z.string().min(1, 'Stage output wajib diisi'),
  output_location_ref: z.string().optional(),
  details: z.array(detailSchema).min(1),
})

type FormValues = z.infer<typeof schema>

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProductionFormProps {
  mode: 'create' | 'edit'
  initialData?: any
  productionId?: number
  initialMaterialLabels?: Record<string, string>
  /** Edit mode: "Product — UOM" per detail index for the finished-product picker. */
  initialDetailLabels?: Record<number, string>
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const fieldInputStyle: React.CSSProperties = {
  width: '100%',
  height: 34,
  padding: '0 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  color: 'var(--foreground)',
  background: 'var(--surface-raised)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--foreground)',
  marginBottom: 6,
  display: 'block',
}

// Card shell + title shared by every section of the form.
const sectionCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-sm)',
  overflow: 'visible',
}

const sectionHeadStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13.5,
  fontWeight: 500,
  color: 'var(--foreground)',
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
}

/** Shared unwrap helper — handles both ApiResponse<array> and ApiResponse<PaginatedData> */
function unwrapList(resp: any): any[] {
  if (!resp) return []
  const d = resp.data
  if (Array.isArray(d)) return d
  if (d && Array.isArray(d.data)) return d.data
  return []
}

// ── MaterialPicker ────────────────────────────────────────────────────────────
// Trigger + popover combobox for selecting a material (product → inventory).
// All state is local per-row: no shared search state across rows.

const MATERIAL_PRODUCT_TYPES = 'supply,wip,raw'

interface MaterialPickerProps {
  label: string
  hasValue: boolean
  selectedInventoryId: number
  inventories: any[]
  ownerFilter?: string
  stagesFilter?: string
  onSelectInventory: (inv: any, productName: string) => void
  onOpenChange?: (open: boolean) => void
  /** Product ID resolved from label name (for materials without inventory yet). */
  resolvedProductId?: number | null
  /** Product name resolved from label name. */
  resolvedProductName?: string
}

export function MaterialPicker({
  label,
  hasValue,
  selectedInventoryId,
  inventories,
  ownerFilter,
  stagesFilter,
  onSelectInventory,
  onOpenChange,
  resolvedProductId,
  resolvedProductName,
}: MaterialPickerProps) {
  const { user } = useAuth()
  const branchId = user?.branch?.id

  const rootRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const autoSelectDoneRef = useRef(false)

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [step, setStep] = useState<'products' | 'inventory'>('products')
  const [productId, setProductId] = useState<number | null>(null)
  const [productName, setProductName] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const close = () => {
    setOpen(false)
    setSearch('')
    setDebouncedSearch('')
    setStep('products')
    setProductId(null)
    setProductName('')
    setHighlightIndex(0)
    onOpenChange?.(false)
  }

  const openPicker = () => {
    let resolvedPid: number | null = null
    let resolvedName = ''
    if (hasValue && selectedInventoryId > 0) {
      const sel = inventories.find(
        (i: any) => Number(i.id) === Number(selectedInventoryId),
      )
      if (sel) {
        const pid = Number(
          sel?.product_uom_batch?.product_uom?.product_id ??
            sel?.product_uom?.product_id ??
            0,
        )
        if (pid > 0) resolvedPid = pid
        resolvedName =
          sel?.product_uom_batch?.product_uom?.product?.name ??
          sel?.product_uom?.product?.name ??
          ''
      }
    }
    // Fallback: use the resolved product info from the label (for materials
    // loaded from a recipe that don't have inventory yet).
    if (!resolvedPid && resolvedProductId && resolvedProductId > 0) {
      resolvedPid = resolvedProductId
      resolvedName = resolvedProductName ?? ''
    }
    if (resolvedPid) {
      setProductId(resolvedPid)
      setProductName(resolvedName)
      setStep('inventory')
    } else {
      setProductId(null)
      setProductName('')
      setStep('products')
    }
    setSearch('')
    setDebouncedSearch('')
    setHighlightIndex(0)
    setOpen(true)
    onOpenChange?.(true)
  }

  // Close on click outside — handled by FloatingPanel, but also need to
  // prevent closing when clicking inside ANY FloatingPanel (child dropdowns
  // like SearchableSelect inside our popover).
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      // Don't close if click is inside our trigger, our popover, or any
      // FloatingPanel (e.g. a SearchableSelect dropdown inside our popover)
      if (
        rootRef.current?.contains(target) ||
        popoverRef.current?.contains(target) ||
        (target as HTMLElement).closest?.('[data-floating-panel]')
      ) {
        return
      }
      close()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Focus search input when opening on the products step
  useEffect(() => {
    if (open && step === 'products') {
      const t = setTimeout(() => searchInputRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [open, step])

  // Focus the popover container on the inventory step so keyboard nav works
  useEffect(() => {
    if (open && step === 'inventory') {
      popoverRef.current?.focus()
    }
  }, [open, step])

  // Products list — no minimum search length, max 50, sorted by name
  const { data: productsData, isFetching: productsFetching } = useQuery({
    queryKey: ['material-picker-products', debouncedSearch],
    enabled: open && step === 'products',
    queryFn: () =>
      api
        .get('/products', {
          params: {
            per_page: 50,
            'filter[types]': MATERIAL_PRODUCT_TYPES,
            sort: 'name',
            ...(debouncedSearch ? { 'filter[search]': debouncedSearch } : {}),
          },
        })
        .then((r) => r.data),
  })
  const products = useMemo(() => unwrapList(productsData), [productsData])

  // Inventories for the selected product — same filters as the previous
  // shared query, merged with the branch-wide list already loaded.
  const { data: invData, isFetching: invFetching } = useQuery({
    queryKey: ['material-picker-inventories', productId, branchId, ownerFilter, stagesFilter],
    enabled: open && step === 'inventory' && !!productId && !!branchId,
    refetchOnMount: 'always',
    staleTime: 0,
    queryFn: () =>
      api
        .get('/product-inventories', {
          params: {
            per_page: 500,
            include: 'product_uom_batch,product_uom_batch.product_uom,product_uom_batch.product_uom.product',
            'filter[status]': 'active',
            'filter[branch_id]': branchId,
            'filter[owner_refs]': ownerFilter,
            'filter[stages]': stagesFilter,
          },
        })
        .then((r) => r.data),
  })
  const pickerInventories = useMemo(() => {
    const byId = new Map<number, any>()
    ;[...unwrapList(invData), ...inventories].forEach((inv: any) => {
      if (inv?.id != null) byId.set(Number(inv.id), inv)
    })
    return Array.from(byId.values()).filter((inv: any) => {
      const pid =
        inv.product_uom_batch?.product_uom?.product_id ?? inv.product_uom?.product_id
      return Number(pid) === Number(productId)
    })
  }, [invData, inventories, productId])

  // Reset highlight when the visible list changes
  useEffect(() => {
    if (step === 'products') {
      setHighlightIndex(0)
    } else {
      const idx = pickerInventories.findIndex(
        (mi: any) => Number(mi.id) === Number(selectedInventoryId),
      )
      setHighlightIndex(idx >= 0 ? idx : 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, products, pickerInventories])

  // Keep the highlighted row in view while navigating with the keyboard
  useEffect(() => {
    const el = popoverRef.current?.querySelector(`[data-idx="${highlightIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex])

  // Auto-select when inventory list has exactly 1 item (after query finishes loading)
  useEffect(() => {
    if (
      step !== 'inventory' ||
      invFetching ||
      autoSelectDoneRef.current ||
      pickerInventories.length !== 1
    ) {
      return
    }
    // Don't auto-select if this item is already selected (reopening popover)
    if (Number(pickerInventories[0].id) === Number(selectedInventoryId)) {
      return
    }
    autoSelectDoneRef.current = true
    onSelectInventory(pickerInventories[0], productName)
    close()
  }, [step, invFetching, pickerInventories, selectedInventoryId])

  const chooseProduct = (p: any) => {
    setProductId(Number(p.id))
    setProductName(String(p.name ?? ''))
    setStep('inventory')
    setSearch('')
    setDebouncedSearch('')
    setHighlightIndex(0)
    autoSelectDoneRef.current = false
  }

  const chooseInventory = (mi: any) => {
    onSelectInventory(mi, productName)
    close()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    const list = step === 'products' ? products : pickerInventories
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((prev) => (list.length > 0 ? (prev + 1) % list.length : 0))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((prev) =>
        list.length > 0 ? (prev - 1 + list.length) % list.length : 0,
      )
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = list[highlightIndex]
      if (!item) return
      if (step === 'products') chooseProduct(item)
      else chooseInventory(item)
    }
  }

  const optionRowStyle = (highlighted: boolean): React.CSSProperties => ({
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    background: highlighted ? 'var(--accent-light-bg)' : 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: 11,
  })

  return (
    <div ref={rootRef} style={{ position: 'relative', minWidth: 0 }} data-material-row>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => (open ? close() : openPicker())}
        style={{
          width: '100%',
          height: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          padding: '0 10px',
          border: `1px solid ${open ? 'var(--accent-light)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-raised)',
          cursor: 'pointer',
          fontSize: 13,
          textAlign: 'left',
          color: label && !label.startsWith('Material #') ? 'var(--foreground)' : 'var(--foreground-subtle)',
          fontFamily: 'var(--font-sans)',
          boxSizing: 'border-box',
          boxShadow: open ? '0 0 0 2px var(--accent-light-bg)' : 'none',
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label && !label.startsWith('Material #') ? label : 'Pilih bahan...'}
        </span>
        <ChevronDown
          size={12}
          color="var(--foreground-muted)"
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms',
          }}
        />
      </button>

      {/* Popover via FloatingPanel */}
      <FloatingPanel
        anchorRef={rootRef}
        open={open}
        onClose={close}
        minWidth={360}
        maxHeight={280}
      >
        <div
          ref={popoverRef}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          style={{ outline: 'none' }}
        >
          {/* Step 1 — product search */}
          {step === 'products' && (
            <>
              <div style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>
                <input
                  ref={searchInputRef}
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Cari bahan..."
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 11,
                    outline: 'none',
                    background: 'var(--surface-raised)',
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--foreground)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {products.length === 0 ? (
                  <div style={{ padding: 10, textAlign: 'center', fontSize: 11, color: 'var(--foreground-muted)' }}>
                    {productsFetching ? 'Memuat...' : 'Tidak ditemukan'}
                  </div>
                ) : (
                  products.map((p: any, i: number) => (
                    <button
                      key={p.id}
                      type="button"
                      data-idx={i}
                      onClick={() => chooseProduct(p)}
                      onMouseEnter={() => setHighlightIndex(i)}
                      style={optionRowStyle(i === highlightIndex)}
                    >
                      <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>{withProductType(p.name, p.type)}</span>
                      <span style={{ color: 'var(--foreground-muted)', fontSize: 10 }}>{p.code}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {/* Step 2 — inventory picker */}
          {step === 'inventory' && (
            <>
              <div
                style={{
                  padding: '6px 10px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--foreground-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  <strong style={{ color: 'var(--foreground)' }}>{productName}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStep('products')
                    setProductId(null)
                    setProductName('')
                    setSearch('')
                    setDebouncedSearch('')
                    setHighlightIndex(0)
                  }}
                  style={{
                    fontSize: 10,
                    color: 'var(--accent)',
                    background: 'var(--accent-light-bg)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px 6px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    flexShrink: 0,
                  }}
                >
                  ← Ganti Produk
                </button>
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto', padding: 4 }}>
                {invFetching ? (
                  <div style={{ padding: 10, textAlign: 'center', fontSize: 11, color: 'var(--foreground-muted)' }}>
                    Memuat stok...
                  </div>
                ) : pickerInventories.length === 0 ? (
                  <div style={{ padding: 10, textAlign: 'center', fontSize: 11, color: 'var(--destructive)' }}>
                    Tidak ada stok aktif
                  </div>
                ) : (
                  <>
                    {pickerInventories.length > 1 && (
                      <div
                        style={{
                          padding: '6px 10px',
                          marginBottom: 6,
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 11,
                          fontWeight: 500,
                          color: 'var(--warning)',
                          background: 'var(--warning-bg)',
                        }}
                      >
                        Ada {pickerInventories.length} stok tersedia, silakan pilih salah satu
                      </div>
                    )}
                    {pickerInventories.map((mi: any, i: number) => {
                    const uomCode =
                      mi.product_uom?.uom?.code ??
                      mi.product_uom_batch?.product_uom?.uom?.code ??
                      'UOM'
                    const sku = mi.code ?? `#${mi.id}`
                    const stock = mi.display_qty ?? mi.qty ?? 0
                    const isSelected = Number(mi.id) === Number(selectedInventoryId)
                    return (
                      <button
                        key={mi.id}
                        type="button"
                        data-idx={i}
                        onClick={() => chooseInventory(mi)}
                        onMouseEnter={() => setHighlightIndex(i)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                          padding: '5px 8px',
                          border: `1px solid ${isSelected ? 'var(--accent-light)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius-sm)',
                          background:
                            i === highlightIndex
                              ? 'var(--accent-light-bg)'
                              : isSelected
                                ? 'var(--accent-light-bg)'
                                : 'var(--surface)',
                          color: 'var(--foreground)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 11,
                          marginBottom: 3,
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                          <span
                            style={{
                              padding: '1px 5px',
                              background: 'var(--accent-light-bg)',
                              color: 'var(--accent)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 9,
                              fontWeight: 500,
                              flexShrink: 0,
                            }}
                          >
                            {uomCode}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {sku}
                          </span>
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            color: stock > 0 ? 'var(--success)' : 'var(--destructive)',
                            flexShrink: 0,
                          }}
                        >
                          {stock > 0 ? stock : '0'}
                        </span>
                      </button>
                    )
                  })}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </FloatingPanel>
    </div>
  )
}

// ── MaterialsFieldArray ───────────────────────────────────────────────────────

interface MaterialsFieldArrayProps {
  control: any
  detailIndex: number
  register: any
  inventories: any[]
  errors: any
  onLoadFromRecipe: (index: number) => void
  isLoadingRecipe: boolean
  onSelectMaterialInventory: (detailIndex: number, matIndex: number, inv: any, productName: string) => void
  onRemoveMaterial: (detailIndex: number, matIndex: number) => void
  materialLabels: Record<string, string>
  needsStockPick: Record<string, boolean>
  materialProductUomIds: Record<string, number>
  setValue: any
  onMaterialQtyEdit?: (detailIndex: number, matIndex: number, qty: number) => void
  companyOptions: { value: string; label: string }[]
  stageOptions: { value: string; label: string }[]
  ownerFilter?: string
  stagesFilter?: string
}

export function MaterialsFieldArray({
  control,
  detailIndex,
  register,
  inventories,
  errors,
  onLoadFromRecipe,
  onMaterialQtyEdit,
  isLoadingRecipe,
  onSelectMaterialInventory,
  onRemoveMaterial,
  materialLabels,
  needsStockPick,
  materialProductUomIds,
  setValue,
  companyOptions,
  stageOptions,
  ownerFilter,
  stagesFilter,
}: MaterialsFieldArrayProps) {

  const { fields, append, remove } = useFieldArray({
    control,
    name: `details.${detailIndex}.materials` as any,
  })

  const watchedMaterials = useWatch({
    control,
    name: `details.${detailIndex}.materials`
  })

  // Which row's picker popover is open (boosts z-index above sibling rows)
  const [openMatIndex, setOpenMatIndex] = useState<number | null>(null)

  // Source Owner + Source Location sit behind "Allocation" (Stage stays in the
  // row). Opens on its own when a material already carries a custom value.
  const [showAllocation, setShowAllocation] = useState(false)
  const hasCustomAllocation = (watchedMaterials ?? []).some(
    (m: any) => (m?.owner_ref && m.owner_ref !== 'GENERAL') || (m?.location_ref && m.location_ref !== 'GENERAL'),
  )
  useEffect(() => {
    if (hasCustomAllocation) setShowAllocation(true)
  }, [hasCustomAllocation])

  const cols = '24px minmax(0, 1fr) 170px 90px 104px 28px'
  const colHead: React.CSSProperties = { ...sectionHeaderStyle, fontSize: 10 }
  const hint = (text: string, color: string) => (
    <span style={{ fontSize: 11, color, marginTop: 3, display: 'block', fontWeight: 500 }}>{text}</span>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={sectionHeaderStyle}>Bahan Baku</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {fields.length > 0 && (
            <button
              type="button"
              className="alloc-toggle"
              aria-expanded={showAllocation}
              onClick={() => setShowAllocation((v) => !v)}
              title="Show Source Owner and Source Location on each material"
            >
              <span className="v2-link">Allocation</span>
              {!showAllocation && <span className="alloc-summary">{hasCustomAllocation ? 'custom' : 'GENERAL'}</span>}
              <ChevronDown size={14} style={{ transform: showAllocation ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onLoadFromRecipe(detailIndex)}
            disabled={isLoadingRecipe}
            className="v2-btn v2-btn-ghost v2-btn-sm"
          >
            {isLoadingRecipe ? (
              <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <BookOpen size={13} />
            )}
            {isLoadingRecipe ? 'Loading...' : 'Load Recipe'}
          </button>
          <button
            type="button"
            onClick={() => append({ product_inventory_id: 0, qty: 1, owner_ref: null, stage: null, location_ref: null })}
            className="v2-btn v2-btn-outline v2-btn-sm"
          >
            <Plus size={13} />
            Add
          </button>
        </div>
      </div>

      {fields.length === 0 && (
        <div
          style={{
            padding: '14px 12px',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 12,
            color: 'var(--foreground-subtle)',
            textAlign: 'center',
          }}
        >
          Tanpa bahan baku (opsional) — klik Add atau Load Recipe untuk menambahkan.
        </div>
      )}

      {fields.length > 0 && (
        <div className="mat-table" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          {/* Column headers */}
          <div
            className="mat-row"
            style={{
              display: 'grid',
              gridTemplateColumns: cols,
              gap: 8,
              padding: '8px 12px',
              alignItems: 'center',
              background: 'var(--surface-muted, var(--background))',
              borderBottom: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            }}
          >
            <span style={{ ...colHead, textAlign: 'center' }}>#</span>
            <span style={colHead}>Bahan Baku</span>
            <span style={colHead}>Source Stage</span>
            <span style={{ ...colHead, textAlign: 'right' }}>Qty</span>
            <span style={colHead}>Stok</span>
            <span />
          </div>

          {/* Rows */}
          {fields.map((field, matIndex) => {
            const labelKey = `${detailIndex}-${matIndex}`
            const existingLabel =
              materialLabels[labelKey] ?? `Material #${matIndex + 1}`

            const currentMat = watchedMaterials?.[matIndex]
            const invId = currentMat?.product_inventory_id
            const inv = inventories.find((i: any) => i.id === invId)
            const availableStock = inv ? Number(inv.display_qty ?? inv.stock ?? 0) : 0
            const reqQty = Number(currentMat?.qty ?? 0)
            const hasNoInventory = !invId || invId <= 0
            const isOutOfStock = inv && availableStock <= 0
            const isInsufficient = inv && availableStock > 0 && availableStock < reqQty
            const hasValue = !!invId && invId > 0
            const hasLabel = existingLabel && existingLabel !== `Material #${matIndex + 1}`
            const stockBadge = hasNoInventory
              ? hasLabel
                ? { text: 'Blm ada stok', color: 'var(--destructive)', bg: 'var(--destructive-bg)' }
                : null
              : isOutOfStock
              ? { text: 'Stok: 0', color: 'var(--destructive)', bg: 'var(--destructive-bg)' }
              : isInsufficient
              ? { text: `Stok: ${availableStock}`, color: 'var(--warning)', bg: 'var(--warning-bg)' }
              : inv
              ? { text: `Stok: ${availableStock}`, color: 'var(--success)', bg: 'var(--success-bg)' }
              : null

            return (
              <div
                key={field.id}
                className="mat-row"
                style={{
                  position: 'relative',
                  zIndex: openMatIndex === matIndex ? 30 : 1,
                  display: 'grid',
                  gridTemplateColumns: cols,
                  columnGap: 8,
                  rowGap: 8,
                  alignItems: 'start',
                  padding: '10px 12px',
                  borderBottom: matIndex < fields.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                {/* Index */}
                <div style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--foreground-subtle)' }}>
                  {matIndex + 1}
                </div>

                {/* Material picker (trigger + popover) + stock hint */}
                <div style={{ position: 'relative', minWidth: 0 }}>
              <MaterialPicker
                label={existingLabel}
                hasValue={hasValue}
                selectedInventoryId={invId ? Number(invId) : 0}
                inventories={inventories}
                ownerFilter={ownerFilter}
                stagesFilter={stagesFilter}
                onSelectInventory={(mi, productName) =>
                  onSelectMaterialInventory(detailIndex, matIndex, mi, productName)
                }
                onOpenChange={(isOpen) => setOpenMatIndex(isOpen ? matIndex : null)}
                resolvedProductId={(() => {
                  // Resolve product ID from label name (for recipe-loaded materials
                  // that don't have product_inventory_id yet).
                  const productNameFromLabel = existingLabel
                    .split(/\s*[·—]\s*/)[0]
                    .trim()
                  if (!productNameFromLabel || productNameFromLabel.startsWith('Material #')) return null
                  const match = inventories.find((i: any) => {
                    const name =
                      i?.product_uom_batch?.product_uom?.product?.name ??
                      i?.product_uom?.product?.name ??
                      ''
                    return name === productNameFromLabel
                  })
                  if (match) {
                    const pid = Number(
                      match?.product_uom_batch?.product_uom?.product_id ??
                      match?.product_uom?.product_id ?? 0,
                    )
                    return pid > 0 ? pid : null
                  }
                  return null
                })()}
                resolvedProductName={(() => {
                  const productNameFromLabel = existingLabel
                    .split(/\s*[·—]\s*/)[0]
                    .trim()
                  if (!productNameFromLabel || productNameFromLabel.startsWith('Material #')) return ''
                  return productNameFromLabel
                })()}
              />

                  {needsStockPick[`${detailIndex}-${matIndex}`]
                    ? hint(
                        `Ada ${inventories.filter((i: any) => Number(i.product_uom_batch?.product_uom_id) === Number(materialProductUomIds[`${detailIndex}-${matIndex}`])).length} pilihan stok, silakan pilih`,
                        'var(--warning)',
                      )
                    : hasNoInventory && hasLabel
                      ? hint('Stok belum ada', 'var(--destructive)')
                      : null}
                  {isOutOfStock && hint('Stok habis (0)', 'var(--destructive)')}
                  {isInsufficient && hint(`Stok kurang (${availableStock})`, 'var(--warning)')}
                </div>

                {/* Source stage (Owner + Location live behind Allocation) */}
                <Controller
                  name={`details.${detailIndex}.materials.${matIndex}.stage` as any}
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? ''}
                      onChange={(v) => field.onChange(v || null)}
                      options={[{ value: 'GENERAL', label: 'General' }, ...stageOptions.filter(o => o.value !== 'GENERAL')]}
                      placeholder="Ikuti header..."
                      searchPlaceholder="Cari stage..."
                    />
                  )}
                />

                {(() => {
                  const reg = register(
                    `details.${detailIndex}.materials.${matIndex}.qty` as any,
                    { valueAsNumber: true }
                  )
                  return (
                    <input
                      type="number"
                      min={0.001}
                      step={0.001}
                      {...reg}
                      onChange={(e) => {
                        reg.onChange(e)
                        setValue(`details.${detailIndex}.materials.${matIndex}.base_ratio` as any, undefined)
                      }}
                      placeholder="Qty"
                      style={{ ...fieldInputStyle, textAlign: 'right' }}
                    />
                  )
                })()}

                {/* Stock */}
                <div style={{ height: 34, display: 'flex', alignItems: 'center', minWidth: 0 }}>
                  {stockBadge ? (
                    <span
                      title={stockBadge.text}
                      style={{
                        maxWidth: '100%',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 500,
                        color: stockBadge.color,
                        background: stockBadge.bg,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {stockBadge.text}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>—</span>
                  )}
                </div>

                <div style={{ height: 34, display: 'flex', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="v2-icon-btn"
                    data-tone="danger"
                    title="Remove material"
                    onClick={() => {
                      remove(matIndex)
                      onRemoveMaterial(detailIndex, matIndex)
                    }}
                    // Materials are optional — the last row can be removed too.
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Allocation: per-material Source Owner + Source Location */}
                {showAllocation && (
                  <div
                    className="mat-alloc"
                    style={{
                      gridColumn: '2 / -1',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 8,
                    }}
                  >
                    <div>
                      <label style={{ ...labelStyle, fontSize: 11, color: 'var(--foreground-muted)', marginBottom: 4 }}>Source Owner</label>
                      <Controller
                        name={`details.${detailIndex}.materials.${matIndex}.owner_ref` as any}
                        control={control}
                        render={({ field }) => (
                          <SearchableSelect
                            value={field.value ?? ''}
                            onChange={(v) => field.onChange(v || null)}
                            options={[{ value: 'GENERAL', label: 'General' }, ...companyOptions.filter(o => o.value !== 'GENERAL')]}
                            placeholder="Ikuti header..."
                            searchPlaceholder="Cari owner..."
                          />
                        )}
                      />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 11, color: 'var(--foreground-muted)', marginBottom: 4 }}>Source Location</label>
                      <Controller
                        name={`details.${detailIndex}.materials.${matIndex}.location_ref` as any}
                        control={control}
                        render={({ field }) => (
                          <SearchableSelect
                            value={field.value ?? ''}
                            onChange={(v) => field.onChange(v || null)}
                            options={[{ value: 'GENERAL', label: 'General' }]}
                            placeholder="Ikuti header..."
                            searchPlaceholder="Cari lokasi..."
                          />
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProductionForm({
  mode,
  initialData,
  productionId,
  initialMaterialLabels,
  initialDetailLabels,
}: ProductionFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const activeBranchId = user?.branch?.id

  // Branch type determines which product types appear in the details selector:
  // - production → RAW + WIP (produces raw materials into WIP)
  // - warehouse → WIP (only semi-finished goods being processed)
  // - outlet → RAW + FINAL (raw materials + ready-to-sell finished goods)
  const branchType = (user as any)?.branch?.type as string | undefined
  const detailProductTypes: string =
    branchType === 'production' ? 'raw,wip' :
    branchType === 'warehouse' ? 'wip' :
    'raw,final'

  // Materials include supply + wip + raw — hardcoded inside MaterialPicker.

  const [expandedDetails, setExpandedDetails] = useState<number[]>([0])
  const [loadingRecipeFor, setLoadingRecipeFor] = useState<number | null>(null)

  // ── Finished product two-step search ──────────────────────────────────────
  const [activeDetailIndex, setActiveDetailIndex] = useState<number | null>(null)
  const [sharedProductSearch, setSharedProductSearch] = useState('')
  const [sharedProductSearchDebounced, setSharedProductSearchDebounced] = useState('')
  const [sharedSelectedProductId, setSharedSelectedProductId] = useState<number | null>(null)
  const [sharedSelectedProductName, setSharedSelectedProductName] = useState('')
  const [sharedShowUomPicker, setSharedShowUomPicker] = useState(false)
  const [detailLabels, setDetailLabels] = useState<Record<number, string>>({})

  // label per detail+mat key
  const [materialLabels, setMaterialLabels] = useState<Record<string, string>>({})
  // Track materials that need manual stock selection (>1 match from recipe)
  const [needsStockPick, setNeedsStockPick] = useState<Record<string, boolean>>({})
  // Map `${detailIndex}-${matIndex}` → product_uom_id for recipe-loaded materials,
  // so we can re-run auto-select when the source stage/owner changes.
  const [materialProductUomIds, setMaterialProductUomIds] = useState<Record<string, number>>({})

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      status: 'final',
      description: '',
      source_owner_ref: 'GENERAL',
      source_stage: 'GENERAL',
      source_location_ref: 'GENERAL',
      output_owner_ref: 'GENERAL',
      output_stage: 'GENERAL',
      output_location_ref: 'GENERAL',
      details: [
        {
          product_uom_id: 0,
          qty: 1,
          status: 'final',
          expiry_date: '',
          description: '',
          owner_ref: null,
          stage: null,
          location_ref: null,
          materials: [],
        },
      ],
    },
  })

  const { fields: detailFields, append: appendDetail, remove: removeDetail } =
    useFieldArray({ control, name: 'details' })

  const [focusNewDetailIndex, setFocusNewDetailIndex] = useState<number | null>(null)

  const handleAddDetail = () => {
    appendDetail({
      product_uom_id: 0,
      qty: 1,
      status: 'final',
      expiry_date: '',
      description: '',
      owner_ref: null,
      stage: null,
      location_ref: null,
      materials: [],
    })
    const nextIdx = detailFields.length
    setExpandedDetails((prev) => [...prev, nextIdx])
    setFocusNewDetailIndex(nextIdx)
  }

  useFormKeyboardNavigation({
    onAddItem: handleAddDetail,
  })

  useEffect(() => {
    if (focusNewDetailIndex !== null) {
      const timer = setTimeout(() => {
        const el = document.querySelector<HTMLElement>(
          `[data-prod-detail-index="${focusNewDetailIndex}"] input`
        )
        if (el) {
          el.focus()
        }
        setFocusNewDetailIndex(null)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [focusNewDetailIndex, detailFields.length])

  const watchDetails = watch('details')
  const watchSourceOwnerRef = watch('source_owner_ref')
  const watchSourceStage = watch('source_stage')
  const watchSourceLocationRef = watch('source_location_ref')

  // Owner + Location ("Allocation") are collapsed by default — Stage is the
  // usual choice. Opens on its own when a loaded record uses a non-GENERAL value.
  const [showAllocation, setShowAllocation] = useState(false)
  const allocationValues = [
    watchSourceOwnerRef,
    watchSourceLocationRef,
    watch('output_owner_ref'),
    watch('output_location_ref'),
  ]
  const hasCustomAllocation = allocationValues.some((v) => v && v !== 'GENERAL')
  useEffect(() => {
    if (hasCustomAllocation) setShowAllocation(true)
  }, [hasCustomAllocation])

  // Same idea for the per-item Output Owner / Output Location overrides.
  const [showItemAllocation, setShowItemAllocation] = useState(false)
  const hasCustomItemAllocation = (watch('details') ?? []).some(
    (d: any) => (d?.owner_ref && d.owner_ref !== 'GENERAL') || (d?.location_ref && d.location_ref !== 'GENERAL'),
  )
  useEffect(() => {
    if (hasCustomItemAllocation) setShowItemAllocation(true)
  }, [hasCustomItemAllocation])

  // Track per-material stage/owner overrides via a form subscription.
  // This avoids useWatch (which re-renders on every keystroke) and
  // avoids useMemo on the watch() proxy (which never detects changes).
  const [materialStagesKey, setMaterialStagesKey] = useState('')
  const [materialOwnersKey, setMaterialOwnersKey] = useState('')

  useEffect(() => {
    const subscription = watch((value) => {
      const stages = new Set<string>()
      const owners = new Set<string>()
      ;(value.details ?? []).forEach((d: any) => {
        ;(d?.materials ?? []).forEach((m: any) => {
          if (m?.stage) stages.add(m.stage)
          if (m?.owner_ref) owners.add(m.owner_ref)
        })
      })
      const newStagesKey = Array.from(stages).sort().join(',')
      const newOwnersKey = Array.from(owners).sort().join(',')
      setMaterialStagesKey((prev) => (prev !== newStagesKey ? newStagesKey : prev))
      setMaterialOwnersKey((prev) => (prev !== newOwnersKey ? newOwnersKey : prev))
    })
    return subscription.unsubscribe
  }, [watch])

  // Build comma-separated filter values: header value + all per-material overrides.
  // Derived from the subscription keys above (stable strings that only change
  // when the actual stage/owner values change).
  const effectiveStagesFilter = useMemo(() => {
    const all = new Set<string>()
    if (watchSourceStage) all.add(watchSourceStage)
    materialStagesKey.split(',').filter(Boolean).forEach((s) => all.add(s))
    return all.size > 0 ? Array.from(all).join(',') : undefined
  }, [watchSourceStage, materialStagesKey])

  const effectiveOwnerFilter = useMemo(() => {
    const all = new Set<string>()
    if (watchSourceOwnerRef) all.add(watchSourceOwnerRef)
    materialOwnersKey.split(',').filter(Boolean).forEach((o) => all.add(o))
    return all.size > 0 ? Array.from(all).join(',') : undefined
  }, [watchSourceOwnerRef, materialOwnersKey])

  // Debounce effects
  useEffect(() => {
    const t = setTimeout(() => setSharedProductSearchDebounced(sharedProductSearch), 400)
    return () => clearTimeout(t)
  }, [sharedProductSearch])

  // Click-outside handler — close the finished-product dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-prod-item-search]')) {
        if (!sharedShowUomPicker) {
          setActiveDetailIndex(null)
          setSharedProductSearch('')
        }
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [sharedShowUomPicker])

  // Queries

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])

  // Dimension pickers: owner (company) + stage
  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies-all', debouncedDropdownSearch],
    queryFn: () => companiesService.list({ 'filter[search]': debouncedDropdownSearch || undefined,  per_page: 100 } as any).then((r) => r.data),
  })
  const companies: { id: number; name: string }[] = (companiesData as any)?.data ?? []
  const companyOptions = [
    GENERAL_OWNER_OPTION,
    ...companies.map((c) => ({ value: String(c.id), label: c.name })),
  ]

  const { data: stagesData, isLoading: stagesLoading } = useQuery({
    queryKey: ['stages-all', debouncedDropdownSearch],
    queryFn: () => api.get('/stages', { params: { per_page: 100 } }).then((r) => r.data),
  })
  const stages: { code: string; name: string }[] = (stagesData as any)?.data ?? []
  const stageOptions = stages.map((s) => ({ value: s.code, label: s.name }))

  // Default Output Ke stage to 'finished' once stages load, for a fresh create
  // form only — never touches an in-progress edit or a value the user changed.
  const didDefaultOutputStage = useRef(false)
  useEffect(() => {
    if (mode !== 'create' || didDefaultOutputStage.current || stages.length === 0) return
    didDefaultOutputStage.current = true
    const hasFinished = stages.some((s) => s.code === 'finished')
    if (hasFinished) {
      setValue('output_stage', 'finished')
    }
  }, [mode, stages, setValue])

  // Finished-product picker options: every product-UOM whose parent product is
  // type=final — NOT filtered by branch inventory, so brand-new products this
  // branch has never produced can still be selected. /product-uoms has no
  // Finished product search (Step 1)
  const { data: prodItemData, isFetching: isFetchingProdItems } = useQuery({
    queryKey: ['prod-item-product-search', sharedProductSearchDebounced, detailProductTypes],
    enabled: sharedProductSearchDebounced.length >= 2,
    queryFn: () =>
      api
        .get('/products', {
          params: {
            per_page: 500,
            'filter[types]': detailProductTypes,
            'filter[search]': sharedProductSearchDebounced,
            sort: 'name',
          },
        })
        .then((r) => r.data),
  })
  const prodItemProducts = unwrapList(prodItemData)
  // Still typing (debounce pending) or waiting on the API → show "searching", not "not found".
  const isSearchingProdItems = isFetchingProdItems || sharedProductSearch !== sharedProductSearchDebounced

  // UOMs for selected finished product (Step 2)
  const { data: prodItemUomData, isFetching: isFetchingProdItemUoms } = useQuery({
    queryKey: ['prod-item-uoms', sharedSelectedProductId],
    enabled: !!sharedSelectedProductId,
    queryFn: () =>
      api
        .get('/product-uoms', {
          params: {
            per_page: 500,
            include: 'uom',
            'filter[product_id]': sharedSelectedProductId,
          },
        })
        .then((r) => r.data),
  })
  const prodItemUoms = unwrapList(prodItemUomData)

  const { data: inventoriesData, isFetching: isFetchingInventories } = useQuery({
    // Not tied to dropdownSearch: that text belongs to the owner/stage pickers,
    // and filtering this list by it broke material validation, load-from-recipe
    // and the dimension re-check. MaterialPicker does its own per-product search.
    queryKey: ['product-inventories-all', activeBranchId, effectiveOwnerFilter, effectiveStagesFilter],
    enabled: !!activeBranchId,
    refetchOnMount: 'always',
    staleTime: 0,
    queryFn: () =>
      productInventoriesService
        .list({
          per_page: 1000,
          include:
            'branch,product_uom_batch,product_uom_batch.product_uom,product_uom_batch.product_uom.product,product_uom_batch.product_uom.uom',
          'filter[branch_id]': activeBranchId,
          'filter[owner_refs]': effectiveOwnerFilter,
          'filter[stages]': effectiveStagesFilter,
        } as any)
        .then((r) => r.data),
  })
  const inventories = (inventoriesData as any)?.data ?? []
  // Edit mode: prefill
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      reset({
        source_owner_ref: 'GENERAL',
        source_stage: 'GENERAL',
        source_location_ref: 'GENERAL',
        output_owner_ref: 'GENERAL',
        output_stage: 'GENERAL',
        output_location_ref: 'GENERAL',
        ...initialData,
      })
      const indices = (initialData.details ?? []).map((_: any, i: number) => i)
      setExpandedDetails(indices)
      // Seed labels from API response immediately (no need to wait for inventories)
      if (initialMaterialLabels && Object.keys(initialMaterialLabels).length > 0) {
        setMaterialLabels(initialMaterialLabels)
      }
      // Saved finished products show their name instead of the placeholder.
      if (initialDetailLabels && Object.keys(initialDetailLabels).length > 0) {
        setDetailLabels(initialDetailLabels)
      }
    }
  }, [mode, initialData, reset]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDetail = (index: number) => {
    setExpandedDetails((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    )
  }

  const handleLoadFromRecipe = useCallback(
    async (detailIndex: number) => {
      const productUomId = watchDetails[detailIndex]?.product_uom_id
      if (!productUomId || productUomId === 0) {
        toast.error('Select a product first')
        return
      }
      setLoadingRecipeFor(detailIndex)
      try {
        // Fetch the DEFAULT recipe for this product_uom via the default_recipe
        // relation — a product_uom can have multiple recipes, only one is_default.
        const res = await productUomsService.findById(productUomId, {
          include: 'default_recipe',
        } as any)
        const recipe = (res.data as any)?.data?.default_recipe
        if (!recipe) {
          toast.error('No default recipe found for this product')
          return
        }
        const rawMaterials = recipe.recipe_materials ?? []
        if (!rawMaterials.length) {
          toast.error('Recipe has no materials')
          return
        }

        // Keep every recipe row as-is (no grouping) so the UI shows the same
        // number of materials as the API response.
        const materials = rawMaterials

        const recipeQty = Number(recipe.qty) || 1
        const prodQty = recipeQty // override with recipe's yield qty
        setValue(`details.${detailIndex}.qty` as any, prodQty)
        const missing: string[] = []
        const needsPickKeys: string[] = []
        const productUomMap: Record<string, number> = {}
        let mappedIndex = 0
        const mappedMaterials = materials.map((mat: any) => {
          productUomMap[`${detailIndex}-${mappedIndex}`] = Number(mat.product_uom_id)
          const matches = inventories.filter(
            (inv: any) =>
              inv.product_uom_batch?.product_uom_id === mat.product_uom_id
          )
          const sorted = matches.slice().sort((a: any, b: any) => {
            // Prefer rows with stock > 0 (in that row's own uom)
            const aHasStock = Number(a.display_qty ?? a.stock) > 0 ? 1 : 0
            const bHasStock = Number(b.display_qty ?? b.stock) > 0 ? 1 : 0
            if (aHasStock !== bHasStock) return bHasStock - aHasStock
            // Then FIFO: oldest expiry first; null expiry treated as Infinity (use last)
            const aExp = a.product_uom_batch?.expiry_date
              ? new Date(a.product_uom_batch.expiry_date).getTime()
              : Infinity
            const bExp = b.product_uom_batch?.expiry_date
              ? new Date(b.product_uom_batch.expiry_date).getTime()
              : Infinity
            return aExp - bExp
          })
          const qty = Number(mat.qty) || 0
          if (matches.length === 0) {
            // No stock at all
            missing.push(
              getProductUomName(mat.product_uom, String(mat.product_uom?.product_id ?? '?'))
            )
            mappedIndex++
            return {
              product_inventory_id: 0,
              qty,
              base_ratio: recipeQty > 0 ? qty / recipeQty : 0,
              owner_ref: null,
              stage: null,
              location_ref: null,
            }
          }
          if (matches.length === 1) {
            // Exactly 1 match → auto-select
            mappedIndex++
            return {
              product_inventory_id: sorted[0].id,
              qty,
              base_ratio: recipeQty > 0 ? qty / recipeQty : 0,
              owner_ref: null,
              stage: null,
              location_ref: null,
            }
          }
          // Multiple matches → don't select, mark as needing manual pick
          needsPickKeys.push(`${detailIndex}-${mappedIndex}`)
          mappedIndex++
          return {
            product_inventory_id: 0,
            qty,
            base_ratio: recipeQty > 0 ? qty / recipeQty : 0,
            owner_ref: null,
            stage: null,
            location_ref: null,
          }
        })
        // Still set labels and materials even if some materials lack inventory at this branch.
        // Stock availability will be validated when the user submits Create Production.
        const labels: Record<string, string> = {}
        materials.forEach((m: any, idx: number) => {
          const productName = getProductUomName(m.product_uom, String(m.product_uom?.product_id ?? '?'))
          const uomCode = m.product_uom?.uom?.code ?? ''
          const sku = m.product_uom?.code ?? ''
          labels[`${detailIndex}-${idx}`] = `${productName} · ${uomCode} · ${sku}`
        })
        setMaterialLabels((prev) => {
          const next = { ...prev }
          Object.keys(next).forEach((k) => {
            if (k.startsWith(`${detailIndex}-`)) delete next[k]
          })
          return { ...next, ...labels }
        })
        // Update needsStockPick: clear old entries for this detail, set new ones
        setNeedsStockPick((prev) => {
          const next = { ...prev }
          Object.keys(next).forEach((k) => {
            if (k.startsWith(`${detailIndex}-`)) delete next[k]
          })
          needsPickKeys.forEach((k) => { next[k] = true })
          return next
        })
        // Store product_uom_id per material row for reactive auto-select
        setMaterialProductUomIds((prev) => {
          const next = { ...prev }
          Object.keys(next).forEach((k) => {
            if (k.startsWith(`${detailIndex}-`)) delete next[k]
          })
          return { ...next, ...productUomMap }
        })
        setValue(
          `details.${detailIndex}.materials`,
          mappedMaterials.length > 0
            ? mappedMaterials
            : [{ product_inventory_id: 0, qty: 1, owner_ref: null, stage: null, location_ref: null }]
        )
        if (needsPickKeys.length > 0) {
          toast.warning(
            `${needsPickKeys.length} material punya lebih dari satu stok, silakan pilih stok`
          )
        } else if (missing.length > 0) {
          toast.warning(
            `Loaded ${materials.length} material(s) dari resep. ${missing.length} material belum ada stok: ${missing.join(', ')}`
          )
        } else {
          toast.success(`Loaded ${materials.length} material(s) dari resep`)
        }
      } catch {
        toast.error('Failed to load recipe')
      } finally {
        setLoadingRecipeFor(null)
      }
    },
    [watchDetails, inventories, setValue],
  )

  // Derive material labels from inventories so edit mode shows readable names
  // instead of "Material #1". Manual labels (set via picker) take precedence.
  const derivedMaterialLabels = useMemo(() => {
    const labels: Record<string, string> = {}
      ; (watchDetails ?? []).forEach((d: any, di: number) => {
        ; (d?.materials ?? []).forEach((m: any, mi: number) => {
          const id = m?.product_inventory_id
          if (!id) return
          const inv = inventories.find((i: any) => i.id === id)
          if (!inv) return
          const name =
            getProductUomName(inv?.product_uom_batch?.product_uom ?? inv?.product_uom) ||
            (inv?.code ?? `Material #${id}`)
          const uomCode =
            inv?.product_uom_batch?.product_uom?.uom?.code ??
            inv?.product_uom?.uom?.code ??
            ''
          const sku = inv?.code ?? ''
          labels[`${di}-${mi}`] = [name, uomCode, sku ? `SKU: ${sku}` : '']
            .filter(Boolean)
            .join(' · ')
        })
      })
    return labels
  }, [watchDetails, inventories])

  const mergedMaterialLabels = useMemo(
    () => ({ ...derivedMaterialLabels, ...materialLabels }),
    [derivedMaterialLabels, materialLabels],
  )

  // Cache every inventory row ever seen, keyed by id, so a stale
  // product_inventory_id (invalidated by an owner/stage/location change)
  // can still be traced back to the product it belonged to.
  const inventoryCacheRef = useRef<Map<number, any>>(new Map())
  useEffect(() => {
    inventories.forEach((inv: any) => {
      if (inv?.id != null) inventoryCacheRef.current.set(Number(inv.id), inv)
    })
  }, [inventories])

  // Re-validate selected materials whenever the source dimension (owner /
  // stage / location) changes: a previously selected product_inventory_id
  // may no longer exist under the new dimension. If exactly one matching
  // inventory remains for that material's product, auto-select it; if none
  // or more than one match, clear the selection and notify the user to pick
  // again.
  const prevSourceDimKeyRef = useRef<string | null>(null)
  const pendingSourceDimKeyRef = useRef<string | null>(null)
  useEffect(() => {
    const dimKey = `${watchSourceOwnerRef ?? ''}|${watchSourceStage ?? ''}|${watchSourceLocationRef ?? ''}`

    if (prevSourceDimKeyRef.current === null) {
      prevSourceDimKeyRef.current = dimKey
      return
    }
    if (dimKey !== prevSourceDimKeyRef.current) {
      prevSourceDimKeyRef.current = dimKey
      pendingSourceDimKeyRef.current = dimKey
      return
    }
    if (pendingSourceDimKeyRef.current !== dimKey) return
    if (isFetchingInventories) return
    pendingSourceDimKeyRef.current = null

    const currentDetails = getValues('details') || []
    let autoCount = 0
    const ambiguous: string[] = []
    const noStock: string[] = []

    currentDetails.forEach((d, di) => {
      ;(d.materials || []).forEach((m, mi) => {
        const invId = Number(m.product_inventory_id)
        if (!invId) return
        const stillValid = inventories.some((i: any) => Number(i.id) === invId)
        if (stillValid) return

        const cached = inventoryCacheRef.current.get(invId)
        const productId =
          cached?.product_uom_batch?.product_uom?.product_id ?? cached?.product_uom?.product_id
        if (!productId) return

        const key = `${di}-${mi}`
        const productName =
          getProductUomName(cached?.product_uom_batch?.product_uom ?? cached?.product_uom) ||
          mergedMaterialLabels[key]?.split(/\s+[·—]\s+/)[0] ||
          `Material #${mi + 1}`

        const candidates = inventories.filter((i: any) => {
          const pid = i.product_uom_batch?.product_uom?.product_id ?? i.product_uom?.product_id
          return Number(pid) === Number(productId)
        })

        if (candidates.length === 1) {
          const match = candidates[0]
          setValue(`details.${di}.materials.${mi}.product_inventory_id` as any, match.id, {
            shouldValidate: true,
          })
          const uomCode =
            match.product_uom_batch?.product_uom?.uom?.code ?? match.product_uom?.uom?.code ?? ''
          setMaterialLabels((prev) => ({
            ...prev,
            [key]: `${productName} — ${uomCode} SKU: ${match.code ?? match.id}`,
          }))
          autoCount++
        } else {
          setValue(`details.${di}.materials.${mi}.product_inventory_id` as any, 0, {
            shouldValidate: true,
          })
          setMaterialLabels((prev) => ({ ...prev, [key]: productName }))
          if (candidates.length === 0) noStock.push(productName)
          else ambiguous.push(productName)
        }
      })
    })

    if (autoCount > 0) {
      toast.success(`${autoCount} material otomatis dipilih ulang sesuai dimensi baru`)
    }
    if (ambiguous.length > 0) {
      toast.warning(
        `Ditemukan lebih dari satu stok untuk: ${ambiguous.join(', ')}. Silakan pilih ulang inventory pada material tersebut.`
      )
    }
    if (noStock.length > 0) {
      toast.warning(
        `Stok tidak ditemukan di dimensi baru untuk: ${noStock.join(', ')}. Silakan pilih ulang inventory.`
      )
    }
  }, [inventories, isFetchingInventories, watchSourceOwnerRef, watchSourceStage, watchSourceLocationRef])

  const handleSelectMaterialInventory = useCallback(
    (detailIndex: number, matIndex: number, inv: any, productName: string) => {
      setValue(
        `details.${detailIndex}.materials.${matIndex}.product_inventory_id` as any,
        inv.id,
      )
      const displayName = getProductUomName(
        inv?.product_uom_batch?.product_uom ?? inv?.product_uom,
        productName,
      )
      const label = `${displayName} — ${inv.product_uom?.uom?.code ?? ''} SKU: ${inv.code ?? inv.id}`
      setMaterialLabels((prev) => ({ ...prev, [`${detailIndex}-${matIndex}`]: label }))
      // Clear "needs stock pick" flag for this material
      setNeedsStockPick((prev) => {
        const key = `${detailIndex}-${matIndex}`
        if (!prev[key]) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
      // Remember the product_uom_id for reactive auto-select on stage change
      const puid = Number(
        inv?.product_uom_batch?.product_uom_id ??
        inv?.product_uom?.product_uom_id ??
        inv?.product_uom_batch?.product_uom?.id ??
        inv?.product_uom?.id ??
        0,
      )
      if (puid > 0) {
        setMaterialProductUomIds((prev) => ({
          ...prev,
          [`${detailIndex}-${matIndex}`]: puid,
        }))
      }
    },
    [setValue],
  )

  const handleRemoveMaterial = useCallback(
    (detailIndex: number, matIndex: number) => {
      setMaterialLabels((prev) => {
        const next: Record<string, string> = {}
        Object.entries(prev).forEach(([key, value]) => {
          const [detail, material] = key.split('-').map(Number)
          if (detail !== detailIndex) {
            next[key] = value
          } else if (material < matIndex) {
            next[key] = value
          } else if (material > matIndex) {
            next[`${detail}-${material - 1}`] = value
          }
        })
        return next
      })
      setNeedsStockPick((prev) => {
        const next: Record<string, boolean> = {}
        Object.entries(prev).forEach(([key, value]) => {
          const [detail, material] = key.split('-').map(Number)
          if (detail !== detailIndex) {
            next[key] = value
          } else if (material < matIndex) {
            next[key] = value
          } else if (material > matIndex) {
            next[`${detail}-${material - 1}`] = value
          }
        })
        return next
      })
      setMaterialProductUomIds((prev) => {
        const next: Record<string, number> = {}
        Object.entries(prev).forEach(([key, value]) => {
          const [detail, material] = key.split('-').map(Number)
          if (detail !== detailIndex) {
            next[key] = value
          } else if (material < matIndex) {
            next[key] = value
          } else if (material > matIndex) {
            next[`${detail}-${material - 1}`] = value
          }
        })
        return next
      })
    },
    [],
  )

  // Reactive auto-select: when the source stage/owner changes (which refetches
  // `inventories` with new dimension filters), auto-select materials that have
  // exactly 1 matching stock — without requiring the user to open the picker.
  useEffect(() => {
    if (!inventories.length) return
    const details = (getValues('details') as any[]) ?? []
    const toSelect: Array<{ di: number; mi: number; inv: any }> = []
    const toFlag: string[] = []
    const toClear: string[] = []
    details.forEach((d: any, di: number) => {
      ;(d?.materials ?? []).forEach((m: any, mi: number) => {
        if (Number(m?.product_inventory_id) > 0) return
        const key = `${di}-${mi}`
        const puid = materialProductUomIds[key]
        if (!puid) return
        const matches = inventories.filter(
          (inv: any) =>
            Number(inv.product_uom_batch?.product_uom_id) === Number(puid),
        )
        if (matches.length === 1) {
          toSelect.push({ di, mi, inv: matches[0] })
        } else if (matches.length > 1) {
          toFlag.push(key)
        } else {
          toClear.push(key)
        }
      })
    })
    if (toSelect.length > 0) {
      toSelect.forEach(({ di, mi, inv }) => {
        setValue(
          `details.${di}.materials.${mi}.product_inventory_id` as any,
          inv.id,
        )
      })
    }
    if (toSelect.length > 0 || toFlag.length > 0 || toClear.length > 0) {
      setNeedsStockPick((prev) => {
        const next = { ...prev }
        toSelect.forEach(({ di, mi }) => { delete next[`${di}-${mi}`] })
        toClear.forEach((k) => { delete next[k] })
        toFlag.forEach((k) => { next[k] = true })
        return next
      })
    }
  }, [inventories, materialProductUomIds, getValues, setValue])

  const buildPayload = (values: FormValues) => ({
    date: values.date,
    status: values.status,
    description: values.description || undefined,
    source_owner_ref: values.source_owner_ref,
    source_stage: values.source_stage,
    source_location_ref: values.source_location_ref || 'GENERAL',
    output_owner_ref: values.output_owner_ref,
    output_stage: values.output_stage,
    output_location_ref: values.output_location_ref || 'GENERAL',
    details: (values.details ?? [])
      .map((d) => ({
        id: d.id,
        recipe_id: d.recipe_id,
        product_uom_id: d.product_uom_id,
        qty: d.qty,
        status: d.status,
        // Update only accepts planned_expiry_date; create accepts both, so
        // expiry_date is kept there for backward compatibility.
        planned_expiry_date: d.expiry_date || undefined,
        ...(mode === 'create' ? { expiry_date: d.expiry_date || undefined } : {}),
        planned_batch_code: d.planned_batch_code || undefined,
        description: d.description || undefined,
        owner_ref: d.owner_ref ?? undefined,
        stage: d.stage ?? undefined,
        location_ref: d.location_ref ?? undefined,
        materials: (d.materials ?? [])
          .map((m) => ({
            id: m.id,
            product_inventory_id: m.product_inventory_id,
            qty: m.qty,
            owner_ref: m.owner_ref ?? undefined,
            stage: m.stage ?? undefined,
            location_ref: m.location_ref ?? undefined,
          }))
          .filter((m) => m.product_inventory_id > 0),
      }))
      .filter((d) => d.product_uom_id > 0),
  })

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      productionsService.create(buildPayload(values) as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] })
      toast.success('Production created')
      router.push('/production')
    },
    onError: (error: any) =>
      toastMutationApiError(error, 'Failed to create production'),
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      productionsService.update(productionId!, buildPayload(values) as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] })
      queryClient.invalidateQueries({ queryKey: ['production', productionId] })
      queryClient.invalidateQueries({ queryKey: ['production-detail', productionId] })
      toast.success('Production updated')
      router.push(`/production/${productionId}/detail`)
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to update production'),
  })

  const validateProductionStock = (values: FormValues): string | null => {
    for (let dIndex = 0; dIndex < (values.details ?? []).length; dIndex++) {
      const d = values.details[dIndex]
      if (!d.product_uom_id || d.product_uom_id <= 0) {
        return `Item produksi #${dIndex + 1}: Produk output belum dipilih.`
      }
      // Materials are optional: a production can be created without any.
      const materials = d.materials ?? []
      for (let mIndex = 0; mIndex < materials.length; mIndex++) {
        const m = materials[mIndex]
        const labelKey = `${dIndex}-${mIndex}`
        const knownLabel = materialLabels[labelKey] || derivedMaterialLabels[labelKey]
        const label = knownLabel || `Material #${mIndex + 1}`

        // Edit: a saved material left unchanged was already validated (and its
        // stock may since have been consumed by this very production) — skip it.
        if (mode === 'edit' && m.id) {
          // Match by material id across all saved details — positions shift when an item is removed.
          const saved = (initialData?.details ?? [])
            .flatMap((x: any) => x?.materials ?? [])
            .find((x: any) => x.id === m.id)
          if (saved && Number(saved.product_inventory_id) === Number(m.product_inventory_id) && Number(saved.qty) === Number(m.qty)) continue
        }

        if (!m.product_inventory_id || m.product_inventory_id <= 0) {
          // An untouched blank row is skipped (buildPayload drops it too).
          if (!knownLabel && !needsStockPick[labelKey]) continue
          if (needsStockPick[labelKey]) {
            return `Pilih stok untuk ${label} (Item produksi #${dIndex + 1})`
          }
          return `Stok produk yang dibutuhkan belum ada di cabang ini: ${label} (Item produksi #${dIndex + 1})`
        }

        const inv = inventories.find((i: any) => i.id === m.product_inventory_id)
        if (!inv) {
          return `Data inventori untuk ${label} tidak ditemukan di cabang ini.`
        }

        // Required qty is in inv's own product_uom, so compare display_qty.
        const availableStock = Number(inv.display_qty ?? inv.stock ?? 0)
        const requiredQty = Number(m.qty ?? 0)

        if (availableStock <= 0) {
          return `Stok produk yang dibutuhkan habis: ${label} (Stok: 0, Dibutuhkan: ${requiredQty})`
        }
        if (availableStock < requiredQty) {
          return `Stok produk yang dibutuhkan tidak mencukupi: ${label} (Tersedia: ${availableStock}, Dibutuhkan: ${requiredQty})`
        }
      }
    }
    return null
  }

  const onSubmit = (values: FormValues) => {
    const stockError = validateProductionStock(values)
    if (stockError) {
      toast.error(stockError)
      return
    }
    if (mode === 'edit') {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const getFirstErrorMessage = (errors: any): string | undefined => {
    if (!errors || typeof errors !== 'object') return undefined
    if (typeof errors.message === 'string') return errors.message
    for (const key of Object.keys(errors)) {
      const msg = getFirstErrorMessage(errors[key])
      if (msg) return msg
    }
    return undefined
  }

  const onInvalid = (errors: any) => {

    toast.error(getFirstErrorMessage(errors) ?? 'Form tidak valid, periksa kembali data.')
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="v2-form" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1120 }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="v2-btn v2-btn-ghost" onClick={() => router.back()} aria-label="Back" style={{ width: 34, height: 34, padding: 0, justifyContent: 'center' }}>
          <ArrowLeft size={15} />
        </button>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 500,
              margin: 0,
              color: 'var(--foreground)',
            }}
          >
            {mode === 'edit' ? 'Edit Production' : 'New Production'}
          </h1>
          <p style={{ fontSize: 12.5, color: 'var(--foreground-muted)', margin: '2px 0 0' }}>
            {mode === 'edit'
              ? 'Update production order details'
              : 'Create a new factory production order'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--foreground-subtle)' }}>
          <span style={{ color: 'var(--destructive)' }}>*</span>
          <span>Required fields</span>
        </div>
        {/* Production Details + Dimensi Produksi share one row on wide screens */}
        <div className="prod-top-row">
          {/* Section 1 — Production Details */}
          <div style={sectionCardStyle}>
            <div style={sectionHeadStyle}>
              <span style={sectionTitleStyle}>Production Details</span>
            </div>

            <div
              className="v2-form-grid"
              style={{
                padding: 16,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 14,
              }}
            >

              {/* Date */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Production Date
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <input
                  type="date"
                  {...register('date')}
                  style={{
                    ...fieldInputStyle,
                    border: `1px solid ${errors.date ? 'var(--destructive)' : 'var(--border)'}`,
                  }}
                />
                {errors.date && (
                  <span style={{ fontSize: 11, color: 'var(--destructive)', marginTop: 3 }}>
                    {errors.date.message}
                  </span>
                )}
              </div>

              {/* Status */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Status
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['pending', 'final'] as const).map((s) => {
                        const isSel = field.value === s
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => field.onChange(s)}
                            style={{
                              height: 34,
                              padding: '0 16px',
                              borderRadius: 'var(--radius-md)',
                              fontSize: 13,
                              fontWeight: 500,
                              cursor: 'pointer',
                              border: isSel
                                ? s === 'final'
                                  ? '1px solid var(--success)'
                                  : '1px solid var(--warning)'
                                : '1px solid var(--border)',
                              background: isSel
                                ? s === 'final' ? 'var(--success-bg)' : 'var(--warning-bg)'
                                : 'var(--surface)',
                              color: isSel
                                ? s === 'final' ? 'var(--success)' : 'var(--warning)'
                                : 'var(--foreground-muted)',
                            }}
                          >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        )
                      })}
                    </div>
                  )}
                />
              </div>

              {/* Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Notes</label>
                <textarea
                  {...register('description')}
                  rows={2}
                  placeholder="Optional notes"
                  style={{
                    ...fieldInputStyle,
                    height: 'auto',
                    minHeight: 64,
                    padding: '8px 10px',
                    lineHeight: 1.5,
                    resize: 'vertical',
                    display: 'block',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 1b — Dimension Pickers */}
          <div style={sectionCardStyle}>
            <div style={sectionHeadStyle}>
              <span style={sectionTitleStyle}>Dimensi Produksi</span>
              <button
                type="button"
                className="alloc-toggle"
                aria-expanded={showAllocation}
                onClick={() => setShowAllocation((v) => !v)}
                title="Show Owner and Location"
              >
                <span className="v2-link">Allocation</span>
                {!showAllocation && (
                  <span className="alloc-summary">{hasCustomAllocation ? 'custom' : 'GENERAL'}</span>
                )}
                <ChevronDown size={14} style={{ transform: showAllocation ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }} />
              </button>
            </div>

            <div
              className="v2-form-grid"
              style={{
                padding: 16,
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                columnGap: 32,
                rowGap: 16,
              }}
            >
              {/* Konsumsi Dari */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="dim-side-head" data-side="source">Konsumsi Dari</span>
                {/* Stage stays full width on top; Allocation adds Owner + Lokasi below it. */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
                  <div style={{ display: showAllocation ? undefined : 'none', order: 1 }}>
                    <label style={{ ...labelStyle, textAlign: 'center' }}>
                      Owner <span style={{ color: 'var(--destructive)' }}>*</span>
                    </label>
                    <Controller
                      name="source_owner_ref"
                      control={control}
                      render={({ field }) => (
                        <SearchableSelect
                          value={field.value ?? 'GENERAL'}
                          onChange={field.onChange}
                          options={companyOptions}
                          placeholder="Pilih owner..."
                          searchPlaceholder="Cari perusahaan..."
                          loading={companiesLoading}
                          error={errors.source_owner_ref?.message as string | undefined}
                          onSearchChange={setDropdownSearch}
  />
                      )}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1', order: 0 }}>
                    <label style={{ ...labelStyle, textAlign: 'center' }}>
                      Stage <span style={{ color: 'var(--destructive)' }}>*</span>
                    </label>
                    <Controller
                      name="source_stage"
                      control={control}
                      render={({ field }) => (
                        <SearchableSelect
                          value={field.value ?? 'GENERAL'}
                          onChange={field.onChange}
                          options={stageOptions}
                          placeholder="Pilih stage..."
                          searchPlaceholder="Cari stage..."
                          loading={stagesLoading}
                          error={errors.source_stage?.message as string | undefined}
                          onSearchChange={setDropdownSearch}
  />
                      )}
                    />
                  </div>
                  <div style={{ display: showAllocation ? undefined : 'none', order: 2 }}>
                    <label style={{ ...labelStyle, textAlign: 'center' }}>Lokasi</label>
                    <input
                      type="text"
                      placeholder="GENERAL"
                      {...register('source_location_ref')}
                      style={fieldInputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Source → output direction marker */}
              <div className="dim-arrow" aria-hidden>
                <ArrowRight size={22} strokeWidth={1.75} />
              </div>

              {/* Output Ke */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="dim-side-head" data-side="output">Output Ke</span>
                {/* Stage stays full width on top; Allocation adds Owner + Lokasi below it. */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
                  <div style={{ display: showAllocation ? undefined : 'none', order: 1 }}>
                    <label style={{ ...labelStyle, textAlign: 'center' }}>
                      Owner <span style={{ color: 'var(--destructive)' }}>*</span>
                    </label>
                    <Controller
                      name="output_owner_ref"
                      control={control}
                      render={({ field }) => (
                        <SearchableSelect
                          value={field.value ?? 'GENERAL'}
                          onChange={field.onChange}
                          options={companyOptions}
                          placeholder="Pilih owner..."
                          searchPlaceholder="Cari perusahaan..."
                          loading={companiesLoading}
                          error={errors.output_owner_ref?.message as string | undefined}
                          onSearchChange={setDropdownSearch}
  />
                      )}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1', order: 0 }}>
                    <label style={{ ...labelStyle, textAlign: 'center' }}>
                      Stage <span style={{ color: 'var(--destructive)' }}>*</span>
                    </label>
                    <Controller
                      name="output_stage"
                      control={control}
                      render={({ field }) => (
                        <SearchableSelect
                          value={field.value ?? 'GENERAL'}
                          onChange={field.onChange}
                          options={stageOptions}
                          placeholder="Pilih stage..."
                          searchPlaceholder="Cari stage..."
                          loading={stagesLoading}
                          error={errors.output_stage?.message as string | undefined}
                          onSearchChange={setDropdownSearch}
  />
                      )}
                    />
                  </div>
                  <div style={{ display: showAllocation ? undefined : 'none', order: 2 }}>
                    <label style={{ ...labelStyle, textAlign: 'center' }}>Lokasi</label>
                    <input
                      type="text"
                      placeholder="GENERAL"
                      {...register('output_location_ref')}
                      style={fieldInputStyle}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2 — Production Items */}
        <div style={sectionCardStyle}>
          <div style={sectionHeadStyle}>
            <span style={sectionTitleStyle}>Production Items</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="alloc-toggle"
              aria-expanded={showItemAllocation}
              onClick={() => setShowItemAllocation((v) => !v)}
              title="Show Output Owner and Output Location on each item"
            >
              <span className="v2-link">Allocation</span>
              {!showItemAllocation && (
                <span className="alloc-summary">{hasCustomItemAllocation ? 'custom' : 'GENERAL'}</span>
              )}
              <ChevronDown size={14} style={{ transform: showItemAllocation ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }} />
            </button>
            <button type="button" className="v2-btn v2-btn-outline" onClick={handleAddDetail} style={{ height: 30 }}>
              <Plus size={13} />
              Add Item
              <kbd style={{ fontSize: 10, fontWeight: 500, color: 'var(--foreground-subtle)', background: 'var(--surface-muted, var(--background))', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)', fontFamily: 'var(--font-sans)' }}>
                Ctrl+B
              </kbd>
            </button>
            </div>
          </div>

          {detailFields.length > 0 && (
            <div
              style={{
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface-muted, var(--background))',
              }}
            >
              <span style={{ ...sectionHeaderStyle, minWidth: 20, textAlign: 'center' }}>#</span>
              <span style={{ width: 22, flexShrink: 0 }} />
              <span style={{ ...sectionHeaderStyle, flex: 1 }}>Produk</span>
              <span style={{ ...sectionHeaderStyle, width: 90 }}>Qty</span>
              <span style={{ ...sectionHeaderStyle, width: 112 }}>Status</span>
              <span style={{ width: 26 }} />
            </div>
          )}

          <div style={{ padding: 0, borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}>
            {detailFields.map((field, detailIndex) => {
              const isExpanded = expandedDetails.includes(detailIndex)
              return (
                <div
                  key={field.id}
                  data-prod-detail-index={detailIndex}
                  // No bottom border on the last item: the card's own rounded border closes it.
                  style={{ borderBottom: detailIndex < detailFields.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  {/* Detail header row */}
                  <div
                    style={{
                      padding: '14px 16px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'transparent',
                    }}
                  >
                    {/* Item Number */}
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'var(--foreground-muted)',
                        minWidth: 20,
                        textAlign: 'center',
                      }}
                    >
                      #{detailIndex + 1}
                    </span>

                    {/* Expand icon */}
                    <div
                      onClick={() => toggleDetail(detailIndex)}
                      style={{
                        width: 22,
                        height: 22,
                        background: 'var(--surface-muted, var(--background))',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        cursor: 'pointer',
                      }}
                    >
                      {isExpanded ? (
                        <ChevronUp size={12} style={{ color: 'var(--foreground-muted)' }} />
                      ) : (
                        <ChevronDown size={12} style={{ color: 'var(--foreground-muted)' }} />
                      )}
                    </div>

                    {/* Finished product picker */}
                    <div
                      style={{ flex: 1 }}
                      onClick={(e) => e.stopPropagation()}
                      data-prod-item-search
                    >
                      {(() => {
                        const isActive = activeDetailIndex === detailIndex
                        // Derive the label for the current detail if not searching
                        let displayValue = detailLabels[detailIndex] ?? 'Select finished product...'
                        const currentProductUomId = watchDetails[detailIndex]?.product_uom_id
                        
                        // If it's loaded from initial data but no local label is set yet, attempt to find a name from prodItemUoms if we have it, or leave as placeholder
                        // Actually initialData mapping or form default doesn't have the label natively without joining. We can fetch it if needed, but for now we rely on user interaction or pre-filled labels if any.

                        return (
                          <div style={{ position: 'relative', width: '100%', zIndex: isActive ? 200 : 10 }}>
                            <input
                              type="text"
                              value={isActive ? sharedProductSearch : displayValue}
                              onChange={(e) => {
                                setActiveDetailIndex(detailIndex)
                                setSharedProductSearch(e.target.value)
                                setSharedShowUomPicker(false)
                                setSharedSelectedProductId(null)
                              }}
                              onFocus={() => {
                                setActiveDetailIndex(detailIndex)
                                if (!sharedShowUomPicker) {
                                  setSharedSelectedProductId(null)
                                }
                              }}
                              placeholder="Search finished product..."
                              style={{
                                width: '100%',
                                height: 34,
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                padding: '0 10px',
                                fontSize: 13,
                                color: 'var(--foreground)',
                                background: 'var(--surface-raised)',
                                boxSizing: 'border-box',
                                fontFamily: 'var(--font-sans)',
                              }}
                            />

                            {/* Dropdown 1: Product list */}
                            {isActive && sharedProductSearch.length >= 2 && !sharedShowUomPicker && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  width: '100%',
                                  background: 'var(--surface-raised)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-md)',
                                  boxShadow: 'var(--shadow-lg)',
                                  maxHeight: 220,
                                  overflowY: 'auto',
                                  zIndex: 300,
                                }}
                              >
                                {isSearchingProdItems ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                    Looking for products…
                                  </div>
                                ) : prodItemProducts.length === 0 && (
                                  <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                                    No products found
                                  </div>
                                )}
                                {!isSearchingProdItems && prodItemProducts.map((p: any) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault()
                                      setSharedSelectedProductId(p.id)
                                      setSharedSelectedProductName(p.name)
                                      setSharedShowUomPicker(true)
                                      setSharedProductSearch('')
                                    }}
                                    style={{
                                      width: '100%',
                                      textAlign: 'left',
                                      padding: '9px 12px',
                                      background: 'transparent',
                                      border: 'none',
                                      borderBottom: '1px solid var(--border)',
                                      cursor: 'pointer',
                                      fontSize: 13,
                                      fontWeight: 500,
                                      color: 'var(--foreground)'
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                  >
                                    {withProductType(p.name, p.type)}
                                    <span style={{ fontSize: 11, color: 'var(--foreground-muted)', marginLeft: 8 }}>
                                      {p.code}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Dropdown 2: UOM list */}
                            {isActive && sharedShowUomPicker && sharedSelectedProductId && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  width: '100%',
                                  background: 'var(--surface-raised)',
                                  border: '1px solid var(--accent-light)',
                                  borderRadius: 'var(--radius-md)',
                                  boxShadow: 'var(--shadow-lg)',
                                  padding: 10,
                                  zIndex: 300,
                                }}
                              >
                                <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginBottom: 8 }}>
                                  Select UOM for <strong>{sharedSelectedProductName}</strong>:
                                </div>
                                {isFetchingProdItemUoms ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--foreground-muted)' }}>
                                    <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                                    Looking for units…
                                  </div>
                                ) : prodItemUoms.length === 0 && (
                                  <div style={{ fontSize: 12, color: 'var(--destructive)' }}>
                                    No UOM found for this product.
                                  </div>
                                )}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {prodItemUoms.map((pu: any) => (
                                    <button
                                      key={pu.id}
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault()
                                        setValue(`details.${detailIndex}.product_uom_id` as any, pu.id)
                                        setDetailLabels((prev) => ({
                                          ...prev,
                                          [detailIndex]: `${sharedSelectedProductName} — ${pu.uom?.code ?? 'UOM'}`,
                                        }))
                                        setSharedShowUomPicker(false)
                                        setSharedSelectedProductId(null)
                                        setSharedSelectedProductName('')
                                        setActiveDetailIndex(null)
                                      }}
                                      style={{
                                        padding: '5px 10px',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'var(--surface)',
                                        color: 'var(--foreground)',
                                        fontSize: 12,
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {pu.uom?.code ?? 'UOM'}
                                      <span style={{ color: 'var(--foreground-muted)', marginLeft: 6 }}>
                                        {pu.code ?? ''}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSharedShowUomPicker(false)
                                    setSharedSelectedProductId(null)
                                    setSharedSelectedProductName('')
                                  }}
                                  style={{
                                    marginTop: 8,
                                    fontSize: 11,
                                    color: 'var(--foreground-muted)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                  }}
                                >
                                  ← Back
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>

                    {/* Qty */}
                    <div
                      style={{ width: 90 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(() => {
                        const reg = register(`details.${detailIndex}.qty` as any, {
                          valueAsNumber: true,
                        })
                        return (
                          <input
                            type="number"
                            min={0.001}
                            step={0.001}
                            {...reg}
                            onChange={(e) => {
                              reg.onChange(e)
                              const newQty = parseFloat(e.target.value) || 0
                              const currentMaterials = watchDetails[detailIndex]?.materials || []
                              currentMaterials.forEach((m: any, mIdx: number) => {
                                if (m.base_ratio !== undefined) {
                                  const newMatQty = m.base_ratio * newQty
                                  setValue(
                                    `details.${detailIndex}.materials.${mIdx}.qty` as any,
                                    Number(newMatQty.toFixed(4))
                                  )
                                }
                              })
                            }}
                            placeholder="Qty"
                            style={{ ...fieldInputStyle, textAlign: 'right' }}
                          />
                        )
                      })()}
                    </div>

                    {/* Per-detail status */}
                    <div onClick={(e) => e.stopPropagation()} style={{ width: 112 }}>
                      <Controller
                        name={`details.${detailIndex}.status` as any}
                        control={control}
                        render={({ field: f }) => (
                          <div style={{ display: 'flex', gap: 2, padding: 2, height: 34, boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface-muted, var(--background))' }}>
                            {(['pending', 'final'] as const).map((s) => {
                              const isSel = f.value === s
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => f.onChange(s)}
                                  style={{
                                    flex: 1,
                                    fontSize: 11.5,
                                    fontWeight: 500,
                                    borderRadius: 6,
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: isSel
                                      ? s === 'final' ? 'var(--success-bg)' : 'var(--warning-bg)'
                                      : 'transparent',
                                    color: isSel
                                      ? s === 'final' ? 'var(--success)' : 'var(--warning)'
                                      : 'var(--foreground-subtle)',
                                  }}
                                >
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      />
                    </div>

                    {/* Delete detail */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeDetail(detailIndex)
                      }}
                      disabled={detailFields.length === 1}
                      className="v2-icon-btn"
                      data-tone="danger"
                      style={{
                        padding: 0,
                        width: 26,
                        height: 26,
                        justifyContent: 'center',
                        background: 'none',
                        border: 'none',
                        cursor: detailFields.length === 1 ? 'not-allowed' : 'pointer',
                        color:
                          detailFields.length === 1
                            ? 'var(--border)'
                            : 'var(--destructive)',
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Detail expanded body */}
                  {isExpanded && (
                    <div
                      className="item-body"
                      style={{
                        // Left edge lines up with the product selector in the row above
                        // (16 padding + 20 index + 8 gap + 22 expander + 8 gap).
                        padding: '4px 16px 16px 74px',
                        background: 'transparent',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                      }}
                    >
                      {/* Batch + Expiry + description row */}
                      <div
                        className="v2-form-grid"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label style={labelStyle}>Batch Code</label>
                          <input
                            {...register(`details.${detailIndex}.planned_batch_code` as any)}
                            placeholder="Optional batch"
                            style={fieldInputStyle}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label style={labelStyle}>Expiry Date</label>
                          <input
                            type="date"
                            {...register(`details.${detailIndex}.expiry_date` as any)}
                            style={fieldInputStyle}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label style={labelStyle}>Note</label>
                          <input
                            {...register(`details.${detailIndex}.description` as any)}
                            placeholder="Optional note"
                            style={fieldInputStyle}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label style={labelStyle}>Output Stage</label>
                          <Controller
                            name={`details.${detailIndex}.stage` as any}
                            control={control}
                            render={({ field }) => (
                              <SearchableSelect
                                value={field.value ?? ''}
                                onChange={(v) => field.onChange(v || null)}
                                options={[{ value: 'GENERAL', label: 'General' }, ...stageOptions.filter(o => o.value !== 'GENERAL')]}
                                placeholder="Ikuti header..."
                                searchPlaceholder="Cari stage..."
                              />
                            )}
                          />
                        </div>
                      </div>

                      {/* Per-detail Owner + Location overrides (item Allocation) */}
                      <div
                        className="v2-form-grid"
                        style={{
                          display: showItemAllocation ? 'grid' : 'none',
                          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label style={labelStyle}>Output Owner</label>
                          <Controller
                            name={`details.${detailIndex}.owner_ref` as any}
                            control={control}
                            render={({ field }) => (
                              <SearchableSelect
                                value={field.value ?? ''}
                                onChange={(v) => field.onChange(v || null)}
                                options={[{ value: 'GENERAL', label: 'General' }, ...companyOptions.filter(o => o.value !== 'GENERAL')]}
                                placeholder="Ikuti header..."
                                searchPlaceholder="Cari owner..."
                              />
                            )}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label style={labelStyle}>Output Location</label>
                          <Controller
                            name={`details.${detailIndex}.location_ref` as any}
                            control={control}
                            render={({ field }) => (
                              <SearchableSelect
                                value={field.value ?? ''}
                                onChange={(v) => field.onChange(v || null)}
                                options={[{ value: 'GENERAL', label: 'General' }]}
                                placeholder="Ikuti header..."
                                searchPlaceholder="Cari lokasi..."
                              />
                            )}
                          />
                        </div>
                      </div>

                      {/* Materials */}
                      <MaterialsFieldArray
                        key={`materials-${detailIndex}-${watchDetails[detailIndex]?.materials?.length ?? 0}`}
                        control={control}
                        detailIndex={detailIndex}
                        register={register}
                        inventories={inventories}
                        errors={errors}
                        onLoadFromRecipe={handleLoadFromRecipe}
                        isLoadingRecipe={loadingRecipeFor === detailIndex}
                        onSelectMaterialInventory={handleSelectMaterialInventory}
                        onRemoveMaterial={handleRemoveMaterial}
                        materialLabels={mergedMaterialLabels}
                        needsStockPick={needsStockPick}
                        materialProductUomIds={materialProductUomIds}
                        setValue={setValue}
                        companyOptions={companyOptions}
                        stageOptions={stageOptions}
                        ownerFilter={effectiveOwnerFilter}
                        stagesFilter={effectiveStagesFilter}
                      />
                    </div>
                  )}
                </div>
              )
            })}

            {errors.details &&
              typeof (errors.details as any).message === 'string' && (
                <div style={{ padding: '8px 20px' }}>
                  <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                    {(errors.details as any).message}
                  </span>
                </div>
              )}
          </div>
        </div>

        {/* Form actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            paddingTop: 2,
          }}
        >
          <button type="button" className="v2-btn v2-btn-ghost" onClick={() => router.back()} style={{ height: 36, padding: '0 18px' }}>
            Cancel
          </button>
          <button type="submit" className="v2-btn v2-btn-primary" disabled={isPending} style={{ height: 36, padding: '0 18px' }}>
            {isPending ? (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Save size={14} />
            )}
            {mode === 'edit'
              ? isPending ? 'Saving...' : 'Save Changes'
              : isPending ? 'Creating...' : 'Create Production'}
          </button>
        </div>
      </form>

      <style>{`
        /* Shared dropdowns match the 34px inputs of this form. */
        .prod-top-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start; }
        @media (max-width: 1100px) { .prod-top-row { grid-template-columns: minmax(0, 1fr); } }
        .v2-form .ss-trigger { min-height: 34px; padding: 0 10px !important; font-size: 13px !important; }
        /* Side headers: tinted chips so "from" and "to" read as headings. */
        .dim-side-head {
          align-self: center; margin-bottom: 6px; padding: 4px 12px; border-radius: 999px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
        }
        .dim-side-head[data-side="source"] { color: var(--accent); background: var(--accent-light-bg); border: 1px solid rgba(198, 139, 78, 0.3); }
        .dim-side-head[data-side="output"] { color: var(--success); background: var(--success-bg); border: 1px solid rgba(28, 148, 102, 0.25); }
        /* Plain direction marker (not a button): no fill, no border. */
        .dim-arrow {
          align-self: center; display: inline-flex; align-items: center; justify-content: center;
          color: var(--accent-light);
        }
        @media (max-width: 700px) {
          .dim-arrow { justify-self: center; transform: rotate(90deg); }
        }
        .alloc-toggle {
          display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 6px 0 8px;
          border: none; border-radius: 6px; background: none; cursor: pointer;
          font-size: 12px; font-family: var(--font-sans); color: var(--accent);
          transition: background 150ms ease;
        }
        .alloc-toggle:hover { background: var(--surface-muted, var(--background)); }
        .alloc-summary {
          font-size: 10.5px; font-weight: 500; padding: 1px 6px; border-radius: 999px;
          color: var(--foreground-muted); background: var(--surface-muted, var(--background)); border: 1px solid var(--border);
        }
        @media (max-width: 700px) {
          .v2-form .v2-form-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .v2-form .item-body { padding-left: 16px !important; }
          .v2-form .mat-table { overflow-x: auto; }
          .v2-form .mat-row { min-width: 620px; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
