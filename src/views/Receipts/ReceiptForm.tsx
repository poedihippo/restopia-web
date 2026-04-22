'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { receiptsService } from '@/services/receipts.service'
import { deliveriesService } from '@/services/deliveries.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { toastMutationApiError } from '@/utils/apiError'
import { Plus, Trash2, ArrowLeft, Loader2, Save } from 'lucide-react'

const detailSchema = z.object({
  product_inventory_id: z.coerce.number().min(0, 'Inventory item required'),
  delivery_detail_id: z.coerce.number().optional(),
  qty: z.coerce.number().min(0.001, 'Qty required'),
  price: z.coerce.number().min(0, 'Price required'),
  status: z.enum(['pending', 'final']),
  description: z.string().optional(),
  client_ref: z.string().optional(),
})

const schema = z.object({
  code: z.string().min(1, 'Code required'),
  delivery_id: z.coerce.number().min(0, 'Delivery is required'),
  date: z.string().min(1, 'Date required'),
  status: z.enum(['pending', 'final']),
  description: z.string().optional(),
  details: z.array(detailSchema).min(1, 'At least one item required'),
})

type FormValues = z.infer<typeof schema>

interface ReceiptFormProps {
  mode: 'create' | 'edit'
  initialData?: any
  receiptId?: number
}

