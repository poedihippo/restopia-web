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
import { useActiveBranchProductTypes } from '@/hooks/useProductTypes'
import { companiesService } from '@/services/companies.service'
import {
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  Save,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'

const GENERAL_OWNER_OPTION = { value: 'GENERAL', label: 'Umum (GENERAL)' }

// ── Schemas ──────────────────────────────────────────────────────────────────

const materialSchema = z.object({
  product_inventory_id: z.coerce.number().min(0),
  qty: z.coerce.number().min(0.001),
  base_ratio: z.number().optional(),
})

const detailSchema = z.object({
  product_uom_id: z.coerce.number().min(0, 'Product required'),
  qty: z.coerce.number().min(0.001, 'Qty required'),
  status: z.enum(['pending', 'final']),
  expiry_date: z.string().optional(),
  planned_batch_code: z.string().optional(),
  description: z.string().optional(),
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
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const fieldInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  color: 'var(--foreground)',
  background: 'var(--surface)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--foreground)',
  marginBottom: 4,
  display: 'block',
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
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

// ── MaterialsFieldArray ───────────────────────────────────────────────────────

interface MaterialsFieldArrayProps {
  control: any
  detailIndex: number
  register: any
  inventories: any[]
  errors: any
  onLoadFromRecipe: (index: number) => void
  isLoadingRecipe: boolean
  // material search props
  activeMaterialIndex: { detail: number; mat: number } | null
  sharedMaterialSearch: string
  sharedMaterialSearchDebounced: string
  sharedMaterialProductId: number | null
  sharedMaterialProductName: string
  sharedShowMaterialUomPicker: boolean
  materialProducts: any[]
  materialInventories: any[]
  setActiveMaterialIndex: (v: { detail: number; mat: number } | null) => void
  setSharedMaterialSearch: (v: string) => void
  setSharedMaterialProductId: (v: number | null) => void
  setSharedMaterialProductName: (v: string) => void
  setSharedShowMaterialUomPicker: (v: boolean) => void
  onSelectMaterialInventory: (detailIndex: number, matIndex: number, inv: any, productName: string) => void
  materialLabels: Record<string, string>
  setValue: any
  onMaterialQtyEdit?: (detailIndex: number, matIndex: number, qty: number) => void
}

export function MaterialsFieldArray({
  control,
  detailIndex,
  register,
  errors,
  onLoadFromRecipe,
  onMaterialQtyEdit,
  isLoadingRecipe,
  activeMaterialIndex,
  sharedMaterialSearch,
  sharedMaterialSearchDebounced,
  sharedMaterialProductId,
  sharedMaterialProductName,
  sharedShowMaterialUomPicker,
  materialProducts,
  materialInventories,
  setActiveMaterialIndex,
  setSharedMaterialSearch,
  setSharedMaterialProductId,
  setSharedMaterialProductName,
  setSharedShowMaterialUomPicker,
  onSelectMaterialInventory,
  materialLabels,
  setValue,
}: MaterialsFieldArrayProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `details.${detailIndex}.materials` as any,
  })

  const watchedMaterials = useWatch({
    control,
    name: `details.${detailIndex}.materials`
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={sectionHeaderStyle}>Raw Materials</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => onLoadFromRecipe(detailIndex)}
            disabled={isLoadingRecipe}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              background: 'var(--accent-light-bg)',
              color: 'var(--accent)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 11,
              fontWeight: 500,
              cursor: isLoadingRecipe ? 'not-allowed' : 'pointer',
              opacity: isLoadingRecipe ? 0.7 : 1,
            }}
          >
            {isLoadingRecipe ? (
              <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <BookOpen size={11} />
            )}
            {isLoadingRecipe ? 'Loading...' : 'Load from Recipe'}
          </button>
          <button
            type="button"
            onClick={() => append({ product_inventory_id: 0, qty: 1 })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              background: 'var(--surface)',
              color: 'var(--foreground-muted)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            <Plus size={11} />
            Add Material
          </button>
        </div>
      </div>

      {/* Rows */}
      {fields.map((field, matIndex) => {
        const isActive =
          activeMaterialIndex?.detail === detailIndex &&
          activeMaterialIndex?.mat === matIndex
        const labelKey = `${detailIndex}-${matIndex}`
        const existingLabel =
          materialLabels[labelKey] ?? `Material #${matIndex + 1}`

        return (
          <div
            key={field.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 120px 32px',
              gap: 8,
              alignItems: 'start',
            }}
          >
            {/* Material search input + pickers */}
            <div style={{ position: 'relative', zIndex: 10 }} data-material-row>
              <input
                type="text"
                value={isActive ? sharedMaterialSearch : existingLabel}
                onChange={(e) => {
                  setActiveMaterialIndex({ detail: detailIndex, mat: matIndex })
                  setSharedMaterialSearch(e.target.value)
                  setSharedShowMaterialUomPicker(false)
                  setSharedMaterialProductId(null)
                }}
                onFocus={() => {
                  setActiveMaterialIndex({ detail: detailIndex, mat: matIndex })
                  if (!sharedShowMaterialUomPicker) {
                    setSharedMaterialProductId(null)
                  }
                }}
                placeholder="Search ingredient..."
                style={{
                  width: '100%',
                  height: 34,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0 10px',
                  fontSize: 12,
                  color: 'var(--foreground)',
                  background: 'var(--surface)',
                  boxSizing: 'border-box',
                  fontFamily: 'var(--font-sans)',
                }}
              />

              {isActive && sharedMaterialSearch.length >= 2 && !sharedShowMaterialUomPicker && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    width: '100%',
                    zIndex: 200,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    maxHeight: 200,
                    overflowY: 'auto',
                  }}
                >
                  {materialProducts.length === 0 && (
                    <p style={{ padding: '10px 12px', fontSize: 12, color: 'var(--foreground-muted)', margin: 0 }}>
                      No products found
                    </p>
                  )}
                  {materialProducts.map((p: any) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSharedMaterialProductId(p.id)
                        setSharedMaterialProductName(p.name)
                        setSharedShowMaterialUomPicker(true)
                        setSharedMaterialSearch('')
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border)',
                        fontSize: 12,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                    >
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span style={{ color: 'var(--foreground-muted)', marginLeft: 6, fontSize: 11 }}>
                        {p.code} · {p.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {isActive && sharedShowMaterialUomPicker && sharedMaterialProductId && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    width: '100%',
                    zIndex: 200,
                    background: 'var(--surface)',
                    border: '1px solid var(--accent-light)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    padding: 10,
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginBottom: 8 }}>
                    Select inventory for <strong>{sharedMaterialProductName}</strong>:
                  </div>
                  {materialInventories.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--destructive)', margin: 0 }}>
                      No active inventory found for this product.
                    </p>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {materialInventories.map((inv: any) => (
                      <button
                        key={inv.id}
                        type="button"
                        onClick={() => {
                          onSelectMaterialInventory(detailIndex, matIndex, inv, sharedMaterialProductName)
                          setSharedShowMaterialUomPicker(false)
                          setSharedMaterialProductId(null)
                          setSharedMaterialProductName('')
                          setActiveMaterialIndex(null)
                        }}
                        style={{
                          padding: '5px 10px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface)',
                          color: 'var(--foreground)',
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        {inv.product_uom?.uom?.code ?? 'UOM'} — SKU: {inv.code ?? inv.id}
                        <span style={{ color: 'var(--foreground-muted)', marginLeft: 4 }}>
                          Stock: {inv.qty ?? 0}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSharedShowMaterialUomPicker(false)
                      setSharedMaterialProductId(null)
                      setSharedMaterialProductName('')
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
                  style={{
                    padding: '7px 10px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                    outline: 'none',
                    width: '100%',
                    color: 'var(--foreground)',
                    background: 'var(--surface)',
                    fontFamily: 'var(--font-sans)',
                    boxSizing: 'border-box',
                  }}
                />
              )
            })()}

            <div style={{ position: 'relative', zIndex: 20, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => remove(matIndex)}
                disabled={fields.length === 1}
                style={{
                  padding: 5,
                  background: 'none',
                  border: 'none',
                  cursor: fields.length === 1 ? 'not-allowed' : 'pointer',
                  color: fields.length === 1 ? 'var(--border)' : 'var(--destructive)',
                  display: 'flex',
                  alignItems: 'center',
                  marginTop: 2,
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProductionForm({
  mode,
  initialData,
  productionId,
  initialMaterialLabels,
}: ProductionFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const activeBranchId = user?.branch?.id
  const activeProductTypes = useActiveBranchProductTypes()

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

  // ── Material two-step search ───────────────────────────────────────────────
  const [activeMaterialIndex, setActiveMaterialIndex] = useState<{ detail: number; mat: number } | null>(null)
  const [sharedMaterialSearch, setSharedMaterialSearch] = useState('')
  const [sharedMaterialSearchDebounced, setSharedMaterialSearchDebounced] = useState('')
  const [sharedMaterialProductId, setSharedMaterialProductId] = useState<number | null>(null)
  const [sharedMaterialProductName, setSharedMaterialProductName] = useState('')
  const [sharedShowMaterialUomPicker, setSharedShowMaterialUomPicker] = useState(false)
  // label per detail+mat key
  const [materialLabels, setMaterialLabels] = useState<Record<string, string>>({})

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
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
          materials: [{ product_inventory_id: 0, qty: 1 }],
        },
      ],
    },
  })

  const { fields: detailFields, append: appendDetail, remove: removeDetail } =
    useFieldArray({ control, name: 'details' })

  const watchDetails = watch('details')

  // Debounce effects
  useEffect(() => {
    const t = setTimeout(() => setSharedProductSearchDebounced(sharedProductSearch), 400)
    return () => clearTimeout(t)
  }, [sharedProductSearch])

  useEffect(() => {
    const t = setTimeout(() => setSharedMaterialSearchDebounced(sharedMaterialSearch), 400)
    return () => clearTimeout(t)
  }, [sharedMaterialSearch])

  // Click-outside handler — close both dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-prod-item-search]')) {
        if (!sharedShowUomPicker) {
          setActiveDetailIndex(null)
          setSharedProductSearch('')
        }
      }
      if (!target.closest('[data-material-row]')) {
        if (!sharedShowMaterialUomPicker) {
          setActiveMaterialIndex(null)
          setSharedMaterialSearch('')
        }
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [sharedShowUomPicker, sharedShowMaterialUomPicker])

  // Queries

  // Dimension pickers: owner (company) + stage
  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies-all'],
    queryFn: () => companiesService.list({ per_page: 100 } as any).then((r) => r.data),
  })
  const companies: { id: number; name: string }[] = (companiesData as any)?.data ?? []
  const companyOptions = [
    GENERAL_OWNER_OPTION,
    ...companies.map((c) => ({ value: String(c.id), label: c.name })),
  ]

  const { data: stagesData, isLoading: stagesLoading } = useQuery({
    queryKey: ['stages-all'],
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
  const { data: prodItemData } = useQuery({
    queryKey: ['prod-item-product-search', sharedProductSearchDebounced, activeProductTypes],
    enabled: sharedProductSearchDebounced.length >= 2,
    queryFn: () =>
      api
        .get('/products', {
          params: {
            per_page: 500,
            'filter[product_types]': 'final',
            'filter[search]': sharedProductSearchDebounced,
            sort: 'name',
          },
        })
        .then((r) => r.data),
  })
  const prodItemProducts = unwrapList(prodItemData)

  // UOMs for selected finished product (Step 2)
  const { data: prodItemUomData } = useQuery({
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

  const { data: inventoriesData } = useQuery({
    queryKey: ['product-inventories-all', activeBranchId],
    enabled: !!activeBranchId,
    queryFn: async () => {
      let allInventories: any[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await productInventoriesService
          .list({
            page,
            per_page: 100,
            include:
              'branch,product_uom_batch,product_uom_batch.product_uom,product_uom_batch.product_uom.product,product_uom_batch.product_uom.uom',
            'filter[branch_id]': activeBranchId,
          } as any)
          .then((r) => r.data)
        const items = (res as any)?.data ?? []
        allInventories = allInventories.concat(items)
        totalPages =
          (res as any)?.meta?.last_page ??
          (res as any)?.meta?.total_pages ??
          1
        page += 1
      } while (page <= totalPages)
      return { data: allInventories }
    },
  })
  const inventories = (inventoriesData as any)?.data ?? []

  // Material product search
  const { data: prodMaterialData } = useQuery({
    queryKey: ['prod-material-search', sharedMaterialSearchDebounced, activeProductTypes],
    enabled: sharedMaterialSearchDebounced.length >= 2,
    queryFn: () =>
      api
        .get('/products', {
          params: {
            per_page: 500,
            'filter[product_types]': activeProductTypes,
            sort: 'name',
            'filter[search]': sharedMaterialSearchDebounced,
          },
        })
        .then((r) => r.data),
  })
  const materialProducts = unwrapList(prodMaterialData)

  // Inventories for selected material product
  const { data: prodMaterialInvData } = useQuery({
    queryKey: ['prod-material-inventories', sharedMaterialProductId],
    enabled: !!sharedMaterialProductId,
    queryFn: () =>
      api
        .get('/product-inventories', {
          params: {
            per_page: 500,
            include: 'product_uom_batch',
            'filter[status]': 'active',
          },
        })
        .then((r) => r.data),
  })
  const allMaterialInventories = unwrapList(prodMaterialInvData)
  const materialInventories = allMaterialInventories.filter(
    (inv: any) =>
      inv.product_uom?.product_id === sharedMaterialProductId ||
      inv.product_uom_batch?.product_uom?.product_id === sharedMaterialProductId
  )
  console.log('all material inv:', allMaterialInventories);
  console.log('material inv:', materialInventories);

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
    }
  }, [mode, initialData, reset])

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

        // Accumulate identical materials
        const groupedMaterials: Record<number, any> = {}
        rawMaterials.forEach((mat: any) => {
          const id = mat.product_uom_id
          if (!groupedMaterials[id]) {
            groupedMaterials[id] = { ...mat, qty: 0 }
          }
          groupedMaterials[id].qty += Number(mat.qty) || 0
        })
        const materials = Object.values(groupedMaterials)

        const recipeQty = Number(recipe.qty) || 1
        const prodQty = recipeQty // override with recipe's yield qty
        setValue(`details.${detailIndex}.qty` as any, prodQty)
        const missing: string[] = []
        const mappedMaterials = materials.map((mat: any) => {
          const matches = inventories.filter(
            (inv: any) =>
              inv.product_uom_batch?.product_uom_id === mat.product_uom_id
          )
          const sorted = matches.slice().sort((a: any, b: any) => {
            // Prefer rows with stock > 0
            const aHasStock = Number(a.stock) > 0 ? 1 : 0
            const bHasStock = Number(b.stock) > 0 ? 1 : 0
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
          const match = sorted[0]
          if (!match) {
            missing.push(
              mat.product_uom?.product?.name ??
              String(mat.product_uom?.product_id ?? '?')
            )
          }
          const qty = Number(mat.qty) || 0
          return {
            product_inventory_id: match?.id ?? 0,
            qty: qty,
            base_ratio: recipeQty > 0 ? qty / recipeQty : 0,
          }
        })
        // All-or-nothing: if any material lacks inventory at this branch,
        // abort instead of silently shipping product_inventory_id: 0 rows.
        if (missing.length > 0) {
          toast.error(
            `Cannot load recipe — materials missing inventory at this branch: ${missing.join(', ')}`
          )
          return
        }
        const labels: Record<string, string> = {}
        materials.forEach((m: any, idx: number) => {
          const productName =
            m.product_uom?.product?.name ?? String(m.product_uom?.product_id ?? '?')
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
        setValue(
          `details.${detailIndex}.materials`,
          mappedMaterials.length > 0
            ? mappedMaterials
            : [{ product_inventory_id: 0, qty: 1 }]
        )
        toast.success(`Loaded ${materials.length} material(s) from recipe`)
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
            inv?.product_uom_batch?.product_uom?.product?.name ??
            inv?.product_uom?.product?.name ??
            inv?.code ??
            `Material #${id}`
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

  const handleSelectMaterialInventory = useCallback(
    (detailIndex: number, matIndex: number, inv: any, productName: string) => {
      setValue(
        `details.${detailIndex}.materials.${matIndex}.product_inventory_id` as any,
        inv.id,
      )
      const label = `${productName} — ${inv.product_uom?.uom?.code ?? ''} SKU: ${inv.code ?? inv.id}`
      setMaterialLabels((prev) => ({ ...prev, [`${detailIndex}-${matIndex}`]: label }))
    },
    [setValue],
  )

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
        product_uom_id: d.product_uom_id,
        qty: d.qty,
        status: d.status,
        expiry_date: d.expiry_date || undefined,
        planned_batch_code: d.planned_batch_code || undefined,
        description: d.description || undefined,
        materials: (d.materials ?? [])
          .map((m) => ({
            product_inventory_id: m.product_inventory_id,
            qty: m.qty,
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
      toast.success('Production updated')
      router.push(`/production/${productionId}/detail`)
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to update production'),
  })

  const onSubmit = (values: FormValues) => {
    if (mode === 'edit') {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const onInvalid = (_errors: any) => { }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1000 }}>

      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingBottom: 20,
          borderBottom: '1px solid var(--border)',
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
            cursor: 'pointer',
            color: 'var(--foreground-muted)',
          }}
        >
          <ArrowLeft size={14} />
          Back
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
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '2px 0 0' }}>
            {mode === 'edit'
              ? 'Update production order details'
              : 'Create a new factory production order'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--foreground-subtle)' }}>
          <span style={{ color: 'var(--destructive)' }}>*</span>
          <span>Required fields</span>
        </div>
        {/* Section 1 — Production Details */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'visible',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--background)',
            }}
          >
            <span style={sectionHeaderStyle}>Production Details</span>
          </div>

          <div
            style={{
              padding: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16,
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
                            padding: '6px 14px',
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
            <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
              <label style={labelStyle}>Notes</label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Optional notes"
                style={{
                  ...fieldInputStyle,
                  resize: 'vertical',
                  fontFamily: 'var(--font-sans)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Section 1b — Dimension Pickers */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'visible',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--background)',
            }}
          >
            <span style={sectionHeaderStyle}>Dimensi Produksi</span>
          </div>

          <div
            style={{
              padding: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16,
            }}
          >
            {/* Konsumsi Dari */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ ...sectionHeaderStyle, fontSize: 10 }}>Konsumsi Dari</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>
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
                      />
                    )}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
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
                      />
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Output Ke */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ ...sectionHeaderStyle, fontSize: 10 }}>Output Ke</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>
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
                      />
                    )}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
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
                      />
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2 — Production Items */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--background)',
              borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={sectionHeaderStyle}>Production Items</span>
            <button
              type="button"
              onClick={() => {
                appendDetail({
                  product_uom_id: 0,
                  qty: 1,
                  status: 'final',
                  expiry_date: '',
                  description: '',
                  materials: [{ product_inventory_id: 0, qty: 1 }],
                })
                setExpandedDetails((prev) => [...prev, detailFields.length])
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 12px',
                background: 'var(--accent-light-bg)',
                color: 'var(--accent)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              Add Item
            </button>
          </div>

          <div style={{ padding: 0, borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}>
            {detailFields.map((field, detailIndex) => {
              const isExpanded = expandedDetails.includes(detailIndex)
              return (
                <div
                  key={field.id}
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  {/* Detail header row */}
                  <div
                    style={{
                      padding: '12px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: isExpanded ? 'var(--accent-light-bg)' : 'var(--background)',
                    }}
                  >
                    {/* Expand icon */}
                    <div
                      onClick={() => toggleDetail(detailIndex)}
                      style={{
                        width: 24,
                        height: 24,
                        background: 'var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        cursor: 'pointer',
                      }}
                    >
                      {isExpanded ? (
                        <ChevronUp size={13} style={{ color: 'var(--foreground-muted)' }} />
                      ) : (
                        <ChevronDown size={13} style={{ color: 'var(--foreground-muted)' }} />
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
                                background: 'var(--surface)',
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
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-md)',
                                  boxShadow: 'var(--shadow-lg)',
                                  maxHeight: 220,
                                  overflowY: 'auto',
                                  zIndex: 300,
                                }}
                              >
                                {prodItemProducts.length === 0 && (
                                  <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--foreground-muted)' }}>
                                    No products found
                                  </div>
                                )}
                                {prodItemProducts.map((p: any) => (
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
                                    {p.name}
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
                                  background: 'var(--surface)',
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
                                {prodItemUoms.length === 0 && (
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
                      style={{ width: 100 }}
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
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-md)',
                              fontSize: 13,
                              outline: 'none',
                              color: 'var(--foreground)',
                              background: 'var(--surface)',
                              fontFamily: 'var(--font-sans)',
                              boxSizing: 'border-box',
                            }}
                          />
                        )
                      })()}
                    </div>

                    {/* Per-detail status */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <Controller
                        name={`details.${detailIndex}.status` as any}
                        control={control}
                        render={({ field: f }) => (
                          <div style={{ display: 'flex', gap: 4 }}>
                            {(['pending', 'final'] as const).map((s) => {
                              const isSel = f.value === s
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => f.onChange(s)}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    borderRadius: 'var(--radius-sm)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: isSel
                                      ? s === 'final' ? 'var(--success-bg)' : 'var(--warning-bg)'
                                      : 'var(--surface)',
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
                      style={{
                        padding: 4,
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
                      style={{
                        padding: '16px 20px 20px',
                        background: 'var(--surface)',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                      }}
                    >
                      {/* Batch + Expiry + description row */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
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
                      </div>

                      {/* Materials */}
                      <MaterialsFieldArray
                        control={control}
                        detailIndex={detailIndex}
                        register={register}
                        inventories={inventories}
                        errors={errors}
                        onLoadFromRecipe={handleLoadFromRecipe}
                        isLoadingRecipe={loadingRecipeFor === detailIndex}
                        activeMaterialIndex={activeMaterialIndex}
                        sharedMaterialSearch={sharedMaterialSearch}
                        sharedMaterialSearchDebounced={sharedMaterialSearchDebounced}
                        sharedMaterialProductId={sharedMaterialProductId}
                        sharedMaterialProductName={sharedMaterialProductName}
                        sharedShowMaterialUomPicker={sharedShowMaterialUomPicker}
                        materialProducts={materialProducts}
                        materialInventories={materialInventories}
                        setActiveMaterialIndex={setActiveMaterialIndex}
                        setSharedMaterialSearch={setSharedMaterialSearch}
                        setSharedMaterialProductId={setSharedMaterialProductId}
                        setSharedMaterialProductName={setSharedMaterialProductName}
                        setSharedShowMaterialUomPicker={setSharedShowMaterialUomPicker}
                        onSelectMaterialInventory={handleSelectMaterialInventory}
                        materialLabels={mergedMaterialLabels}
                        setValue={setValue}
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
            gap: 10,
            paddingTop: 4,
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              padding: '9px 20px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              color: 'var(--foreground)',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 20px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              opacity: isPending ? 0.7 : 1,
            }}
          >
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
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
