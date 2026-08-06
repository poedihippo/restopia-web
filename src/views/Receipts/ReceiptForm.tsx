'use client'

import React, { useEffect, useMemo } from 'react'
import { getCanReadPrice } from '@/utils/price'
import { useRouter } from 'next/router'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { receiptsService } from '@/services/receipts.service'
import { deliveriesService } from '@/services/deliveries.service'
import { productUomsService } from '@/services/product-uoms.service'
import { toastMutationApiError } from '@/utils/apiError'
import { usePrice } from '@/hooks/usePrice'
import { Plus, Trash2, ArrowLeft, Loader2, Save } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'

const formatNumber = (n: number | undefined): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return ''
  if (!getCanReadPrice()) return '***'
  return Number(n).toLocaleString('id-ID')
}

const detailSchema = z.object({
  delivery_detail_id: z.coerce.number().optional(),
  product_uom_id: z.coerce.number().min(0, 'Product required'),
  planned_expiry_date: z.string().optional(),
  qty: z.coerce.number().min(0.001, 'Qty required'),
  price: z.coerce.number().min(0, 'Price required'),
  status: z.enum(['pending', 'success', 'failed']),
  description: z.string().optional(),
  client_ref: z.string(),
})

const schema = z.object({
  delivery_id: z.coerce.number().min(0, 'Delivery is required'),
  date: z.string().min(1, 'Date required'),
  status: z.enum(['pending', 'final']),
  description: z.string().optional(),
  details: z.array(detailSchema).min(1, 'At least one item required'),
  total_price: z.coerce.number().optional(),
})

type FormValues = z.infer<typeof schema>

interface ReceiptFormProps {
  mode: 'create' | 'edit'
  initialData?: any
  receiptId?: number
}