export default function ReceiptForm(props: ReceiptFormProps) {
  const { mode, initialData, receiptId } = props
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
      delivery_id: 0,
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      description: '',
      details: [
        {
          product_inventory_id: 0,
          delivery_detail_id: undefined,
          qty: 1,
          price: 0,
          status: 'pending',
          description: '',
          client_ref: '',
        },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'details' })

  const watchDetails = watch('details')
  const totalPrice = watchDetails.reduce(
    (sum, d) => sum + Number(d.qty ?? 0) * Number(d.price ?? 0),
    0
  )

  const { data: deliveriesData } = useQuery({
    queryKey: ['deliveries-pending'],
    queryFn: () =>
      deliveriesService
        .list({ per_page: 100, 'filter[status]': 'pending' } as any)
        .then((r) => r.data),
  })
  const deliveries = (deliveriesData as any)?.data ?? []

  const { data: inventoriesData } = useQuery({
    queryKey: ['product-inventories-all'],
    queryFn: () =>
      productInventoriesService
        .list({ per_page: 200, include: 'branch' } as any)
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
      receiptsService.create({ ...values, total_price: totalPrice } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      toast.success('Receipt created')
      router.push('/transfer/receipts')
    },
    onError: (err: any) => {
      console.log('createMutation error', err)
      toastMutationApiError(err, 'Failed to create receipt')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      receiptsService.update(receiptId!, { ...values, total_price: totalPrice } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['receipt-detail', receiptId] })
      toast.success('Receipt updated')
      router.push(`/transfer/receipts/${receiptId}/detail`)
    },
    onError: (err: any) => {
      console.log('updateMutation error', err)
      toastMutationApiError(err, 'Failed to update receipt')
    },
  })

  const onSubmit = (values: FormValues) => {
    console.log('ReceiptForm onSubmit called', { ...values, total_price: totalPrice })
    if (mode === 'edit' && receiptId) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const onInvalid = (errs: any) => {
    console.log('ReceiptForm validation errors:', errs)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

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
        maxWidth: 1000,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
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
            {mode === 'edit' ? 'Edit Receipt' : 'New Receipt'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            {mode === 'edit' ? 'Update receipt details' : 'Record goods received from a delivery'}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--foreground-subtle)' }}>
          <span style={{ color: 'var(--destructive)' }}>*</span>
          <span>Required fields</span>
        </div>
        {/* Section 1 — Receipt Info */}
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionLabelStyle}>Receipt Info</span>
          </div>
          <div
            style={{
              padding: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Receipt Code
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <input
                {...register('code')}
                placeholder="e.g. RCP-2026-001"
                style={errors.code ? inputErrorStyle : inputStyle}
              />
              {errors.code && <span style={errorStyle}>{errors.code.message}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Receipt Date
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <input
                type="date"
                {...register('date')}
                style={errors.date ? inputErrorStyle : inputStyle}
              />
              {errors.date && <span style={errorStyle}>{errors.date.message}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Linked Delivery
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <Controller
                name="delivery_id"
                control={control}
                render={({ field }) => (
                  <select
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    style={{
                      ...selectStyle,
                      border: `1px solid ${
                        errors.delivery_id ? 'var(--destructive)' : 'var(--border)'
                      }`,
                    }}
                  >
                    <option value={0} disabled>
                      Select delivery
                    </option>
                    {deliveries.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — Rp {(d.total_price ?? 0).toLocaleString('id-ID')}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.delivery_id && (
                <span style={errorStyle}>{errors.delivery_id.message}</span>
              )}
            </div>

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
                      const isSelected = field.value === s
                      const isPendingOpt = s === 'pending'
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
                              ? isPendingOpt
                                ? 'var(--warning-bg)'
                                : 'var(--success-bg)'
                              : 'var(--background)',
                            color: isSelected
                              ? isPendingOpt
                                ? 'var(--warning)'
                                : 'var(--success)'
                              : 'var(--foreground-muted)',
                            border: isSelected
                              ? isPendingOpt
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

            <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
              <label style={labelStyle}>Notes</label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Optional notes"
                style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }}
              />
            </div>
          </div>
        </div>

        {/* Section 2 — Receipt Items */}
        <div style={cardStyle}>
          <div
            style={{
              ...sectionHeaderStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={sectionLabelStyle}>Received Items</span>
            <button
              type="button"
              onClick={() =>
                append({
                  product_inventory_id: 0,
                  delivery_detail_id: undefined,
                  qty: 1,
                  price: 0,
                  status: 'pending',
                  description: '',
                  client_ref: '',
                })
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 90px 120px 100px 120px 1fr 40px',
              gap: 10,
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--background)',
            }}
          >
            {['Inventory', 'Qty', 'Price', 'Status', 'Client Ref', 'Notes', ''].map((h, i) => (
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

          {fields.map((field, index) => (
            <div
              key={field.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 90px 120px 100px 120px 1fr 40px',
                gap: 10,
                padding: '12px 20px',
                borderBottom: '1px solid var(--border)',
                alignItems: 'start',
              }}
            >
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
                      <option value={0} disabled>
                        Select inventory
                      </option>
                      {inventories.map((inv: any) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.code ?? 'INV-' + inv.id} ({inv.branch?.name ?? ''}) — Stock:{' '}
                          {inv.qty ?? 0}
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

              <input
                type="number"
                min={0.001}
                step={0.001}
                {...register(`details.${index}.qty`, { valueAsNumber: true })}
                style={lineInputStyle}
              />

              <input
                type="number"
                min={0}
                step={100}
                {...register(`details.${index}.price`, { valueAsNumber: true })}
                style={lineInputStyle}
              />

              <Controller
                name={`details.${index}.status`}
                control={control}
                render={({ field: f }) => (
                  <select
                    value={f.value}
                    onChange={(e) => f.onChange(e.target.value)}
                    style={{ ...lineInputStyle, cursor: 'pointer' }}
                  >
                    <option value="pending">Pending</option>
                    <option value="final">Final</option>
                  </select>
                )}
              />

              <input
                {...register(`details.${index}.client_ref`)}
                placeholder="Ref code"
                style={lineInputStyle}
              />

              <input
                {...register(`details.${index}.description`)}
                placeholder="Note"
                style={lineInputStyle}
              />

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
              ? isPending
                ? 'Saving...'
                : 'Save Changes'
              : isPending
              ? 'Creating...'
              : 'Create Receipt'}
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
