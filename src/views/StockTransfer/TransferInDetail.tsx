'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deliveriesService } from '@/services/deliveries.service'
import { receiptsService } from '@/services/receipts.service'
import SearchableSelect from '@/components/SearchableSelect'
import { productUomsService } from '@/services/product-uoms.service'
import { ArrowLeft, Package, Check, Loader2 } from 'lucide-react'

const detailSchema = z.object({
  delivery_detail_id: z.coerce.number().optional(),
  product_uom_id: z.coerce.number().min(1, 'Product required'),
  qty: z.coerce.number().min(0.001, 'Qty required'),
  price: z.coerce.number().min(0),
  planned_expiry_date: z.string().optional(),
  status: z.enum(['pending', 'success', 'failed']),
  description: z.string().optional(),
  client_ref: z.string().optional(),
})

const schema = z.object({
  code: z.string().min(1, 'Receipt code required'),
  date: z.string().min(1, 'Date required'),
  description: z.string().optional(),
  details: z.array(detailSchema).min(1),
})

type FormValues = z.infer<typeof schema>

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  final: { label: 'Sent', color: 'var(--success)', bg: 'var(--success-bg)' },
}

interface TransferInDetailProps {
  id: number
}

export default function TransferInDetail({ id }: TransferInDetailProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, isLoading } = useQuery({
    queryKey: ['delivery-detail', id],
    enabled: !!id && !isNaN(id),
    queryFn: () =>
      deliveriesService
        .findById(id, {
          include:
            'branch,target_branch,delivery_details.product_uom.product,delivery_details.product_uom.uom',
        } as any)
        .then((r) => r.data),
  })
  const delivery: any = (data as any)?.data

  const { data: receiptsData } = useQuery({
    queryKey: ['receipts-for-delivery', id],
    enabled: !!id && !isNaN(id),
    queryFn: () =>
      receiptsService
        .list({ 'filter[delivery_id]': id, per_page: 5 } as any)
        .then((r) => r.data),
  })
  const existingReceipts: any[] = (receiptsData as any)?.data ?? []
  const alreadyReceipted = existingReceipts.length > 0

  const { data: productUomsData, isLoading: productUomsLoading } = useQuery({
    queryKey: ['product-uoms-all'],
    queryFn: () =>
      productUomsService
        .list({ per_page: 200, include: 'product,uom' } as any)
        .then((r) => r.data),
  })
  const productUoms: any[] = (productUomsData as any)?.data ?? []

  const productUomOptions = productUoms.map((pu: any) => ({
    value: pu.id as number,
    label: (pu.product?.name as string) ?? '',
    sublabel: (pu.uom?.name as string) ?? (pu.code as string) ?? '',
  }))

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      code: '',
      date: today,
      description: '',
      details: [],
    },
  })

  const { fields, remove } = useFieldArray({ control, name: 'details' })

  useEffect(() => {
    if (!delivery) return
    const lines = (delivery.delivery_details ?? []).map((d: any) => ({
      delivery_detail_id: d.id,
      product_uom_id: d.product_uom_id ?? d.product_uom?.id ?? 0,
      qty: d.qty ?? 1,
      price: d.price ?? 0,
      planned_expiry_date: '',
      status: 'success' as const,
      description: '',
      client_ref: '',
    }))
    reset({
      code: `RCP-${delivery.code ?? id}`,
      date: today,
      description: '',
      details: lines.length > 0 ? lines : [],
    })
  }, [delivery, id, reset, today])

  const watchDetails = watch('details') ?? []
  const totalPrice = watchDetails.reduce(
    (s, d) => s + Number(d?.qty ?? 0) * Number(d?.price ?? 0),
    0,
  )

  const createReceiptMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        code: values.code,
        delivery_id: id,
        date: values.date,
        total_price: totalPrice,
        status: 'final',
        description: values.description || undefined,
        details: values.details
          .filter((d) => Number(d.product_uom_id) > 0)
          .map((d) => ({
            delivery_detail_id: d.delivery_detail_id || undefined,
            product_uom_id: d.product_uom_id,
            planned_expiry_date: d.planned_expiry_date || undefined,
            qty: d.qty,
            price: d.price,
            status: d.status,
            description: d.description || undefined,
            client_ref: d.client_ref || undefined,
          })),
      }
      return receiptsService.create(payload as any)
    },
    onSuccess: () => {
      toast.success('Stock received successfully')
      queryClient.invalidateQueries({ queryKey: ['receipts-for-delivery', id] })
      queryClient.invalidateQueries({ queryKey: ['deliveries-transfer-in'] })
      router.push('/transfer/stock-transfer')
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? 'Failed to create receipt'),
  })

  const onSubmit = (values: FormValues) => createReceiptMutation.mutate(values)

  const onInvalid = (errs: any) => {
    const first = Object.values(errs)[0] as any
    toast.error(first?.message ?? 'Please review the form')
  }

  const inputStyle: React.CSSProperties = {
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

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  }

  const backBtnStyle: React.CSSProperties = {
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
  }

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 99,
              border: '3px solid var(--border)',
              borderTop: '3px solid var(--accent)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
            Loading delivery...
          </span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!delivery) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Package size={40} style={{ color: 'var(--foreground-subtle)', margin: '0 auto' }} />
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', marginTop: 12 }}>
          Delivery not found
        </p>
        <button onClick={() => router.back()} style={{ ...backBtnStyle, margin: '16px auto 0' }}>
          <ArrowLeft size={14} />
          Go back
        </button>
      </div>
    )
  }

  const statusMeta = STATUS_META[delivery.status as string] ?? STATUS_META.pending

  return (
    <div
      style={{
        padding: '32px 32px 64px',
        maxWidth: 800,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingBottom: 16,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button type="button" onClick={() => router.back()} style={backBtnStyle}>
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
            Receive Transfer
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            {delivery?.code ?? 'Loading...'}
          </p>
        </div>
      </div>

      {/* Delivery info card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 20,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <div>
            <span style={{ ...sectionLabelStyle, display: 'block', marginBottom: 4 }}>
              From Branch
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
              {delivery.branch?.name ?? '—'}
            </span>
          </div>
          <div>
            <span style={{ ...sectionLabelStyle, display: 'block', marginBottom: 4 }}>
              To Branch
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
              {delivery.target_branch?.name ?? '—'}
            </span>
          </div>
          <div>
            <span style={{ ...sectionLabelStyle, display: 'block', marginBottom: 4 }}>
              Delivery Date
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
              {delivery.date
                ? new Date(delivery.date).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })
                : '—'}
            </span>
          </div>
          <div>
            <span style={{ ...sectionLabelStyle, display: 'block', marginBottom: 4 }}>
              Status
            </span>
            <span
              style={{
                display: 'inline-flex',
                padding: '3px 10px',
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 600,
                background: statusMeta.bg,
                color: statusMeta.color,
              }}
            >
              {statusMeta.label}
            </span>
          </div>
          <div>
            <span style={{ ...sectionLabelStyle, display: 'block', marginBottom: 4 }}>
              Total
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--accent)',
                fontFamily: 'var(--font-display)',
              }}
            >
              Rp {Number(delivery.total_price ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <div>
            <span style={{ ...sectionLabelStyle, display: 'block', marginBottom: 4 }}>
              Items
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
              {delivery.delivery_details?.length ?? 0} items
            </span>
          </div>
        </div>
      </div>

      {alreadyReceipted ? (
        <div>
          <div
            style={{
              background: 'var(--success-bg)',
              border: '1px solid var(--success)',
              borderRadius: 'var(--radius-lg)',
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Check size={16} style={{ color: 'var(--success)' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>
                Already Received
              </span>
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                {existingReceipts.length} receipt(s) recorded for this delivery
              </span>
            </div>
          </div>

          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              marginTop: 16,
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--background)',
              }}
            >
              <span style={sectionLabelStyle}>Existing Receipts</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--background)' }}>
                  <th
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--foreground-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Code
                  </th>
                  <th
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--foreground-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Date
                  </th>
                  <th
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--foreground-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {existingReceipts.map((r: any) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td
                      style={{
                        padding: '10px 16px',
                        fontFamily: 'monospace',
                        fontSize: 13,
                        color: 'var(--accent)',
                        fontWeight: 600,
                      }}
                    >
                      {r.code}
                    </td>
                    <td
                      style={{
                        padding: '10px 16px',
                        fontSize: 13,
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      {r.date
                        ? new Date(r.date).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td
                      style={{
                        padding: '10px 16px',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--foreground)',
                        textAlign: 'right',
                      }}
                    >
                      Rp {Number(r.total_price ?? 0).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div>
                <label style={labelStyle}>
                  Receipt Code <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <input
                  {...register('code')}
                  placeholder="e.g. RCP-TRF-001"
                  style={{
                    ...inputStyle,
                    ...(errors.code
                      ? { border: '1px solid var(--destructive)' }
                      : {}),
                  }}
                />
                {errors.code && (
                  <span style={{ fontSize: 11, color: 'var(--destructive)' }}>
                    {errors.code.message}
                  </span>
                )}
              </div>
              <div>
                <label style={labelStyle}>
                  Date <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <input
                  type="date"
                  {...register('date')}
                  style={{
                    ...inputStyle,
                    ...(errors.date
                      ? { border: '1px solid var(--destructive)' }
                      : {}),
                  }}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Notes</label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Optional notes"
                style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }}
              />
            </div>
          </div>

          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--background)',
              }}
            >
              <span style={sectionLabelStyle}>Items to Receive</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '2fr 70px 110px 120px 100px 1fr 32px',
                gap: 8,
                padding: '10px 16px',
                borderBottom: '1px solid var(--border)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--foreground-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              <span>Product</span>
              <span>Qty</span>
              <span>Price</span>
              <span>Planned Expiry</span>
              <span>Status</span>
              <span>Notes</span>
              <span />
            </div>

            {fields.length === 0 && (
              <div
                style={{
                  padding: 24,
                  textAlign: 'center',
                  fontSize: 13,
                  color: 'var(--foreground-muted)',
                }}
              >
                Loading items...
              </div>
            )}

            {fields.map((field, index) => (
              <div
                key={field.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    '2fr 70px 110px 120px 100px 1fr 32px',
                  gap: 8,
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'start',
                }}
              >
                <Controller
                  name={`details.${index}.product_uom_id`}
                  control={control}
                  render={({ field: f }) => (
                    <SearchableSelect
                      value={f.value ?? 0}
                      onChange={f.onChange}
                      options={productUomOptions}
                      placeholder="Select product..."
                      searchPlaceholder="Search products..."
                      loading={productUomsLoading}
                      error={
                        errors.details?.[index]?.product_uom_id?.message as
                          | string
                          | undefined
                      }
                    />
                  )}
                />
                <input
                  type="number"
                  min={0.001}
                  step={0.001}
                  {...register(`details.${index}.qty`, { valueAsNumber: true })}
                  style={inputStyle}
                />
                <input
                  type="number"
                  min={0}
                  step={100}
                  {...register(`details.${index}.price`, { valueAsNumber: true })}
                  style={inputStyle}
                />
                <input
                  type="date"
                  {...register(`details.${index}.planned_expiry_date`)}
                  style={inputStyle}
                />
                <Controller
                  name={`details.${index}.status`}
                  control={control}
                  render={({ field: f }) => (
                    <select
                      value={f.value}
                      onChange={(e) => f.onChange(e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      <option value="pending">Pending</option>
                      <option value="success">Success</option>
                      <option value="failed">Failed</option>
                    </select>
                  )}
                />
                <input
                  {...register(`details.${index}.description`)}
                  placeholder="Note"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => remove(index)}
                  style={{
                    padding: 6,
                    background: 'none',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    color: 'var(--destructive)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Package size={14} />
                </button>
              </div>
            ))}

            <div
              style={{
                padding: '14px 16px',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 12,
                background: 'var(--background)',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Total:</span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                Rp {totalPrice.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={() => router.back()}
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
              type="submit"
              disabled={createReceiptMutation.isPending}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 500,
                cursor: createReceiptMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: createReceiptMutation.isPending ? 0.7 : 1,
              }}
            >
              {createReceiptMutation.isPending && (
                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              )}
              <Check size={13} />
              Confirm Receipt
            </button>
          </div>
        </form>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
