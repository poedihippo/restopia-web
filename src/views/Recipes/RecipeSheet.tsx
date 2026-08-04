'use client'

import React, { useState, useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { recipesService } from '@/services/recipes.service'
import { toastMutationApiError } from '@/utils/apiError'
import { productUomsService } from '@/services/product-uoms.service'
import api from '@/hooks/useApi'
import { X, Loader2, Trash2 } from 'lucide-react'

// ── Schemas ──────────────────────────────────────────────────────────────────

const materialSchema = z.object({
  product_uom_id: z.coerce.number().min(1, 'Material required'),
  qty: z.coerce.number().min(0.001, 'Qty must be > 0'),
})

const schema = z.object({
  product_uom_id: z.coerce.number().min(1, 'Product is required'),
  qty: z.coerce.number().min(0.001, 'Yield qty must be > 0'),
  is_default: z.boolean().default(false),
  materials: z.array(materialSchema).min(1, 'At least one material required'),
})

type FormValues = z.infer<typeof schema>

// ── Props ─────────────────────────────────────────────────────────────────────

interface RecipeSheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    product_uom_id: number
    qty: number
    is_default: boolean
    product_uom?: {
      id: number
      code?: string
      product?: { id?: number; name?: string }
      uom?: { id?: number; name?: string; code?: string }
    }
    recipe_materials?: Array<{
      id: number
      product_uom_id: number
      qty: number
      product_uom?: {
        id: number
        code?: string
        product?: { name: string; base_uom?: { id?: number; name?: string; code?: string } }
        uom?: { code: string }
      }
    }>
  } | null
}

// ── Shared field styles ───────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
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
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--foreground)',
  marginBottom: 4,
  display: 'block',
}

const errorTextStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--destructive)',
  marginTop: 3,
}

function productUomOptionLabel(pu: any) {
  return `${pu.product?.name ?? '—'} — ${pu.uom?.name ?? ''}${pu.uom?.code ? ` (${pu.uom.code})` : ''}${pu.code ? ` · SKU: ${pu.code}` : ''}`
}

