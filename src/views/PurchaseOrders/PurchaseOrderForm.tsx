'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { toastMutationApiError } from '@/utils/apiError'
import { suppliersService } from '@/services/suppliers.service'
import { branchesService } from '@/services/branches.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import {
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  ChevronDown,
  Save,
} from 'lucide-react'

const detailSchema = z.object({
  product_inventory_id: z.coerce.number().min(1, 'Product is required'),
  qty: z.coerce.number().min(0.01, 'Qty must be > 0'),
  price: z.coerce.number().min(0, 'Price required'),
  description: z.string().optional(),
})

const schema = z.object({
  code: z.string().min(1, 'Code is required'),
  supplier_id: z.coerce.number().min(1, 'Supplier is required'),
  branch_id: z.coerce.number().min(1, 'Branch is required'),
  date: z.string().min(1, 'Date is required'),
  status: z.enum(['pending', 'final']),
  description: z.string().optional(),
  details: z.array(detailSchema).min(1, 'At least one item required'),
})

type FormValues = z.infer<typeof schema>

interface PurchaseOrderFormProps {
  mode: 'create' | 'edit'
  initialData?: any
  orderId?: number
}

export default function PurchaseOrderForm(props: PurchaseOrderFormProps) {
  const { mode, initialData, orderId } = props
  const router = useRouter()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      code: '',
      supplier_id: 0,
      branch_id: 0,
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      description: '',
      details: [{ product_inventory_id: 0, qty: 1, price: 0, description: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'details' })

  const watchDetails = watch('details')
  const totalPrice = watchDetails.reduce(
    (sum, d) => sum + Number(d.qty) * Number(d.price),
    0
  )

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersService.list({ per_page: 200 }).then((r) => r.data),
  })
  const suppliers = (suppliersData as any)?.data ?? []

  const { data: branchesData } = useQuery({
    queryKey: ['branches-all'],
    queryFn: () => branchesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const branches = (branchesData as any)?.data ?? []

  const { data: inventoriesData } = useQuery({
    queryKey: ['product-inventories-all'],
    queryFn: () =>
      productInventoriesService
        .list({ per_page: 200, include: 'product_uom.product,product_uom.uom,branch' })
        .then((r) => r.data),
  })
  const inventories = (inventoriesData as any)?.data ?? []

  useEffect(() => {
    if (initialData && mode === 'edit') {
      reset(initialData)
    }
  }, [initialData, mode])

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      purchaseOrdersService.create({ ...values, total_price: totalPrice } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order created')
      router.push('/purchase/purchase-orders')
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to create purchase order'),
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      purchaseOrdersService.update(orderId!, { ...values, total_price: totalPrice } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-order-detail', orderId] })
      toast.success('Purchase order updated')
      router.push(`/purchase/purchase-orders/${orderId}/detail`)
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to update purchase order'),
  })

  const onSubmit = (values: FormValues) => {
    if (mode === 'edit' && orderId) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  // ── Shared styles ───────────────────────────────────────────────────────────

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

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none' as any,
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

  const lineInputStyle: React.CSSProperties = {
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

  return (
    <div
      style={{
        padding: '32px 32px 64px',
        maxWidth: 960,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* Back button + title row */}
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
            {mode === 'edit' ? 'Edit Purchase Order' : 'New Purchase Order'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            {mode === 'edit'
              ? 'Update the details of this purchase order'
              : 'Fill in the details below to create a new purchase order'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        {/* Section 1 — Order Details */}
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionLabelStyle}>Order Details</span>
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
              <label style={labelStyle}>Order Code</label>
              <input
                {...register('code')}
                placeholder="e.g. PO-2026-001"
                style={errors.code ? inputErrorStyle : inputStyle}
              />
              {errors.code && <span style={errorStyle}>{errors.code.message}</span>}
            </div>

            {/* Date */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>Order Date</label>
              <input
                type="date"
                {...register('date')}
                style={errors.date ? inputErrorStyle : inputStyle}
              />
              {errors.date && <span style={errorStyle}>{errors.date.message}</span>}
            </div>

            {/* Supplier */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>Supplier</label>
              <Controller
                name="supplier_id"
                control={control}
                render={({ field }) => (
                  <select
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    style={{
                      ...selectStyle,
                      border: `1px solid ${errors.supplier_id ? 'var(--destructive)' : 'var(--border)'}`,
                    }}
                  >
                    <option value={0} disabled>Select supplier</option>
                    {suppliers.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              />
              {errors.supplier_id && (
                <span style={errorStyle}>{errors.supplier_id.message}</span>
              )}
            </div>

            {/* Branch */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>Branch</label>
              <Controller
                name="branch_id"
                control={control}
                render={({ field }) => (
                  <select
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    style={{
                      ...selectStyle,
                      border: `1px solid ${errors.branch_id ? 'var(--destructive)' : 'var(--border)'}`,
                    }}
                  >
                    <option value={0} disabled>Select branch</option>
                    {branches.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                )}
              />
              {errors.branch_id && (
                <span style={errorStyle}>{errors.branch_id.message}</span>
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
                      const isSelected = field.value === s
                      const isPending = s === 'pending'
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
                              ? isPending
                                ? 'var(--warning-bg)'
                                : 'var(--success-bg)'
                              : 'var(--background)',
                            color: isSelected
                              ? isPending
                                ? 'var(--warning)'
                                : 'var(--success)'
                              : 'var(--foreground-muted)',
                            border: isSelected
                              ? isPending
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

            {/* Notes — full width */}
            <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
              <label style={labelStyle}>Notes</label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Optional order notes"
                style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }}
              />
            </div>
          </div>
        </div>

        {/* Section 2 — Line Items */}
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
            <span style={sectionLabelStyle}>Line Items</span>
            <button
              type="button"
              onClick={() =>
                append({ product_inventory_id: 0, qty: 1, price: 0, description: '' })
              }
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

          {/* Column headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 100px 130px 1fr 40px',
              gap: 10,
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--background)',
            }}
          >
            {['Product / UOM', 'Qty', 'Unit Price', 'Notes', ''].map((h, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--foreground-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Line item rows */}
          {fields.map((field, index) => (
            <div
              key={field.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 100px 130px 1fr 40px',
                gap: 10,
                padding: '12px 20px',
                borderBottom: '1px solid var(--border)',
                alignItems: 'start',
              }}
            >
              {/* Product Inventory */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Controller
                  name={`details.${index}.product_inventory_id`}
                  control={control}
                  render={({ field: f }) => (
                    <select
                      value={f.value ?? 0}
                      onChange={(e) => f.onChange(Number(e.target.value))}
                      style={{
                        ...lineInputStyle,
                        cursor: 'pointer',
                        border: `1px solid ${
                          errors.details?.[index]?.product_inventory_id
                            ? 'var(--destructive)'
                            : 'var(--border)'
                        }`,
                      }}
                    >
                      <option value={0} disabled>Select product</option>
                      {inventories.map((inv: any) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.product_uom?.product?.name ?? inv.id}
                          {' — '}
                          {inv.product_uom?.uom?.code ?? ''}
                          {' ('}
                          {inv.branch?.name ?? 'Unknown'}
                          {') — Stock: '}
                          {inv.qty}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.details?.[index]?.product_inventory_id && (
                  <span style={{ fontSize: 11, color: 'var(--destructive)' }}>
                    {errors.details[index]!.product_inventory_id!.message}
                  </span>
                )}
              </div>

              {/* Qty */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  {...register(`details.${index}.qty`, { valueAsNumber: true })}
                  style={lineInputStyle}
                />
              </div>

              {/* Price */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input
                  type="number"
                  min={0}
                  step={100}
                  {...register(`details.${index}.price`, { valueAsNumber: true })}
                  style={lineInputStyle}
                />
              </div>

              {/* Description */}
              <input
                {...register(`details.${index}.description`)}
                placeholder="Optional note"
                style={lineInputStyle}
              />

              {/* Delete */}
              <button
                type="button"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
                style={{
                  padding: 6,
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

          {/* Total row */}
          <div
            style={{
              padding: '14px 20px',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 12,
              borderTop: '1px solid var(--border)',
              background: 'var(--background)',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Total</span>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--accent)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {'Rp ' + totalPrice.toLocaleString('id-ID')}
            </span>
          </div>

          {/* Array-level error */}
          {errors.details && typeof (errors.details as any).message === 'string' && (
            <div style={{ padding: '8px 20px' }}>
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {(errors.details as any).message}
              </span>
            </div>
          )}
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
              : isPending ? 'Creating...' : 'Create Purchase Order'}
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
