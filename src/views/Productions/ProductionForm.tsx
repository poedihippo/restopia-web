'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productionsService } from '@/services/productions.service'
import { productUomsService } from '@/services/product-uoms.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { recipesService } from '@/services/recipes.service'
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

// ── Schemas ──────────────────────────────────────────────────────────────────

const materialSchema = z.object({
  product_inventory_id: z.coerce.number().min(1),
  qty: z.coerce.number().min(0.001),
})

const detailSchema = z.object({
  product_uom_id: z.coerce.number().min(1, 'Product required'),
  qty: z.coerce.number().min(0.001, 'Qty required'),
  status: z.enum(['pending', 'final']),
  expiry_date: z.string().optional(),
  description: z.string().optional(),
  materials: z.array(materialSchema),
})

const schema = z.object({
  code: z.string().min(1, 'Code is required'),
  date: z.string().min(1, 'Date is required'),
  status: z.enum(['pending', 'final']),
  description: z.string().optional(),
  details: z.array(detailSchema).min(1),
})

type FormValues = z.infer<typeof schema>

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProductionFormProps {
  mode: 'create' | 'edit'
  initialData?: any
  productionId?: number
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

// ── MaterialsFieldArray ───────────────────────────────────────────────────────

interface MaterialsFieldArrayProps {
  control: any
  detailIndex: number
  register: any
  inventories: any[]
  errors: any
  onLoadFromRecipe: (index: number) => void
  isLoadingRecipe: boolean
}

export function MaterialsFieldArray({
  control,
  detailIndex,
  register,
  inventories,
  errors,
  onLoadFromRecipe,
  isLoadingRecipe,
}: MaterialsFieldArrayProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `details.${detailIndex}.materials` as any,
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
      {fields.map((field, matIndex) => (
        <div
          key={field.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 32px',
            gap: 8,
            alignItems: 'start',
          }}
        >
          <Controller
            name={`details.${detailIndex}.materials.${matIndex}.product_inventory_id` as any}
            control={control}
            render={({ field: f }) => (
              <select
                value={f.value ?? 0}
                onChange={(e) => f.onChange(Number(e.target.value))}
                style={{
                  padding: '7px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  background: 'var(--surface)',
                  outline: 'none',
                  width: '100%',
                  color: 'var(--foreground)',
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                }}
              >
                <option value={0} disabled>Select inventory</option>
                {inventories.map((inv: any) => (
                  <option key={inv.id} value={inv.id}>
                    {`${inv.code ?? `INV-${inv.id}`}${inv.branch ? ` (${inv.branch.name})` : ''} — Stock: ${inv.qty ?? 0}`}
                  </option>
                ))}
              </select>
            )}
          />

          <input
            type="number"
            min={0.001}
            step={0.001}
            {...register(
              `details.${detailIndex}.materials.${matIndex}.qty` as any,
              { valueAsNumber: true }
            )}
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
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProductionForm({
  mode,
  initialData,
  productionId,
}: ProductionFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [expandedDetails, setExpandedDetails] = useState<number[]>([0])
  const [loadingRecipeFor, setLoadingRecipeFor] = useState<number | null>(null)

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
      code: '',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      description: '',
      details: [
        {
          product_uom_id: 0,
          qty: 1,
          status: 'pending',
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

  // Queries
  const { data: productUomsData } = useQuery({
    queryKey: ['product-uoms-all'],
    queryFn: () =>
      productUomsService.list({ per_page: 200, include: 'product,uom' }).then((r) => r.data),
  })
  const productUoms = (productUomsData as any)?.data ?? []

  const { data: inventoriesData } = useQuery({
    queryKey: ['product-inventories-all'],
    queryFn: () =>
      productInventoriesService.list({ per_page: 200, include: 'branch' }).then((r) => r.data),
  })
  const inventories = (inventoriesData as any)?.data ?? []

  // Edit mode: prefill
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      reset(initialData)
      const indices = (initialData.details ?? []).map((_: any, i: number) => i)
      setExpandedDetails(indices)
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
        const res = await recipesService.list({
          per_page: 1,
          include: 'recipe_materials',
          'filter[is_default]': 1,
        } as any)
        const recipes = (res.data as any)?.data ?? []
        if (!recipes.length) {
          toast.error('No default recipe found')
          return
        }
        const recipe = recipes[0]
        const materials = recipe.recipe_materials ?? []
        if (!materials.length) {
          toast.error('Recipe has no materials')
          return
        }
        const mappedMaterials = materials.map((mat: any) => {
          const match = inventories.find(
            (inv: any) => inv.product_uom_id === mat.product_uom_id
          )
          return {
            product_inventory_id: match?.id ?? 0,
            qty: mat.qty,
          }
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
    [watchDetails, inventories, setValue]
  )

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => productionsService.create(values as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] })
      toast.success('Production created')
      router.push('/production')
    },
    onError: () => toast.error('Failed to create production'),
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      productionsService.update(productionId!, values as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] })
      queryClient.invalidateQueries({ queryKey: ['production', productionId] })
      toast.success('Production updated')
      router.push(`/production/${productionId}/detail`)
    },
    onError: () => toast.error('Failed to update production'),
  })

  const onSubmit = (values: FormValues) => {
    if (mode === 'edit') {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

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
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        {/* Section 1 — Production Details */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
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
            {/* Code */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>Production Code</label>
              <input
                {...register('code')}
                placeholder="e.g. PN-2026-001"
                style={{
                  ...fieldInputStyle,
                  border: `1px solid ${errors.code ? 'var(--destructive)' : 'var(--border)'}`,
                }}
              />
              {errors.code && (
                <span style={{ fontSize: 11, color: 'var(--destructive)', marginTop: 3 }}>
                  {errors.code.message}
                </span>
              )}
            </div>

            {/* Date */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>Production Date</label>
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
              <label style={labelStyle}>Status</label>
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

        {/* Section 2 — Production Items */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--background)',
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
                  status: 'pending',
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

          <div style={{ padding: 0 }}>
            {detailFields.map((field, detailIndex) => {
              const isExpanded = expandedDetails.includes(detailIndex)
              return (
                <div
                  key={field.id}
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  {/* Detail header row */}
                  <div
                    onClick={() => toggleDetail(detailIndex)}
                    style={{
                      padding: '12px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      background: isExpanded ? 'var(--accent-light-bg)' : 'var(--background)',
                    }}
                  >
                    {/* Expand icon */}
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        background: 'var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isExpanded ? (
                        <ChevronUp size={13} style={{ color: 'var(--foreground-muted)' }} />
                      ) : (
                        <ChevronDown size={13} style={{ color: 'var(--foreground-muted)' }} />
                      )}
                    </div>

                    {/* Product UOM select */}
                    <div
                      style={{ flex: 1 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Controller
                        name={`details.${detailIndex}.product_uom_id` as any}
                        control={control}
                        render={({ field: f }) => (
                          <select
                            value={f.value ?? 0}
                            onChange={(e) => f.onChange(Number(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-md)',
                              fontSize: 13,
                              background: 'var(--surface)',
                              outline: 'none',
                              color: 'var(--foreground)',
                              fontFamily: 'var(--font-sans)',
                              cursor: 'pointer',
                            }}
                          >
                            <option value={0} disabled>Select finished product</option>
                            {productUoms.map((pu: any) => (
                              <option key={pu.id} value={pu.id}>
                                {`${pu.product?.name ?? pu.id} — ${pu.uom?.name ?? ''}${pu.code ? ` (${pu.code})` : ''}`}
                              </option>
                            ))}
                          </select>
                        )}
                      />
                    </div>

                    {/* Qty */}
                    <div
                      style={{ width: 100 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        min={0.001}
                        step={0.001}
                        {...register(`details.${detailIndex}.qty` as any, {
                          valueAsNumber: true,
                        })}
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
                      {/* Expiry + description row */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 12,
                        }}
                      >
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
