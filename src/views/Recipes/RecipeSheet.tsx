'use client'

import React, { useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { recipesService } from '@/services/recipes.service'
import { productUomsService } from '@/services/product-uoms.service'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function RecipeSheet({ open, onClose, editData }: RecipeSheetProps) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
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
    } else {
      reset({
        product_uom_id: 0,
        qty: 1,
        is_default: false,
        materials: [{ product_uom_id: 0, qty: 1 }],
      })
    }
  }, [editData, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => recipesService.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      toast.success('Recipe created')
      onClose()
    },
    onError: () => toast.error('Failed to create recipe'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) =>
      recipesService.update(editData!.id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      toast.success('Recipe updated')
      onClose()
    },
    onError: () => toast.error('Failed to update recipe'),
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
            <Controller
              name="product_uom_id"
              control={control}
              render={({ field }) => (
                <select
                  value={field.value ?? 0}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  style={{
                    ...fieldStyle,
                    cursor: 'pointer',
                    border: `1px solid ${errors.product_uom_id ? 'var(--destructive)' : 'var(--border)'}`,
                  }}
                >
                  <option value={0} disabled>Select finished product</option>
                  {productUoms.map((pu: any) => (
                    <option key={pu.id} value={pu.id}>
                      {productUomOptionLabel(pu)}
                    </option>
                  ))}
                </select>
              )}
            />
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <label style={labelStyle}>Raw Materials (Ingredients)</label>
              <button
                type="button"
                onClick={() => append({ product_uom_id: 0, qty: 1 })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  background: 'var(--accent-light-bg)',
                  color: 'var(--accent)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Plus size={12} />
                Add Material
              </button>
            </div>

            {/* Material rows */}
            {fields.map((field, index) => (
              <div
                key={field.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 32px',
                  gap: 8,
                  alignItems: 'start',
                }}
              >
                {/* Material select */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Controller
                    name={`materials.${index}.product_uom_id`}
                    control={control}
                    render={({ field: f }) => (
                      <select
                        value={f.value ?? 0}
                        onChange={(e) => f.onChange(Number(e.target.value))}
                        style={{
                          ...fieldStyle,
                          cursor: 'pointer',
                          border: `1px solid ${
                            errors.materials?.[index]?.product_uom_id
                              ? 'var(--destructive)'
                              : 'var(--border)'
                          }`,
                        }}
                      >
                        <option value={0} disabled>Select ingredient</option>
                        {productUoms.map((pu: any) => (
                          <option key={pu.id} value={pu.id}>
                            {productUomOptionLabel(pu)}
                          </option>
                        ))}
                      </select>
                    )}
                  />
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
            ))}

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