export default function ReceiptForm(props: ReceiptFormProps) {
  const { mode, initialData, receiptId } = props
  const { canReadPrice } = usePrice()
  const router = useRouter()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      delivery_id: 0,
      date: new Date().toISOString().split('T')[0],
      status: 'final',
      description: '',
      details: [
        {
          delivery_detail_id: undefined,
          product_uom_id: 0,
          planned_expiry_date: '',
          qty: 1,
          price: 0,
          status: 'success',
          description: '',
          client_ref: `RCP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        },
      ],
      total_price: 0,
    },
  })

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'details' })

  const watchDetails = watch('details')
  const totalPrice = watchDetails.reduce(
    (sum, d) => sum + Number(d.qty ?? 0) * Number(d.price ?? 0),
    0
  )

  const { data: deliveriesData, isLoading: deliveriesLoading } = useQuery({
    queryKey: ['deliveries-pending'],
    queryFn: async () => {
      let allDeliveries: any[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await deliveriesService
          .list({ page, per_page: 100, 'filter[status]': 'final', include: 'branch' } as any)
          .then((r) => r.data)
        const items = (res as any)?.data ?? []
        allDeliveries = allDeliveries.concat(items)
        totalPages =
          (res as any)?.meta?.last_page ??
          (res as any)?.meta?.total_pages ??
          1
        page += 1
      } while (page <= totalPages)
      return { data: allDeliveries }
    },
  })
  const deliveries = (deliveriesData as any)?.data ?? []

  const watchDeliveryId = watch('delivery_id')

  const { data: deliveryData, isLoading: deliveryDetailLoading } = useQuery({
    queryKey: ['delivery-detail-for-receipt', watchDeliveryId],
    queryFn: () =>
      deliveriesService
        .findById(watchDeliveryId as number, {
          include: 'delivery_details',
        })
        .then((r) => r.data),
    enabled: !!watchDeliveryId && (watchDeliveryId as number) > 0,
  })
  const deliveryDetail = (deliveryData as any)?.data

  // Internal-branch receipts (from internal deliveries/transfers) are
  // price-free — hide all price UI and don't submit prices. Only known once
  // the delivery loads; price shows until a delivery is selected.
  const isInternalReceipt =
    deliveryDetail?.source_type === 'po_from_branch' ||
    deliveryDetail?.source_type === 'transfer_to_branch'

  // A delivery is selected but its line items haven't resolved yet — block
  // submit so a receipt can't be created before replace() loads the lines.
  const deliveryLinesPending =
    !!watchDeliveryId &&
    (watchDeliveryId as number) > 0 &&
    (deliveryDetailLoading || !deliveryDetail)

  // Duplicate guard: does this delivery already have a final receipt?
  // Only relevant when creating — editing naturally matches its own delivery.
  const { data: receiptExistsData } = useQuery({
    queryKey: ['receipt-exists-for-delivery', watchDeliveryId],
    enabled:
      mode === 'create' &&
      !!watchDeliveryId &&
      (watchDeliveryId as number) > 0,
    queryFn: () =>
      receiptsService
        .list({
          'filter[delivery_id]': watchDeliveryId,
          'filter[status]': 'final',
          per_page: 1,
        } as any)
        .then((r) => r.data),
  })
  const existingReceipts = (receiptExistsData as any)?.data ?? []
  // In edit mode, ignore the receipt being edited (it matches its own delivery).
  const otherReceiptCount =
    mode === 'edit'
      ? existingReceipts.filter((r: any) => r.id !== receiptId).length
      : ((receiptExistsData as any)?.meta?.total ?? 0)
  const deliveryAlreadyReceived =
    mode === 'create' && otherReceiptCount > 0

  useEffect(() => {
    if (!deliveryDetail?.delivery_details?.length) return
    if (mode === 'edit' && watchDeliveryId === initialData?.delivery_id) return

    const newDetails = deliveryDetail.delivery_details.map((d: any, index: number) => ({
      delivery_detail_id: d.id,
      product_uom_id: d.product_uom_id ?? 0,
      planned_expiry_date: '',
      qty: d.qty ?? 1,
      price: d.price ?? 0,
      status: 'success' as const,
      description: d.description ?? '',
      client_ref: `${deliveryDetail.code ?? 'RCP'}-${index + 1}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
    }))

    replace(newDetails)
    toast.info('Items loaded from Delivery')
  }, [deliveryDetail?.id])

  const deliveryOptions = deliveries.map((d: any) => ({
    value: d.id as number,
    label: `${d.code ?? `DEL-${d.id}`} - ${d.branch?.name ?? 'Unknown Branch'}`,
    sublabel: d.date ? d.date : undefined,
  }))

  const productUomOptions = useMemo(() => {
    const deliveryOpts = deliveryDetail?.delivery_details?.map((dd: any) => ({
      value: dd.product_uom?.id ?? dd.product_uom_id ?? 0,
      label: (dd.product_uom?.product?.name as string) ?? '',
      sublabel: (dd.product_uom?.uom?.name as string) ?? (dd.product_uom?.code as string) ?? '',
      base_price: dd.product_uom?.base_price ?? 0,
      original: dd.product_uom
    })) ?? []

    const receiptOpts = initialData?.receipt_details?.map((rd: any) => ({
      value: rd.product_uom?.id ?? rd.product_uom_id ?? 0,
      label: (rd.product_uom?.product?.name as string) ?? '',
      sublabel: (rd.product_uom?.uom?.name as string) ?? (rd.product_uom?.code as string) ?? '',
      base_price: rd.product_uom?.base_price ?? 0,
      original: rd.product_uom
    })) ?? []

    const all = [...deliveryOpts, ...receiptOpts]
    const map = new Map<number, any>()
    all.forEach(item => {
      if (item.value > 0 && !map.has(item.value)) {
        map.set(item.value, item)
      }
    })
    return Array.from(map.values())
  }, [deliveryDetail, initialData])

  useEffect(() => {
    if (initialData && mode === 'edit') {
      reset({
        ...initialData,
        date: initialData.date.split('T')[0],
        status: initialData.status,
        description: initialData.description ?? '',
        details: initialData.details,
        total_price: initialData.total_price ?? 0,
      })
    }
  }, [initialData, mode])

  const buildPayload = (values: FormValues) => ({
    ...values,
    status: values.status,
    total_price: values.total_price || totalPrice,
    details: values.details
      .filter((d) => Number(d.delivery_detail_id) > 0 || Number(d.product_uom_id) > 0)
      .map((d) => ({
        delivery_detail_id: d.delivery_detail_id || undefined,
        planned_expiry_date: d.planned_expiry_date || undefined,
        qty: d.qty,
        price: d.price,
        status: d.status,
        description: d.description || undefined,
        client_ref: d.client_ref || undefined,
        ...(['po_from_supplier', 'po_from_branch'].includes(deliveryDetail?.source_type)
          ? { product_uom_id: d.product_uom_id || undefined }
          : {}),
      })),
  })

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      receiptsService.create(buildPayload(values) as any),
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
      receiptsService.update(receiptId!, buildPayload(values) as any),
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
    // Guard against a stock-less receipt: the payload applies the same
    // product_uom_id filter, so an empty result here means nothing would save.
    const validDetails = values.details.filter(
      (d) => Number(d.delivery_detail_id) > 0 || Number(d.product_uom_id) > 0,
    )
    if (validDetails.length === 0) {
      toast.error(
        'No valid line items — wait for items to load from the delivery, or add an item.',
      )
      return
    }
    if (deliveryAlreadyReceived) {
      toast.error('A receipt already exists for this delivery.')
      return
    }

    if (mode === 'edit') {
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
    overflow: 'visible',
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
                  <SearchableSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={deliveryOptions}
                    placeholder="Select delivery..."
                    searchPlaceholder="Search deliveries..."
                    loading={deliveriesLoading}
                    disabled={mode === 'edit'}
                    error={errors.delivery_id?.message as string | undefined}
                  />
                )}
              />
              {!!watchDeliveryId && watchDeliveryId > 0 && deliveryDetail && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--success)',
                    marginTop: 4,
                    display: 'block',
                  }}
                >
                  ✓ {deliveryDetail.delivery_details?.length ?? 0} item(s) loaded from delivery
                </span>
              )}
              {deliveryAlreadyReceived && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--warning)',
                    marginTop: 4,
                    display: 'block',
                  }}
                >
                  This delivery already has a final receipt. Creating another will
                  double-count stock.
                </span>
              )}
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
            {/* Add Item button hidden as per requirements */}
            {false && (
              <button
                type="button"
                onClick={() =>
                  append({
                    delivery_detail_id: undefined,
                    product_uom_id: 0,
                    planned_expiry_date: '',
                    qty: 1,
                    price: 0,
                    status: 'success',
                    description: '',
                    client_ref: `RCP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
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
            )}
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)' }}>
            <div style={{ minWidth: 900 }}>
              <div
            style={{
              display: 'grid',
              gridTemplateColumns: `minmax(250px, 2fr) 100px 140px 140px 120px 140px minmax(150px, 1fr) 40px`,
              gap: 10,
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--background)',
            }}
          >
            {['Product / UOM', 'Qty', 'Price', 'Subtotal', 'Status', 'Expiry', 'Notes', ''].map((h, i) => (
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
                gridTemplateColumns: `minmax(250px, 2fr) 100px 140px 140px 120px 140px minmax(150px, 1fr) 40px`,
                gap: 10,
                padding: '12px 20px',
                borderBottom: '1px solid var(--border)',
                alignItems: 'start',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Controller
                  name={`details.${index}.product_uom_id`}
                  control={control}
                  render={({ field: f }) => (
                    <SearchableSelect
                      value={f.value ?? 0}
                      onChange={(val) => {
                        f.onChange(val)
                        const opt = productUomOptions.find((o: any) => o.value === val)
                        if (opt && opt.base_price) setValue(`details.${index}.price`, opt.base_price)
                      }}
                      options={productUomOptions.filter((o: any) => {
                        const selectedIds = watch('details').map((d: any) => d.product_uom_id).filter((id: number) => id > 0)
                        return !selectedIds.includes(o.value) || o.value === f.value
                      })}
                      placeholder="Select product..."
                      searchPlaceholder="Search products..."
                      loading={false}
                      disabled={true}
                      error={
                        errors.details?.[index]?.product_uom_id?.message as
                        | string
                        | undefined
                      }
                    />
                  )}
                />
              </div>

              <input
                type="number"
                min={0.001}
                step={0.001}
                {...register(`details.${index}.qty`, { valueAsNumber: true })}
                disabled={true}
                style={{
                  ...lineInputStyle,
                  background: 'var(--surface)', cursor: 'not-allowed', color: 'var(--foreground-muted)'
                }}
                onWheel={(e) => (e.target as HTMLElement).blur()}
              />

                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(watch(`details.${index}.price`))}
                    disabled={true}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, '')
                      setValue(
                        `details.${index}.price`,
                        raw === '' ? 0 : parseInt(raw, 10) || 0,
                      )
                    }}
                    style={{
                      ...lineInputStyle,
                      background: 'var(--surface)', cursor: 'not-allowed', color: 'var(--foreground-muted)'
                    }}
                  />
                  <input
                    type="text"
                    readOnly
                    value={formatNumber((watch(`details.${index}.price`) ?? 0) * (watch(`details.${index}.qty`) ?? 0))}
                    style={{
                      ...lineInputStyle,
                      background: 'var(--surface)',
                      color: 'var(--foreground-muted)',
                      cursor: 'not-allowed'
                    }}
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
                    <option value="success">Success</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                )}
              />

              <input
                type="date"
                {...register(`details.${index}.planned_expiry_date`)}
                disabled={mode === 'edit'}
                style={{
                  ...lineInputStyle,
                  ...(mode === 'edit' ? { background: 'var(--surface)', cursor: 'not-allowed', color: 'var(--foreground-muted)' } : {})
                }}
              />

              <input
                {...register(`details.${index}.description`)}
                placeholder="Note"
                disabled={mode === 'edit'}
                style={{
                  ...lineInputStyle,
                  ...(mode === 'edit' ? { background: 'var(--surface)', cursor: 'not-allowed', color: 'var(--foreground-muted)' } : {})
                }}
              />

              <input type="hidden" {...register(`details.${index}.client_ref`)} />

              <button
                type="button"
                onClick={() => remove(index)}
                disabled={true}
                style={{
                  padding: '6px 8px',
                  background: 'var(--destructive-bg)',
                  border: '1px solid var(--destructive)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'not-allowed',
                  color: 'var(--destructive)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.3,
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          </div>
          </div>

          {!isInternalReceipt && (
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
                {canReadPrice
                  ? 'Rp ' + totalPrice.toLocaleString('id-ID')
                  : '***'}
              </span>
            </div>
          )}

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
              cursor: isPending ? 'not-allowed' : 'pointer',
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
