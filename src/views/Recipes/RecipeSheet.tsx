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
        product?: { name: string }
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

function productUomsOf(p: any): any[] {
  return p?.product_uoms ?? p?.productUoms ?? []
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
      materials: [{ product_uom_id: 0, qty: 1 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'materials' })

  const { data: productUomsData } = useQuery({
    queryKey: ['product-uoms-all'],
    queryFn: () =>
      productUomsService
        .list({ per_page: 200, include: 'product,uom' })
        .then((r) => r.data),
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
    queryKey: ['recipe-finished-search', finishedSearchDebounced],
    enabled: showFinishedDrop && finishedSearchDebounced.length >= 2,
    queryFn: () => {
      const params: Record<string, any> = {
        per_page: 50,
        include: 'product_uoms,product_uoms.uom',
        'filter[type]': 'final',
        sort: 'name',
      }
      if (finishedSearchDebounced) params['filter[search]'] = finishedSearchDebounced
      return api.get('/products', { params }).then((r) => r.data)
    },
  })
  const finishedProducts = unwrapProductsList(finishedData)

  const { data: materialSearchData } = useQuery({
    queryKey: ['recipe-material-search', materialSearchDebounced, materialTypeFilter],
    enabled: showMaterialDrop && materialSearchDebounced.length >= 2,
    queryFn: () => {
      const params: Record<string, any> = {
        per_page: 50,
        include: 'product_uoms,product_uoms.uom',
        sort: 'name',
      }
      if (materialSearchDebounced) params['filter[search]'] = materialSearchDebounced
      if (materialTypeFilter) params['filter[type]'] = materialTypeFilter
      return api.get('/products', { params }).then((r) => r.data)
    },
  })
  const materialProducts = unwrapProductsList(materialSearchData)

  const finishedRowItems = finishedProducts.flatMap((p: any) =>
    productUomsOf(p).map((pu: any) => ({
      id: pu.id,
      productName: p.name,
      uomName: pu.uom?.name ?? '',
      uomCode: pu.uom?.code ?? '',
      code: pu.code,
      label: `${p.name} — ${pu.uom?.name ?? ''} (${pu.uom?.code ?? ''}) · SKU: ${pu.code}`,
    })),
  )

  const materialRowItems = materialProducts.flatMap((p: any) =>
    productUomsOf(p).map((pu: any) => ({
      id: pu.id,
      productName: p.name,
      productType: p.type,
      uomName: pu.uom?.name ?? '',
      uomCode: pu.uom?.code ?? '',
      code: pu.code,
    })),
  )

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
          })) ?? [{ product_uom_id: 0, qty: 1 }],
      })
      const map: Record<number, any> = {}
      editData.recipe_materials?.forEach((m) => {
        if (m.product_uom_id && m.product_uom) {
          map[m.product_uom_id] = m.product_uom
        }
      })
      setMaterialInfoMap(map)
      setFinishedSearch('')
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
        materials: [{ product_uom_id: 0, qty: 1 }],
      })
      setMaterialInfoMap({})
      setSelectedFinishedLabel('')
      setFinishedSearch('')
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
          {/* Finished product */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={labelStyle}>Finished Product (Output)</label>
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
                  {finishedRowItems.length === 0 &&
                    finishedProducts.length === 0 && (
                    <p
                      style={{
                        padding: '12px 14px',
                        fontSize: 13,
                        color: 'var(--foreground-muted)',
                        margin: 0,
                      }}
                    >
                      {finishedSearchDebounced.length < 2
                        ? 'Type at least 2 characters to search...'
                        : 'No products found'}
                    </p>
                  )}
                  {finishedRowItems.map((item: any) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setValue('product_uom_id', item.id)
                        setSelectedFinishedLabel(item.label)
                        setFinishedSearch('')
                        setShowFinishedDrop(false)
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
                        {item.productName}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--foreground-muted)',
                          marginTop: 2,
                        }}
                      >
                        {item.uomName} ({item.uomCode}) · SKU: {item.code}
                      </div>
                    </div>
                  ))}
                  {finishedRowItems.length === 0 &&
                    finishedProducts.length > 0 &&
                    finishedProducts.map((p: any) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          const uoms = productUomsOf(p)
                          const pu = uoms[0]
                          if (!pu?.id) {
                            toast.error('No UOM variants for this product')
                            return
                          }
                          const label = `${p.name} — ${pu.uom?.name ?? ''} (${pu.uom?.code ?? ''}) · SKU: ${pu.code ?? ''}`
                          setValue('product_uom_id', pu.id)
                          setSelectedFinishedLabel(label)
                          setFinishedSearch('')
                          setShowFinishedDrop(false)
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
              <label style={labelStyle}>Yield Qty</label>
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
            <label style={labelStyle}>Raw Materials (Ingredients)</label>

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
                  {materialRowItems.length === 0 &&
                    materialProducts.length === 0 && (
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
                  {materialRowItems.map((item: any) => {
                    const typeColor =
                      item.productType === 'raw'
                        ? 'var(--info)'
                        : item.productType === 'wip'
                          ? 'var(--warning)'
                          : 'var(--success)'
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          append({ product_uom_id: item.id, qty: 1 })
                          setMaterialInfoMap((prev) => ({
                            ...prev,
                            [item.id]: {
                              product: { name: item.productName },
                              uom: { name: item.uomName, code: item.uomCode },
                              code: item.code,
                            },
                          }))
                          setMaterialSearch('')
                          setShowMaterialDrop(false)
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
                              {item.productName}
                            </span>
                            {item.productType ? (
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
                                {item.productType}
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
                            {item.uomName} ({item.uomCode}) · SKU: {item.code}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {materialRowItems.length === 0 &&
                    materialProducts.length > 0 &&
                    materialProducts.map((p: any) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          const uoms = productUomsOf(p)
                          const pu = uoms[0]
                          if (!pu?.id) {
                            toast.error('No UOM variants for this product')
                            return
                          }
                          append({ product_uom_id: pu.id, qty: 1 })
                          setMaterialInfoMap((prev) => ({
                            ...prev,
                            [pu.id]: {
                              product: { name: p.name },
                              uom: { name: pu.uom?.name ?? '', code: pu.uom?.code ?? '' },
                              code: pu.code,
                            },
                          }))
                          setMaterialSearch('')
                          setShowMaterialDrop(false)
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
                                  color:
                                    p.type === 'raw'
                                      ? 'var(--info)'
                                      : p.type === 'wip'
                                        ? 'var(--warning)'
                                        : 'var(--success)',
                                  padding: '1px 5px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: `1px solid ${
                                    p.type === 'raw'
                                      ? 'var(--info)'
                                      : p.type === 'wip'
                                        ? 'var(--warning)'
                                        : 'var(--success)'
                                  }`,
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
                    ))}
                </div>
              )}
            </div>

            {/* Material rows */}
            {fields.map((field, index) => {
              const puId = (field as any).product_uom_id
              const info = materialInfoMap[puId]
              const fromAll = productUoms.find((p: any) => p.id === puId)
              const displayName =
                info?.product?.name ?? fromAll?.product?.name ?? `Item #${puId}`
              const uomCode = info?.uom?.code ?? fromAll?.uom?.code ?? ''
              const sku = info?.code ?? fromAll?.code ?? ''
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
                      <div style={{ fontWeight: 500, color: 'var(--foreground)' }}>
                        {displayName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                        {uomCode}
                        {sku ? ` · ${sku}` : ''}
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
                      step={0.001}
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