/** API envelope is either `{ data: T[] }` or `{ data: { data: T[], meta } }`. */
function unwrapProductsList(resp: any): any[] {
  if (!resp) return []
  const d = resp.data
  if (Array.isArray(d)) return d
  if (d && Array.isArray(d.data)) return d.data
  return []
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RecipeSheet({ open, onClose, editData }: RecipeSheetProps) {
  const queryClient = useQueryClient()

  const [materialSearch, setMaterialSearch] = useState('')
  const [materialSearchDebounced, setMaterialSearchDebounced] = useState('')
  const [materialTypeFilter, setMaterialTypeFilter] = useState<'raw' | 'wip' | 'final' | ''>('raw')
  const [showMaterialDrop, setShowMaterialDrop] = useState(false)
  const [materialInfoMap, setMaterialInfoMap] = useState<Record<number, any>>({})

  const [finishedSearch, setFinishedSearch] = useState('')
  const [finishedSearchDebounced, setFinishedSearchDebounced] = useState('')
  const [showFinishedDrop, setShowFinishedDrop] = useState(false)
  const [selectedFinishedLabel, setSelectedFinishedLabel] = useState('')
  const [selectedFinishedProductId, setSelectedFinishedProductId] = useState<number | null>(null)
  const [selectedFinishedProductName, setSelectedFinishedProductName] = useState('')
  const [showUomPicker, setShowUomPicker] = useState(false)

  const [selectedMaterialProductId, setSelectedMaterialProductId] = useState<number | null>(null)
  const [selectedMaterialProductName, setSelectedMaterialProductName] = useState('')
  const [selectedMaterialBaseUom, setSelectedMaterialBaseUom] = useState<{ name?: string; code?: string } | null>(null)
  const [showMaterialUomPicker, setShowMaterialUomPicker] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      product_uom_id: 0,
      qty: 1,
      is_default: false,
      materials: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'materials' })

  const { data: productUomsData } = useQuery({
    queryKey: ['product-uoms-all'],
    queryFn: async () => {
      let allProductUoms: any[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await productUomsService
          .list({ page, per_page: 100, include: 'product,product.base_uom,uom' })
          .then((r) => r.data)
        const items = (res as any)?.data ?? []
        allProductUoms = allProductUoms.concat(items)
        totalPages =
          (res as any)?.meta?.last_page ??
          (res as any)?.meta?.total_pages ??
          1
        page += 1
      } while (page <= totalPages)
      return { data: allProductUoms }
    },
  })
  const productUoms = (productUomsData as any)?.data ?? []

  useEffect(() => {
    const timer = setTimeout(() => setMaterialSearchDebounced(materialSearch), 400)
    return () => clearTimeout(timer)
  }, [materialSearch])

  useEffect(() => {
    const timer = setTimeout(() => setFinishedSearchDebounced(finishedSearch), 400)
    return () => clearTimeout(timer)
  }, [finishedSearch])

  const { data: finishedData } = useQuery({
    queryKey: ['products', 'final', finishedSearchDebounced],
    enabled: showFinishedDrop === true,
    queryFn: () =>
      api
        .get('/products', {
          params: {
            'filter[type]': 'final',
            'filter[search]': finishedSearchDebounced,
            per_page: 20,
            include: 'product_category',
          },
        })
        .then((r) => r.data),
  })
  const finishedProducts = unwrapProductsList(finishedData)

  const { data: materialSearchData } = useQuery({
    queryKey: ['recipe-material-search', materialSearchDebounced, materialTypeFilter],
    enabled: showMaterialDrop && materialSearchDebounced.length >= 2,
    queryFn: () => {
      const params: Record<string, any> = {
        per_page: 500,
        include: 'base_uom',
        sort: 'name',
      }
      if (materialSearchDebounced) params['filter[search]'] = materialSearchDebounced
      if (materialTypeFilter) params['filter[type]'] = materialTypeFilter
      return api.get('/products', { params }).then((r) => r.data)
    },
  })
  const materialProducts = unwrapProductsList(materialSearchData)

  const { data: finishedUomData } = useQuery({
    queryKey: ['recipe-finished-uoms', selectedFinishedProductId],
    enabled: !!selectedFinishedProductId,
    queryFn: () =>
      api
        .get('/product-uoms', {
          params: {
            per_page: 500,
            include: 'uom',
            'filter[product_id]': selectedFinishedProductId,
          },
        })
        .then((r) => r.data),
  })
  const finishedUoms = unwrapProductsList(finishedUomData)

  const { data: materialUomData } = useQuery({
    queryKey: ['recipe-material-uoms', selectedMaterialProductId],
    enabled: !!selectedMaterialProductId,
    queryFn: () =>
      api
        .get('/product-uoms', {
          params: {
            per_page: 500,
            include: 'uom',
            'filter[product_id]': selectedMaterialProductId,
          },
        })
        .then((r) => r.data),
  })
  const materialUoms = unwrapProductsList(materialUomData)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-material-search]')) {
        setShowMaterialDrop(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-finished-search]')) {
        setShowFinishedDrop(false)
        setFinishedSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (editData) {
      reset({
        product_uom_id: editData.product_uom_id,
        qty: editData.qty,
        is_default: editData.is_default,
        materials:
          editData.recipe_materials?.map((m) => ({
            product_uom_id: m.product_uom_id,
            qty: m.qty,
          })) ?? [],
      })
      const map: Record<number, any> = {}
      editData.recipe_materials?.forEach((m) => {
        if (m.product_uom_id && m.product_uom) {
          map[m.product_uom_id] = m.product_uom
        }
      })
      setMaterialInfoMap(map)
      setFinishedSearch('')
      setShowUomPicker(false)
      setSelectedFinishedProductId(null)
      setSelectedFinishedProductName('')
      setShowMaterialUomPicker(false)
      setSelectedMaterialProductId(null)
      setSelectedMaterialProductName('')
      setSelectedMaterialBaseUom(null)
      if (editData.product_uom) {
        setSelectedFinishedLabel(productUomOptionLabel(editData.product_uom))
      } else {
        setSelectedFinishedLabel(`Product UOM #${editData.product_uom_id}`)
      }
    } else {
      reset({
        product_uom_id: 0,
        qty: 1,
        is_default: false,
        materials: [],
      })
      setMaterialInfoMap({})
      setSelectedFinishedLabel('')
      setFinishedSearch('')
      setShowUomPicker(false)
      setSelectedFinishedProductId(null)
      setSelectedFinishedProductName('')
      setShowMaterialUomPicker(false)
      setSelectedMaterialProductId(null)
      setSelectedMaterialProductName('')
      setSelectedMaterialBaseUom(null)
    }
  }, [editData, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => recipesService.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      toast.success('Recipe created')
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to create recipe'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) =>
      recipesService.update(editData!.id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      toast.success('Recipe updated')
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to update recipe'),
  })

  const onSubmit = (values: FormValues) => {
    if (editData) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.18)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'relative',
          zIndex: 50,
          width: 540,
          height: '100%',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 500,
              margin: 0,
              color: 'var(--foreground)',
            }}
          >
            {editData ? 'Edit Recipe' : 'New Recipe'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--foreground-muted)',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form body */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, fontSize: 11, color: 'var(--foreground-subtle)' }}>
            <span style={{ color: 'var(--destructive)' }}>*</span>
            <span>Required fields</span>
          </div>
          {/* Finished product */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
              Finished Product (Output)
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <div data-finished-search style={{ position: 'relative' }}>
              <input
                type="text"
                value={finishedSearch}
                onChange={(e) => {
                  setFinishedSearch(e.target.value)
                  setShowFinishedDrop(true)
                  if (!e.target.value) {
                    setValue('product_uom_id', 0)
                    setSelectedFinishedLabel('')
                  }
                }}
                onFocus={() => setShowFinishedDrop(true)}
                placeholder={selectedFinishedLabel || 'Search finished product...'}
                style={{
                  width: '100%',
                  height: 40,
                  border: `1px solid ${errors.product_uom_id ? 'var(--destructive)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '0 36px 0 12px',
                  fontSize: 14,
                  color:
                    selectedFinishedLabel && !finishedSearch
                      ? 'var(--foreground-muted)'
                      : 'var(--foreground)',
                  background: 'var(--surface)',
                  boxSizing: 'border-box',
                }}
              />
              {selectedFinishedLabel && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFinishedLabel('')
                    setFinishedSearch('')
                    setValue('product_uom_id', 0)
                    setShowUomPicker(false)
                    setSelectedFinishedProductId(null)
                    setSelectedFinishedProductName('')
                  }}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--foreground-muted)',
                    fontSize: 18,
                  }}
                >
                  ×
                </button>
              )}

              {selectedFinishedLabel && !finishedSearch && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 36,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    fontSize: 14,
                    color: 'var(--foreground)',
                    pointerEvents: 'none',
                  }}
                >
                  {selectedFinishedLabel}
                </div>
              )}

              {showFinishedDrop && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    maxHeight: 240,
                    overflowY: 'auto',
                  }}
                >
                  {finishedProducts.length === 0 && (
                    <p
                      style={{
                        padding: '12px 14px',
                        fontSize: 13,
                        color: 'var(--foreground-muted)',
                        margin: 0,
                      }}
                    >
                      No products found
                    </p>
                  )}
                  {finishedProducts.map((p: any) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedFinishedProductId(p.id)
                        setSelectedFinishedProductName(p.name)
                        setFinishedSearch('')
                        setShowFinishedDrop(false)
                        setShowUomPicker(true)
                      }}
                      style={{
                        padding: '10px 14px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border)',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--background)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = 'var(--surface)')
                      }
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--foreground)',
                        }}
                      >
                        {p.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--foreground-muted)',
                          marginTop: 2,
                        }}
                      >
                        {p.code} · {p.type}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showUomPicker && selectedFinishedProductId && (
              <div
                style={{
                  border: '1px solid var(--accent-light)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-light-bg)',
                  padding: '10px 14px',
                  marginTop: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--foreground-muted)',
                    marginBottom: 8,
                  }}
                >
                  Select UOM for <strong>{selectedFinishedProductName}</strong>:
                </div>
                {finishedUoms.length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--destructive)', margin: 0 }}>
                    No UOM variants found for this product. Add one in Product UOMs first.
                  </p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {finishedUoms.map((pu: any) => (
                    <button
                      key={pu.id}
                      type="button"
                      onClick={() => {
                        const label = `${selectedFinishedProductName} — ${pu.uom?.name ?? ''} (${pu.uom?.code ?? ''}) · SKU: ${pu.code}`
                        setValue('product_uom_id', pu.id)
                        setSelectedFinishedLabel(label)
                        setShowUomPicker(false)
                        setSelectedFinishedProductId(null)
                        setSelectedFinishedProductName('')
                      }}
                      style={{
                        padding: '6px 14px',
                        border: '1px solid var(--accent)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface)',
                        color: 'var(--accent)',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {pu.uom?.name ?? '?'} ({pu.uom?.code ?? '?'})
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--foreground-muted)',
                          marginLeft: 6,
                        }}
                      >
                        SKU: {pu.code}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowUomPicker(false)
                    setSelectedFinishedProductId(null)
                    setSelectedFinishedProductName('')
                  }}
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    color: 'var(--foreground-muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  ← Back to search
                </button>
              </div>
            )}

            {errors.product_uom_id && (
              <span style={errorTextStyle}>{errors.product_uom_id.message}</span>
            )}
          </div>

          {/* Qty + is_default row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            {/* Yield qty */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Yield Qty
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <input
                type="number"
                min={0.001}
                step={0.001}
                {...register('qty', { valueAsNumber: true })}
                placeholder="e.g. 1"
                style={{
                  ...fieldStyle,
                  border: `1px solid ${errors.qty ? 'var(--destructive)' : 'var(--border)'}`,
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)', marginTop: 4 }}>
                How many units this recipe produces
              </span>
              {errors.qty && <span style={errorTextStyle}>{errors.qty.message}</span>}
            </div>

            {/* is_default toggle */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>Default Recipe</label>
              <Controller
                name="is_default"
                control={control}
                render={({ field }) => (
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    style={{
                      width: 36,
                      height: 20,
                      borderRadius: 10,
                      border: 'none',
                      background: field.value ? 'var(--success)' : 'var(--border)',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'background 150ms ease',
                      marginTop: 2,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 3,
                        left: field.value ? 19 : 3,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: 'white',
                        transition: 'left 150ms ease',
                      }}
                    />
                  </button>
                )}
              />
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)', marginTop: 6 }}>
                Use as default for this product
              </span>
            </div>
          </div>

          {/* Materials section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Materials header */}
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2, marginBottom: 0 }}>
              Raw Materials (Ingredients)
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <span style={{ fontSize: 11, color: 'var(--foreground-subtle)', marginBottom: 4 }}>
              Enter quantities in each ingredient's base unit (e.g. gram)
            </span>

            {/* Type filter pills */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(
                [
                  { label: 'Raw', value: 'raw' },
                  { label: 'WIP', value: 'wip' },
                  { label: 'Final', value: 'final' },
                  { label: 'All', value: '' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setMaterialTypeFilter(opt.value)
                    setShowMaterialDrop(true)
                  }}
                  style={{
                    height: 28,
                    padding: '0 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    border: '1px solid',
                    borderColor:
                      materialTypeFilter === opt.value ? 'var(--accent)' : 'var(--border)',
                    borderRadius: 'var(--radius-xl)',
                    background:
                      materialTypeFilter === opt.value ? 'var(--accent)' : 'var(--surface)',
                    color:
                      materialTypeFilter === opt.value ? 'white' : 'var(--foreground-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Search input + dropdown */}
            <div
              data-material-search
              style={{ position: 'relative', marginBottom: 12 }}
            >
              <input
                type="text"
                value={materialSearch}
                onChange={(e) => {
                  setMaterialSearch(e.target.value)
                  setShowMaterialDrop(true)
                }}
                onFocus={() => setShowMaterialDrop(true)}
                placeholder="Search ingredient by name or code..."
                style={{
                  width: '100%',
                  height: 38,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0 12px',
                  fontSize: 14,
                  color: 'var(--foreground)',
                  background: 'var(--surface)',
                  boxSizing: 'border-box',
                }}
              />

              {showMaterialDrop && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    maxHeight: 220,
                    overflowY: 'auto',
                  }}
                >
                  {materialProducts.length === 0 && (
                    <p
                      style={{
                        padding: '12px 14px',
                        fontSize: 13,
                        color: 'var(--foreground-muted)',
                        margin: 0,
                      }}
                    >
                      {materialSearchDebounced.length < 2
                        ? 'Type at least 2 characters to search...'
                        : 'No results found'}
                    </p>
                  )}
                  {materialProducts.map((p: any) => {
                    const typeColor =
                      p.type === 'raw'
                        ? 'var(--info)'
                        : p.type === 'wip'
                          ? 'var(--warning)'
                          : 'var(--success)'
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedMaterialProductId(p.id)
                          setSelectedMaterialProductName(p.name)
                          setSelectedMaterialBaseUom(p.base_uom ?? null)
                          setMaterialSearch('')
                          setShowMaterialDrop(false)
                          setShowMaterialUomPicker(true)
                        }}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = 'var(--background)')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = 'var(--surface)')
                        }
                      >
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: 'var(--foreground)',
                              }}
                            >
                              {p.name}
                            </span>
                            {p.type ? (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: typeColor,
                                  padding: '1px 5px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: `1px solid ${typeColor}`,
                                  textTransform: 'uppercase',
                                }}
                              >
                                {p.type}
                              </span>
                            ) : null}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--foreground-muted)',
                              marginTop: 2,
                            }}
                          >
                            {p.code} · {p.type}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {showMaterialUomPicker && selectedMaterialProductId && (
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--background)',
                  padding: '10px 14px',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--foreground-muted)',
                    marginBottom: 8,
                  }}
                >
                  Select UOM for <strong>{selectedMaterialProductName}</strong>:
                </div>
                {materialUoms.length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--destructive)', margin: 0 }}>
                    No UOM variants found for this product.
                  </p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {materialUoms.map((pu: any) => (
                    <button
                      key={pu.id}
                      type="button"
                      onClick={() => {
                        append({ product_uom_id: pu.id, qty: 1 })
                        setMaterialInfoMap((prev) => ({
                          ...prev,
                          [pu.id]: {
                            product: { name: selectedMaterialProductName, base_uom: selectedMaterialBaseUom },
                            uom: { name: pu.uom?.name ?? '', code: pu.uom?.code ?? '' },
                            code: pu.code,
                          },
                        }))
                        setShowMaterialUomPicker(false)
                        setSelectedMaterialProductId(null)
                        setSelectedMaterialProductName('')
                        setSelectedMaterialBaseUom(null)
                      }}
                      style={{
                        padding: '6px 14px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface)',
                        color: 'var(--foreground)',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      {pu.uom?.name ?? '?'} ({pu.uom?.code ?? '?'})
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--foreground-muted)',
                          marginLeft: 6,
                        }}
                      >
                        {pu.code}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowMaterialUomPicker(false)
                    setSelectedMaterialProductId(null)
                    setSelectedMaterialProductName('')
                    setSelectedMaterialBaseUom(null)
                  }}
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    color: 'var(--foreground-muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  ← Back to search
                </button>
              </div>
            )}

            {/* Material rows */}
            {fields.map((field, index) => {
              const puId = (field as any).product_uom_id
              const info = materialInfoMap[puId]
              const fromAll = productUoms.find((p: any) => p.id === puId)
              const displayName =
                info?.product?.name ?? fromAll?.product?.name ?? `Item #${puId}`
              const uomCode = info?.uom?.code ?? fromAll?.uom?.code ?? ''
              const sku = info?.code ?? fromAll?.code ?? ''
              const baseUomName =
                info?.product?.base_uom?.name ?? fromAll?.product?.base_uom?.name ?? ''
              return (
                <div
                  key={field.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 100px 32px',
                    gap: 8,
                    alignItems: 'start',
                  }}
                >
                  {/* Material display */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div
                      style={{
                        padding: '8px 10px',
                        border: `1px solid ${
                          errors.materials?.[index]?.product_uom_id
                            ? 'var(--destructive)'
                            : 'var(--border)'
                        }`,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--background)',
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                        {displayName !== `Item #${puId}` ? displayName : `Material #${index + 1}`}
                      </span>
                      <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                        {displayName !== `Item #${puId}` ? '' : displayName} {uomCode ? `(${uomCode})` : ''} {sku ? `· SKU: ${sku}` : ''}
                      </div>
                    </div>
                    {errors.materials?.[index]?.product_uom_id && (
                      <span style={errorTextStyle}>
                        {errors.materials[index]!.product_uom_id!.message}
                      </span>
                    )}
                  </div>

                  {/* Qty */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input
                      type="number"
                      min={0.001}
                      step={0.01}
                      {...register(`materials.${index}.qty`, { valueAsNumber: true })}
                      placeholder="Qty"
                      style={{
                        ...fieldStyle,
                        border: `1px solid ${
                          errors.materials?.[index]?.qty
                            ? 'var(--destructive)'
                            : 'var(--border)'
                        }`,
                      }}
                    />
                    <span style={{ fontSize: 10, color: 'var(--foreground-subtle)' }}>
                      {baseUomName ? `in ${baseUomName}` : 'base unit'}
                    </span>
                    {errors.materials?.[index]?.qty && (
                      <span style={errorTextStyle}>
                        {errors.materials[index]!.qty!.message}
                      </span>
                    )}
                  </div>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    style={{
                      padding: 6,
                      marginTop: 2,
                      background: 'none',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      cursor: fields.length === 1 ? 'not-allowed' : 'pointer',
                      color: fields.length === 1 ? 'var(--border)' : 'var(--destructive)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}

            {/* Add another ingredient — reopens the search so the next picked
                product+UOM appends a new row via the existing append flow. */}
            <button
              type="button"
              onClick={() => {
                setSelectedMaterialProductId(null)
                setSelectedMaterialProductName('')
                setShowMaterialUomPicker(false)
                setMaterialSearch('')
                setShowMaterialDrop(true)
              }}
              style={{
                marginTop: 8,
                alignSelf: 'flex-start',
                padding: '8px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--accent)',
                cursor: 'pointer',
              }}
            >
              + Add ingredient
            </button>

            {/* Array-level materials error */}
            {errors.materials && typeof (errors.materials as any).message === 'string' && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {(errors.materials as any).message}
              </span>
            )}
          </div>
        </form>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
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
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSubmit(onSubmit)}
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending && (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            )}
            {editData ? 'Save Changes' : 'Create Recipe'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
