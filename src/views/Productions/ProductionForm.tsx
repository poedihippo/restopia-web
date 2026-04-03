'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productionsService } from '@/services/productions.service'
import { productUomsService } from '@/services/product-uoms.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import {
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  Save,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

// ── Schemas ─────────────────────────────────────────────────────────────────

const materialSchema = z.object({
  product_inventory_id: z.coerce.number().min(1, 'Material required'),
  qty: z.coerce.number().min(0.001, 'Qty must be > 0'),
})

const detailSchema = z.object({
  product_uom_id: z.coerce.number().min(1, 'Product required'),
  qty: z.coerce.number().min(0.001, 'Qty must be > 0'),
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
  details: z.array(detailSchema).min(1, 'At least one item required'),
})

type FormValues = z.infer<typeof schema>

// ── Props ────────────────────────────────────────────────────────────────────

interface ProductionFormProps {
  mode: 'create' | 'edit'
  initialData?: any
  productionId?: number
}

// ── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  color: 'var(--foreground)',
  background: 'var(--surface)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
}

const inputErrorStyle: React.CSSProperties = {
  ...inputStyle,
  border: '1px solid var(--destructive)',
}

const lineInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
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

const errorStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--destructive)',
  marginTop: 4,
}

const sectionHeaderStyle: React.CSSProperties = {
  padding: '14px 20px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--background)',
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
  boxShadow: 'var(--shadow-sm)',
}

// ── MaterialsFieldArray sub-component ───────────────────────────────────────

