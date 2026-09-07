'use client'

import React, { useState,  useEffect, useMemo } from 'react'
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
  id: z.coerce.number().optional(),
  delivery_detail_id: z.coerce.number().optional(),
  product_uom_batch_id: z.coerce.number().optional(),
  product_uom_id: z.coerce.number().min(0, 'Product required'),
  planned_batch_code: z.string().optional(),
  planned_expiry_date: z.string().optional(),
  // A fully-received line defaults to qty 0 (nothing left to receive) and
  // must stay valid so it doesn't block submitting the rest of the receipt
  // — "at least one line has qty > 0" is enforced separately, not per-line.
  qty: z.coerce.number().min(0, 'Qty tidak boleh negatif'),
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
  location_ref: z.string().optional(),
  owner_ref: z.string().optional(),
  stage: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface ReceiptFormProps {
  mode: 'create' | 'edit'
  initialData?: any
  receiptId?: number
  prefill?: {
    delivery_id?: number
  }
}

export default function ReceiptForm(props: ReceiptFormProps) {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const { mode, initialData, receiptId, prefill } = props
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
      delivery_id: prefill?.delivery_id ?? 0,
      date: new Date().toISOString().split('T')[0],
      status: 'final',
      description: '',
      location_ref: 'GENERAL',
      owner_ref: 'GENERAL',
      stage: 'GENERAL',
      details: [
        {
          id: undefined,
          delivery_detail_id: undefined,
          product_uom_batch_id: undefined,
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
      return { data: allDeliveries.sort((a: any, b: any) => b.id - a.id) }
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

  // Delivered / received / remaining qty per delivery_detail_id. The
  // backend now supports multiple partial receipts per delivery (e8b1caad)
  // and returns received_qty per line, so "remaining" (delivered - received)
  // — not the full delivered qty — is what caps a new receipt's qty and
  // what a fresh line should default to. Sourced from the linked delivery's
  // own lines, so available in both create and edit mode as soon as a
  // delivery is linked.
  const deliveredQtyByDetailId = useMemo(() => {
    const map = new Map<number, number>()
    ;(deliveryDetail?.delivery_details ?? []).forEach((dd: any) => {
      map.set(dd.id, Number(dd.qty ?? 0))
    })
    return map
  }, [deliveryDetail])

  const receivedQtyByDetailId = useMemo(() => {
    const map = new Map<number, number>()
    ;(deliveryDetail?.delivery_details ?? []).forEach((dd: any) => {
      map.set(dd.id, Number(dd.received_qty ?? 0))
    })
    return map
  }, [deliveryDetail])

  const remainingQtyByDetailId = useMemo(() => {
    const map = new Map<number, number>()
    ;(deliveryDetail?.delivery_details ?? []).forEach((dd: any) => {
      map.set(dd.id, Math.max(0, Number(dd.qty ?? 0) - Number(dd.received_qty ?? 0)))
    })
    return map
  }, [deliveryDetail])

  // Every line fully received -> nothing left to create a new receipt for.
  // Only meaningful once the delivery's lines have actually loaded.
  const isFullyReceived =
    (deliveryDetail?.delivery_details?.length ?? 0) > 0 &&
    (deliveryDetail?.delivery_details ?? []).every(
      (dd: any) => Number(dd.qty ?? 0) - Number(dd.received_qty ?? 0) <= 0,
    )

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

  // Duplicate guard: does this delivery already have a receipt of ANY status?
  // The backend now supports multiple partial receipts per delivery
  // (e8b1caad), so an existing receipt no longer means "block" by itself —
  // it only matters combined with isFullyReceived below. Only relevant when
  // creating — editing naturally matches its own delivery.
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
  // Only block when the delivery is FULLY received — a partially received
  // delivery should let the user create an additional receipt for the
  // remainder instead of being treated as a duplicate.
  const deliveryAlreadyReceived =
    mode === 'create' && otherReceiptCount > 0 && isFullyReceived

  // The delivery is fully received and a receipt already exists for it —
  // don't let the user create a duplicate, open the existing one instead.
  useEffect(() => {
    if (mode !== 'create') return
    if (!isFullyReceived) return
    const existing = existingReceipts[0]
    if (!existing) return
    toast.error('Pengiriman ini sudah diterima sepenuhnya, membuka receipt yang sudah ada')
    router.replace(`/transfer/receipts/${existing.id}/edit`)
  }, [mode, existingReceipts, isFullyReceived, router])

  useEffect(() => {
    if (!deliveryDetail?.delivery_details?.length) return
    if (mode === 'edit' && watchDeliveryId === initialData?.delivery_id) return

    const newDetails = deliveryDetail.delivery_details.map((d: any, index: number) => ({
      delivery_detail_id: d.id,
      product_uom_batch_id: d.product_uom_batch_id ?? d.product_uom_batch?.id ?? undefined,
      product_uom_id: d.product_uom_id ?? 0,
      planned_batch_code: d.planned_batch_code ?? d.product_uom_batch?.batch_code ?? d.product_uom_batch?.code ?? '',
      planned_expiry_date: '',
      // Default to what's still remaining (delivered - received), not the
      // full delivered qty — a partially received line should only offer
      // the leftover for this new receipt. A fully received line defaults
      // to 0 and stays visible rather than being hidden.
      qty: Math.max(0, Number(d.qty ?? 0) - Number(d.received_qty ?? 0)),
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
        location_ref: initialData.location_ref ?? 'GENERAL',
        owner_ref: initialData.owner_ref ?? 'GENERAL',
        stage: initialData.stage ?? 'GENERAL',
      })
    }
  }, [initialData, mode])

  const buildPayload = (values: FormValues) => {
    const isEdit = mode === 'edit'
    const details = values.details
      // A fully received line defaults to qty 0 so it stays visible — but
      // it must never actually be submitted as a receipt detail row.
      .filter(
        (d) =>
          (Number(d.delivery_detail_id) > 0 || Number(d.product_uom_id) > 0) &&
          Number(d.qty) > 0,
      )
      .map((d) => {
        const detailBase: any = {
          id: d.id || undefined,
          delivery_detail_id: d.delivery_detail_id || undefined,
          product_uom_batch_id: d.product_uom_batch_id || undefined,
          planned_batch_code: d.planned_batch_code || undefined,
          planned_expiry_date: d.planned_expiry_date || undefined,
          qty: d.qty,
          status: d.status,
          description: d.description || undefined,
          client_ref: d.client_ref || undefined,
        }
        if (!isEdit) {
          detailBase.price = d.price
        }
        if (['po_from_supplier', 'po_from_branch'].includes(deliveryDetail?.source_type)) {
          detailBase.product_uom_id = d.product_uom_id || undefined
        }
        return detailBase
      })

    const basePayload = {
      date: values.date,
      description: values.description,
      status: values.status,
      // Receipts always land in the GENERAL pool — earmarking stock to a
      // specific company owner (e.g. Tridaya) is a deliberate Dimension
      // Transfer action, not a receipt-time choice. A receipt earmarked to
      // a company blocks GENERAL-only fulfillment with false "no stock"
      // errors, so this is hardcoded rather than read from form state.
      owner_ref: 'GENERAL',
      details,
    }

    if (isEdit) {
      return basePayload
    }

    return {
      ...basePayload,
      delivery_id: values.delivery_id,
      location_ref: values.location_ref,
      stage: values.stage,
      total_price: values.total_price || totalPrice,
    }
  }

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
    // product_uom_id + qty>0 filter, so an empty result here means nothing
    // would save (including when every line is already fully received).
    const validDetails = values.details.filter(
      (d) =>
        (Number(d.delivery_detail_id) > 0 || Number(d.product_uom_id) > 0) &&
        Number(d.qty) > 0,
    )
    if (validDetails.length === 0) {
      toast.error(
        'No valid line items — wait for items to load from the delivery, or add an item.',
      )
      return
    }
    if (deliveryAlreadyReceived) {
      toast.error('Pengiriman ini sudah diterima sepenuhnya.')
      return
    }

    const overReceived = values.details.find((d) => {
      const remaining = remainingQtyByDetailId.get(d.delivery_detail_id as number)
      return remaining !== undefined && Number(d.qty) > remaining
    })
    if (overReceived) {
      toast.error('Qty diterima melebihi sisa yang belum diterima.')
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
    background: 'var(--surface-raised)',
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
    borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
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
    background: 'var(--surface-raised)',
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

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Status
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <select
                {...register('status')}
                style={errors.status ? inputErrorStyle : inputStyle}
              >
                <option value="pending">Pending</option>
                <option value="final">Final</option>
              </select>
              {errors.status && <span style={errorStyle}>{errors.status.message}</span>}
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
                    onSearchChange={setDropdownSearch}
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
                  Pengiriman ini sudah diterima sepenuhnya. Membuka receipt yang sudah ada...
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
        {mode === 'create' && !!watchDeliveryId && watchDeliveryId > 0 && deliveryDetail && isFullyReceived ? (
          <div style={cardStyle}>
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                Pengiriman ini sudah diterima sepenuhnya
              </span>
              <span style={{ fontSize: 13, color: 'var(--foreground-muted)', maxWidth: 420 }}>
                Semua item pada pengiriman ini sudah tercatat diterima sepenuhnya — tidak ada sisa qty untuk dibuat receipt baru.
              </span>
            </div>
          </div>
        ) : (
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
                  gridTemplateColumns: `minmax(250px, 2fr) 100px 100px 120px 140px minmax(150px, 1fr) 40px`,
                  gap: 10,
                  padding: '10px 20px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--background)',
                }}
              >
                {['Product / UOM', 'Batch', 'Qty', 'Status', 'Expiry', 'Notes', ''].map((h, i) => (
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
                    gridTemplateColumns: `minmax(250px, 2fr) 100px 100px 140px 140px 120px 140px minmax(150px, 1fr) 40px`,
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
                          onSearchChange={setDropdownSearch}
/>
                      )}
                    />
                  </div>

                  <input
                    type="text"
                    {...register(`details.${index}.planned_batch_code`)}
                    placeholder="Batch code..."
                    style={{
                      ...lineInputStyle,
                      background: 'var(--background)',
                      color: 'var(--foreground)'
                    }}
                  />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {(() => {
                      const detailId = watchDetails[index]?.delivery_detail_id as number
                      const remaining = remainingQtyByDetailId.get(detailId)
                      const isDone = remaining === 0
                      return (
                        <input
                          type="number"
                          min={0}
                          step={0.001}
                          max={remaining ?? undefined}
                          disabled={isDone}
                          {...register(`details.${index}.qty`, { valueAsNumber: true })}
                          style={{
                            ...lineInputStyle,
                            ...(isDone
                              ? { background: 'var(--surface)', cursor: 'not-allowed' }
                              : { background: 'var(--background)', color: 'var(--foreground)' }),
                          }}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                        />
                      )
                    })()}
                    {(() => {
                      const detailId = watchDetails[index]?.delivery_detail_id as number
                      const delivered = deliveredQtyByDetailId.get(detailId)
                      if (delivered === undefined) return null
                      const received = receivedQtyByDetailId.get(detailId) ?? 0
                      const remaining = remainingQtyByDetailId.get(detailId) ?? 0
                      const entered = Number(watchDetails[index]?.qty ?? 0)
                      return (
                        <span
                          style={{
                            fontSize: 10,
                            color:
                              entered > remaining
                                ? 'var(--destructive)'
                                : 'var(--foreground-subtle)',
                          }}
                        >
                          Dikirim: {delivered.toLocaleString('id-ID')} · Diterima: {received.toLocaleString('id-ID')} · Sisa: {remaining.toLocaleString('id-ID')}
                        </span>
                      )
                    })()}
                  </div>

                  {/* price inputs removed */}

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
                    style={{
                      ...lineInputStyle,
                      background: 'var(--background)',
                      color: 'var(--foreground)'
                    }}
                  />

                  <input
                    {...register(`details.${index}.description`)}
                    placeholder="Note"
                    style={{
                      ...lineInputStyle,
                      background: 'var(--background)',
                      color: 'var(--foreground)'
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

          {/* footer removed */}

          {errors.details && typeof (errors.details as any).message === 'string' && (
            <div style={{ padding: '8px 20px' }}>
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {(errors.details as any).message}
              </span>
            </div>
          )}
        </div>
        )}

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
            disabled={isPending || (mode === 'create' && isFullyReceived)}
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
              cursor: isPending || (mode === 'create' && isFullyReceived) ? 'not-allowed' : 'pointer',
              opacity: isPending || (mode === 'create' && isFullyReceived) ? 0.7 : 1,
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
