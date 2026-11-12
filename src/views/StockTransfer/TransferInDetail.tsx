'use client'
import { formatCurrency, getCanReadPrice } from '@/utils/price';
import { formatDate } from '@/utils/date';

import React, { useState,  useEffect } from 'react'
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
import { getProductUomName, withProductType } from '@/utils/productUomName'
import { useAuth } from '@/hooks/useAuth'
import { canUserCreateReceiptForDelivery } from '@/utils/receiptValidation'
import { Package, Check, Loader2 } from 'lucide-react'
import BackLink from '@/components/BackLink'
import { PriceDisplay } from '@/components/PriceDisplay'

const detailSchema = z.object({
  delivery_detail_id: z.coerce.number().optional(),
  product_uom_id: z.coerce.number().min(1, 'Product required'),
  qty: z.coerce.number().min(0.001, 'Qty required'),
  price: z.coerce.number().min(0),
  planned_expiry_date: z.string().optional(),
  status: z.enum(['pending', 'success', 'failed']),
  description: z.string().optional(),
  client_ref: z.string().min(1, 'Client ref required'),
})

const schema = z.object({
  date: z.string().min(1, 'Date required'),
  status: z.enum(['pending', 'final']),
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

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, isSuperadmin } = useAuth()
  const today = new Date().toISOString().split('T')[0]

  const { data, isLoading } = useQuery({
    queryKey: ['delivery-detail', id],
    enabled: !!id && !isNaN(id),
    queryFn: () =>
      deliveriesService
        .findById(id, {
          include:
            'branch,target_branch,delivery_details',
        } as any)
        .then((r) => r.data),
  })
  const delivery: any = (data as any)?.data

  const { data: receiptsData } = useQuery({
    queryKey: ['receipts-for-delivery', id],
    enabled: !!id && !isNaN(id),
    queryFn: () =>
      receiptsService
        .list({ 'filter[delivery_id]': id, per_page: 50, sort: '-created_at' } as any)
        .then((r) => r.data),
  })
  const existingReceipts: any[] = (receiptsData as any)?.data ?? []
  // Newest pending receipt for this delivery (list is sorted -created_at).
  // It is opened in the receipt editor — never overwritten from here.
  const pendingReceipt = existingReceipts.find((r: any) => r.status === 'pending')
  // Qty still to be received per delivery line.
  const remainingQtyOf = (d: any) =>
    Math.max(0, Number(d?.qty ?? 0) - Number(d?.received_qty ?? 0))
  const deliveryLines: any[] = delivery?.delivery_details ?? []
  const isFullyReceived =
    deliveryLines.length > 0 && deliveryLines.every((d: any) => remainingQtyOf(d) <= 0)
  const canCreate = !delivery || canUserCreateReceiptForDelivery(delivery, user, isSuperadmin)

  const { data: productUomsData, isLoading: productUomsLoading } = useQuery({
    queryKey: ['product-uoms-all', debouncedDropdownSearch],
    queryFn: () =>
      productUomsService
        .list({
          'filter[search]': debouncedDropdownSearch || undefined,
          per_page: 1000,
          include: 'product,uom',
          'filter[is_active]': true,
        } as any)
        .then((r) => r.data),
  })
  const productUoms: any[] = (productUomsData as any)?.data ?? []

  const productUomOptions = productUoms.map((pu: any) => ({
    value: pu.id as number,
    label: withProductType(getProductUomName(pu, pu.product?.name), pu.product?.type),
    sublabel: (pu.uom?.name as string) ?? '',
    description: (pu.code as string) ?? undefined,
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
      date: today,
      status: 'pending',
      description: '',
      details: [],
    },
  })

  const { fields, remove } = useFieldArray({ control, name: 'details' })

  useEffect(() => {
    if (!delivery) return
    // Only what is still left to receive; fully received lines are skipped.
    const suffix = Math.random().toString(36).substring(2, 5).toUpperCase()
    const lines = (delivery.delivery_details ?? [])
      .filter((d: any) => remainingQtyOf(d) > 0)
      .map((d: any, index: number) => ({
        delivery_detail_id: d.id,
        product_uom_id: d.product_uom_id ?? d.product_uom?.id ?? 0,
        qty: remainingQtyOf(d),
        price: d.price ?? 0,
        planned_expiry_date: '',
        status: 'success' as const,
        description: '',
        client_ref: `${delivery.code ?? `DEL-${id}`}-${index + 1}-${suffix}`,
      }))
    // Receipt code is numbered by the backend — never derive it from the delivery code.
    reset({
      date: today,
      status: 'pending',
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
        delivery_id: id,
        date: values.date,
        total_price: totalPrice,
        status: values.status,
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
      // Always a new receipt (for the remaining qty) — an existing pending
      // receipt is edited on its own page instead of being overwritten.
      return receiptsService.create(payload as any)
    },
    onSuccess: () => {
      toast.success('Stock received successfully')
      queryClient.invalidateQueries({ queryKey: ['receipts-for-delivery', id] })
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['delivery-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['deliveries-transfer-in'] })
      router.push('/transfer/stock-transfer')
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? 'Failed to receive stock'),
  })

  const onSubmit = (values: FormValues) => {
    if (delivery && !canCreate) {
      toast.error(
        `Penerimaan hanya dapat dikonfirmasi oleh cabang penerima (${delivery?.target_branch?.name ?? 'Cabang Tujuan'})`
      )
      return
    }
    createReceiptMutation.mutate(values)
  }

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
    background: 'var(--surface-raised)',
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
        <BackLink href="/transfer/stock-transfer" label="Stock Transfers" style={{ marginTop: 16 }} />
      </div>
    )
  }

  const statusMeta = STATUS_META[delivery.status as string] ?? STATUS_META.pending

  return (
    <div
      style={{
        padding: '32px 32px 64px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <BackLink href="/transfer/stock-transfer" label="Stock Transfers" />
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
                ? formatDate(delivery.date)
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
              <PriceDisplay amount={Number(delivery.total_price ?? 0)} />
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

      {/* {alreadyReceipted && (
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
                      textAlign: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--foreground-muted)',
                      textTransform: 'uppercase',
                      width: 50,
                    }}
                  >
                    No.
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
                {existingReceipts.map((r: any, idx: number) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--foreground-muted)', textAlign: 'center' }}>
                      {idx + 1}
                    </td>
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
                        ? formatDate(r.date)
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
                      <PriceDisplay amount={r.total_price ?? 0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )} */}

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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div>
              <label style={labelStyle}>
                Receipt Code
              </label>
              <input
                value="Dibuat otomatis"
                disabled
                readOnly
                style={{ ...inputStyle, color: 'var(--foreground-muted)' }}
              />
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
            <div>
              <label style={labelStyle}>
                Status <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <select
                {...register('status')}
                style={inputStyle}
              >
                <option value="pending">Pending</option>
                <option value="final">Final (Sent)</option>
              </select>
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
                '2fr 70px 110px 120px 100px 130px 1fr 32px',
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
            <span>Client Ref *</span>
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
                  '2fr 70px 110px 120px 100px 130px 1fr 32px',
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
                    options={productUomOptions.filter((o: any) => {
                      const selectedIds = watch('details').map((d: any) => d.product_uom_id).filter((id: number) => id > 0)
                      return !selectedIds.includes(o.value) || o.value === f.value
                    })}
                    placeholder="Select product..."
                    searchPlaceholder="Search products..."
                    loading={productUomsLoading}
                    error={
                      errors.details?.[index]?.product_uom_id?.message as
                      | string
                      | undefined
                    }
                    onSearchChange={setDropdownSearch}
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
              {getCanReadPrice() ? (
                <input
                  type="number"
                  min={0}
                  step={0.001}
                  {...register(`details.${index}.price`, { valueAsNumber: true })}
                  style={inputStyle}
                />
              ) : (
                <input
                  type="text"
                  value="***"
                  disabled
                  style={{ ...inputStyle, background: 'var(--surface)', cursor: 'not-allowed' }}
                />
              )}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input
                  {...register(`details.${index}.client_ref`)}
                  placeholder="e.g. DEL-001-1"
                  style={
                    errors.details?.[index]?.client_ref
                      ? { ...inputStyle, border: '1px solid var(--destructive)' }
                      : inputStyle
                  }
                />
                {errors.details?.[index]?.client_ref && (
                  <span style={{ fontSize: 11, color: 'var(--destructive)' }}>
                    {errors.details[index]!.client_ref!.message}
                  </span>
                )}
              </div>
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
              <PriceDisplay amount={totalPrice} />
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={() => router.push('/transfer/stock-transfer')}
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
          {canCreate && pendingReceipt ? (
            <button
              type="button"
              onClick={() => router.push(`/transfer/receipts/${pendingReceipt.id}/edit`)}
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
                cursor: 'pointer',
              }}
            >
              <Check size={16} />
              Open Pending Receipt
            </button>
          ) : canCreate ? (
            <button
              type="submit"
              disabled={createReceiptMutation.isPending || isFullyReceived}
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
                cursor: createReceiptMutation.isPending || isFullyReceived ? 'not-allowed' : 'pointer',
                opacity: createReceiptMutation.isPending || isFullyReceived ? 0.7 : 1,
              }}
            >
              {createReceiptMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {isFullyReceived ? 'Fully Received' : 'Confirm Receipt'}
            </button>
          ) : (
            <span
              style={{
                fontSize: 13,
                color: 'var(--warning)',
                fontWeight: 500,
                alignSelf: 'center',
              }}
            >
              Penerimaan hanya dapat dikonfirmasi oleh cabang penerima ({delivery?.target_branch?.name ?? 'Cabang Tujuan'})
            </span>
          )}
        </div>
      </form>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