export function MaterialsFieldArray({
  control,
  detailIndex,
  register,
  inventories,
  errors,
}: {
  control: any
  detailIndex: number
  register: any
  inventories: any[]
  errors: any
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `details.${detailIndex}.materials` as any,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Materials header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--foreground-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Raw Materials
        </span>
        <button
          type="button"
          onClick={() => append({ product_inventory_id: 0, qty: 1 })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            background: 'var(--accent-light-bg)',
            color: 'var(--accent)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Plus size={11} />
          Add Material
        </button>
      </div>

      {/* Material rows */}
      {fields.map((matField, matIndex) => (
        <div
          key={matField.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 100px 32px',
            gap: 8,
            alignItems: 'center',
          }}
        >
          {/* Inventory select */}
          <Controller
            name={`details.${detailIndex}.materials.${matIndex}.product_inventory_id` as any}
            control={control}
            render={({ field }) => (
              <select
                value={field.value ?? 0}
                onChange={(e) => field.onChange(Number(e.target.value))}
                style={{ ...lineInputStyle, cursor: 'pointer' }}
              >
                <option value={0} disabled>Select material</option>
                {inventories.map((inv: any) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.code ?? inv.id}
                    {inv.branch ? ` (${inv.branch.name})` : ''}
                    {' — Stock: '}
                    {inv.qty ?? 0}
                  </option>
                ))}
              </select>
            )}
          />

          {/* Qty */}
          <input
            type="number"
            min={0.001}
            step={0.001}
            {...register(
              `details.${detailIndex}.materials.${matIndex}.qty`,
              { valueAsNumber: true }
            )}
            style={lineInputStyle}
          />

          {/* Remove */}
          <button
            type="button"
            onClick={() => remove(matIndex)}
            disabled={fields.length === 1}
            style={{
              padding: 4,
              background: 'none',
              border: 'none',
              cursor: fields.length === 1 ? 'not-allowed' : 'pointer',
              color: fields.length === 1 ? 'var(--border)' : 'var(--destructive)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ProductionForm({
  mode,
  initialData,
  productionId,
}: ProductionFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [expandedDetails, setExpandedDetails] = useState<number[]>([0])

  const {
    register,
    handleSubmit,
    reset,
    control,
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

  const {
    fields: detailFields,
    append: appendDetail,
    remove: removeDetail,
  } = useFieldArray({ control, name: 'details' })

  // ── Dropdown data ────────────────────────────────────────────────────────

  const { data: productUomsData } = useQuery({
    queryKey: ['product-uoms-all'],
    queryFn: () =>
      productUomsService
        .list({ per_page: 200, include: 'product,uom' })
        .then((r) => r.data),
  })
  const productUoms = (productUomsData as any)?.data ?? []

  const { data: inventoriesData } = useQuery({
    queryKey: ['product-inventories-all'],
    queryFn: () =>
      productInventoriesService
        .list({ per_page: 200, include: 'branch' })
        .then((r) => r.data),
  })
  const inventories = (inventoriesData as any)?.data ?? []

  // ── Edit pre-fill ────────────────────────────────────────────────────────

  useEffect(() => {
    if (mode === 'edit' && initialData) {
      reset(initialData)
    }
  }, [initialData, mode, reset])

  // ── Helpers ──────────────────────────────────────────────────────────────

  const toggleDetail = (index: number) => {
    setExpandedDetails((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    )
  }

  // ── Mutations ────────────────────────────────────────────────────────────

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
      queryClient.invalidateQueries({ queryKey: ['production-detail', productionId] })
      toast.success('Production updated')
      router.push(`/production/${productionId}/detail`)
    },
    onError: () => toast.error('Failed to update production'),
  })

  const onSubmit = (values: FormValues) => {
    if (mode === 'edit' && productionId) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        padding: '32px 32px 64px',
        maxWidth: 1000,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
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
            padding: '6px 10px',
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: 'var(--foreground-muted)',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={14} />
          Back
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
            {mode === 'edit' ? 'Edit Production' : 'New Production'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            {mode === 'edit'
              ? 'Update production order details'
              : 'Create a new production order'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        {/* ── Section 1: Production Details ─────────────────────────────── */}
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionLabelStyle}>Production Details</span>
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
                style={errors.code ? inputErrorStyle : inputStyle}
              />
              {errors.code && <span style={errorStyle}>{errors.code.message}</span>}
            </div>

            {/* Date */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>Production Date</label>
              <input
                type="date"
                {...register('date')}
                style={errors.date ? inputErrorStyle : inputStyle}
              />
              {errors.date && <span style={errorStyle}>{errors.date.message}</span>}
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
                      const isSelected = field.value === s
                      const isWarning = s === 'pending'
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => field.onChange(s)}
                          style={{
                            padding: '6px 16px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: 'pointer',
                            background: isSelected
                              ? isWarning ? 'var(--warning-bg)' : 'var(--success-bg)'
                              : 'var(--background)',
                            color: isSelected
                              ? isWarning ? 'var(--warning)' : 'var(--success)'
                              : 'var(--foreground-muted)',
                            border: isSelected
                              ? isWarning
                                ? '1px solid var(--warning)'
                                : '1px solid var(--success)'
                              : '1px solid var(--border)',
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

            {/* Notes */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gridColumn: 'span 2',
              }}
            >
              <label style={labelStyle}>Notes</label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Optional production notes"
                style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }}
              />
            </div>
          </div>
        </div>

        {/* ── Section 2: Production Items ───────────────────────────────── */}
        <div style={cardStyle}>
          {/* Section header */}
          <div
            style={{
              ...sectionHeaderStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={sectionLabelStyle}>Production Items</span>
            <button
              type="button"
              onClick={() => {
                const newIndex = detailFields.length
                appendDetail({
                  product_uom_id: 0,
                  qty: 1,
                  status: 'pending',
                  expiry_date: '',
                  description: '',
                  materials: [{ product_inventory_id: 0, qty: 1 }],
                })
                setExpandedDetails((prev) => [...prev, newIndex])
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
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

          {/* Detail rows */}
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
                    background: isExpanded
                      ? 'var(--accent-light-bg)'
                      : 'var(--background)',
                    cursor: 'pointer',
                  }}
                >
                  {/* Expand toggle */}
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--border)',
                      flexShrink: 0,
                    }}
                  >
                    {isExpanded ? (
                      <ChevronUp size={13} />
                    ) : (
                      <ChevronDown size={13} />
                    )}
                  </div>

                  {/* Product UOM select */}
                  <div style={{ flex: 1 }} onClick={(e) => e.stopPropagation()}>
                    <Controller
                      name={`details.${detailIndex}.product_uom_id`}
                      control={control}
                      render={({ field: f }) => (
                        <select
                          value={f.value ?? 0}
                          onChange={(e) => f.onChange(Number(e.target.value))}
                          style={{
                            ...lineInputStyle,
                            cursor: 'pointer',
                            border: `1px solid ${
                              errors.details?.[detailIndex]?.product_uom_id
                                ? 'var(--destructive)'
                                : 'var(--border)'
                            }`,
                          }}
                        >
                          <option value={0} disabled>Select product UOM</option>
                          {productUoms.map((pu: any) => (
                            <option key={pu.id} value={pu.id}>
                              {pu.product?.name ?? pu.id}
                              {' — '}
                              {pu.uom?.name ?? ''}
                              {pu.code ? ` (${pu.code})` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                  </div>

                  {/* Qty */}
                  <div style={{ width: 100 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number"
                      min={0.001}
                      step={0.001}
                      {...register(`details.${detailIndex}.qty`, {
                        valueAsNumber: true,
                      })}
                      style={lineInputStyle}
                    />
                  </div>

                  {/* Status toggle */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <Controller
                      name={`details.${detailIndex}.status`}
                      control={control}
                      render={({ field: f }) => (
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(['pending', 'final'] as const).map((s) => (
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
                                background:
                                  f.value === s
                                    ? s === 'pending'
                                      ? 'var(--warning-bg)'
                                      : 'var(--success-bg)'
                                    : 'var(--border)',
                                color:
                                  f.value === s
                                    ? s === 'pending'
                                      ? 'var(--warning)'
                                      : 'var(--success)'
                                    : 'var(--foreground-muted)',
                              }}
                            >
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                          ))}
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
                    {/* Row 1: expiry_date + description */}
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
                          {...register(`details.${detailIndex}.expiry_date`)}
                          style={lineInputStyle}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={labelStyle}>Notes</label>
                        <input
                          {...register(`details.${detailIndex}.description`)}
                          placeholder="Optional note"
                          style={lineInputStyle}
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
                    />
                  </div>
                )}
              </div>
            )
          })}

          {/* Array-level error */}
          {errors.details && typeof (errors.details as any).message === 'string' && (
            <div style={{ padding: '8px 20px' }}>
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {(errors.details as any).message}
              </span>
            </div>
          )}
        </div>

        {/* ── Form actions ──────────────────────────────────────────────── */}
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
              color: 'var(--foreground)',
              cursor: 'pointer',
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
            {isPending && (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            )}
            <Save size={14} />
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
