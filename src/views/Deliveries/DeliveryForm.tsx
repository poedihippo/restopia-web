'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deliveriesService } from '@/services/deliveries.service'
import { branchesService } from '@/services/branches.service'
import { productUomsService } from '@/services/product-uoms.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { salesOrdersService } from '@/services/sales-orders.service'
import { companiesService } from '@/services/companies.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import api from '@/hooks/useApi'
import { Plus, Trash2, ArrowLeft, Loader2, Save } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'

import { getCanReadPrice } from '@/utils/price'

const GENERAL_OWNER_OPTION = { value: 'GENERAL', label: 'Umum (GENERAL)' }

const formatNumber = (n: number | undefined): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return ''
  if (!getCanReadPrice()) return '***'
  return Number(n).toLocaleString('id-ID')
}

const detailSchema = z.object({
  product_uom_id: z.coerce.number().min(0, 'Product required'),
  product_uom_batch_id: z.coerce.number().optional(),
  purchase_order_detail_id: z.coerce.number().optional(),
  sales_order_detail_id: z.coerce.number().optional(),
  qty: z.coerce.number().min(0.001, 'Qty must be > 0'),
  price: z.coerce.number().min(0, 'Price required'),
  status: z.enum(['pending', 'packaging', 'packed']),
  description: z.string().optional(),
})

const schema = z
  .object({
    source_type: z.enum([
      'po_from_supplier',
      'po_from_branch',
      'transfer_to_branch',
      'so_to_branch',
    ]),
    target_branch_id: z.coerce.number().min(0, 'Target branch required'),
    purchase_order_id: z.coerce.number().optional(),
    sales_order_id: z.coerce.number().optional(),
    date: z.string().min(1, 'Date required'),
    status: z.literal('final'),
    description: z.string().optional(),
    source_owner_ref: z.string().min(1, 'Owner sumber wajib diisi'),
    source_stage: z.string().min(1, 'Stage sumber wajib diisi'),
    source_location_ref: z.string().optional(),
    details: z.array(detailSchema).min(1, 'At least one item required'),
  })
  .superRefine((data, ctx) => {
    if (data.source_type !== 'po_from_supplier') {
      data.details.forEach((d, i) => {
        if (!d.product_uom_batch_id) {
          ctx.addIssue({
            code: 'custom',
            path: ['details', i, 'product_uom_batch_id'],
            message: 'Batch is required',
          })
        }
      })
    }
  })

type FormValues = z.infer<typeof schema>

interface DeliveryFormProps {
  mode: 'create' | 'edit'
  initialData?: any
  deliveryId?: number
  prefill?: {
    source_type?:
    | 'po_from_supplier'
    | 'po_from_branch'
    | 'transfer_to_branch'
    | 'so_to_branch'
    purchase_order_id?: number
    sales_order_id?: number
    target_branch_id?: number
  }
}

export default function DeliveryForm(props: DeliveryFormProps) {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const { mode, initialData, deliveryId, prefill } = props
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const myBranchId = (user as any)?.branch?.id ?? (user as any)?.branch_id

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
      source_type: prefill?.source_type ?? 'po_from_supplier',
      target_branch_id: prefill?.target_branch_id ?? 0,
      purchase_order_id: prefill?.purchase_order_id ?? undefined,
      sales_order_id: prefill?.sales_order_id ?? undefined,
      date: new Date().toISOString().split('T')[0],
      status: 'final',
      description: '',
      source_owner_ref: 'GENERAL',
      source_stage: 'GENERAL',
      source_location_ref: 'GENERAL',
      details: [
        {
          product_uom_id: 0,
          product_uom_batch_id: undefined,
          purchase_order_detail_id: undefined,
          sales_order_detail_id: undefined,
          qty: 1,
          price: 0,
          status: 'packed',
          description: '',
        },
      ],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'details' })

  const watchDetails = watch('details')
  const totalPrice = watchDetails.reduce(
    (sum, d) => sum + Number(d.qty ?? 0) * Number(d.price ?? 0),
    0
  )

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches-all', debouncedDropdownSearch],
    queryFn: () => branchesService.list({ 'filter[search]': debouncedDropdownSearch || undefined,  per_page: 100 }).then((r) => r.data),
  })
  const branches = (branchesData as any)?.data ?? []

  // Dimension picker: owner (company) + stage — source only, deliveries have
  // no output dimension.
  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies-all', debouncedDropdownSearch],
    queryFn: () => companiesService.list({ 'filter[search]': debouncedDropdownSearch || undefined,  per_page: 100 } as any).then((r) => r.data),
  })
  const companies: { id: number; name: string }[] = (companiesData as any)?.data ?? []
  const companyOptions = [
    GENERAL_OWNER_OPTION,
    ...companies.map((c) => ({ value: String(c.id), label: c.name })),
  ]

  const { data: stagesData, isLoading: stagesLoading } = useQuery({
    queryKey: ['stages-all', debouncedDropdownSearch],
    queryFn: () => api.get('/stages', { params: { per_page: 100 } }).then((r) => r.data),
  })
  const stages: { code: string; name: string }[] = (stagesData as any)?.data ?? []
  const stageOptions = stages.map((s) => ({ value: s.code, label: s.name }))

  const { data: productUomsData, isLoading: productUomsLoading } = useQuery({
    queryKey: ['product-uoms-all', debouncedDropdownSearch],
    queryFn: async () => {
      let allProductUoms: any[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await productUomsService
          .list({ 'filter[search]': debouncedDropdownSearch || undefined,  page, per_page: 100, include: 'product,uom' } as any)
          .then((r) => r.data)
        const items = (res as any)?.data ?? []
        allProductUoms = allProductUoms.concat(items)
        totalPages =
          (res as any)?.meta?.last_page ??
          (res as any)?.meta?.total_pages ??
          1
        page += 1
      } while (page <= totalPages)
      return { data: allProductUoms }
    },
  })
  const productUoms = (productUomsData as any)?.data ?? []

  // Source-branch inventory — the batch picker must show only batches that
  // actually have stock at the supplying branch, with the REAL per-branch
  // quantity (not the global batch stock). Per-branch stock lives in
  // product_inventory, so we source the picker from there.
  const { data: inventoryData } = useQuery({
    queryKey: ['source-branch-inventory', myBranchId],
    enabled: !!myBranchId,
    queryFn: async () => {
      let allRows: any[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await productInventoriesService
          .list({
            page,
            per_page: 100,
            'filter[branch_id]': myBranchId,
            include: 'product_uom_batch,product_uom_batch.product_uom',
          } as any)
          .then((r) => r.data)
        const items = (res as any)?.data ?? []
        allRows = allRows.concat(items)
        totalPages =
          (res as any)?.meta?.last_page ??
          (res as any)?.meta?.total_pages ??
          1
        page += 1
      } while (page <= totalPages)
      return { data: allRows }
    },
  })
  const sourceInventory = (inventoryData as any)?.data ?? []

  // Batch options for a line's product UOM: only batches with stock > 0 at the
  // source branch, each carrying its real per-branch quantity.
  const getBatchOptionsForUom = (productUomId: number) =>
    sourceInventory
      .filter((inv: any) => {
        const invUomId =
          inv.product_uom_id ?? inv.product_uom_batch?.product_uom?.id
        const hasBatch = !!inv.product_uom_batch?.id
        const stock = inv.stock ?? inv.qty ?? 0
        return hasBatch && invUomId === productUomId && stock > 0
      })
      .map((inv: any) => ({
        batchId: inv.product_uom_batch.id as number,
        code: (inv.product_uom_batch.batch_code || inv.product_uom_batch.code) as string | undefined,
        expiry_date: inv.product_uom_batch.expiry_date as string | undefined,
        stock: inv.stock ?? inv.qty ?? 0,
      }))

  const { data: purchaseOrdersData, isLoading: purchaseOrdersLoading } = useQuery({
    queryKey: ['purchase-orders-linkable'],
    queryFn: async () => {
      let allOrders: any[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await purchaseOrdersService
          .list({ page, per_page: 100, include: 'supplier,supplier_branch', sort: '-id' } as any)
          .then((r) => r.data)
        const items = (res as any)?.data ?? []
        allOrders = allOrders.concat(items)
        totalPages =
          (res as any)?.meta?.last_page ??
          (res as any)?.meta?.total_pages ??
          1
        page += 1
      } while (page <= totalPages)
      const linkable = allOrders
        .filter((po: any) => ['accepted', 'final'].includes(po?.status))
        .sort((a: any, b: any) => b.id - a.id)
      return { data: linkable }
    },
  })
  const purchaseOrders = (purchaseOrdersData as any)?.data ?? []

  const { data: salesOrdersData, isLoading: salesOrdersLoading } = useQuery({
    queryKey: ['sales-orders-pending'],
    queryFn: async () => {
      let allOrders: any[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await salesOrdersService
          .list({ 'filter[search]': debouncedDropdownSearch || undefined,  page, per_page: 100, 'filter[status]': 'final', 'filter[has_delivery]': 'false'  } as any)
          .then((r) => r.data)
        const items = (res as any)?.data ?? []
        allOrders = allOrders.concat(items)
        totalPages =
          (res as any)?.meta?.last_page ??
          (res as any)?.meta?.total_pages ??
          1
        page += 1
      } while (page <= totalPages)
      return { data: allOrders }
    },
  })
  const salesOrders = (salesOrdersData as any)?.data ?? []

  const watchPurchaseOrderId = watch('purchase_order_id')
  const watchSalesOrderId = watch('sales_order_id')
  const watchSourceType = watch('source_type')

  useEffect(() => {
    if (watchSourceType === 'po_from_supplier' && myBranchId) {
      setValue('target_branch_id', myBranchId)
    }
  }, [watchSourceType, myBranchId, setValue])

  // Internal-branch deliveries/transfers are price-free — hide all price UI
  // and don't submit computed prices. Supplier/SO deliveries keep price.
  const isInternal =
    watchSourceType === 'po_from_branch' ||
    watchSourceType === 'transfer_to_branch'

  const showLinkedPO =
    watchSourceType === 'po_from_supplier' || watchSourceType === 'po_from_branch'
  const showLinkedSO = watchSourceType === 'so_to_branch'
  const targetBranchReadonly =
    watchSourceType === 'po_from_supplier' ||
    watchSourceType === 'po_from_branch' ||
    watchSourceType === 'so_to_branch'
  const requiresBatch = watchSourceType !== 'po_from_supplier'

  const { data: poData } = useQuery({
    queryKey: ['po-detail-for-delivery', watchPurchaseOrderId],
    queryFn: () =>
      purchaseOrdersService
        .findById(watchPurchaseOrderId as number, {
          include: 'purchase_order_details',
        })
        .then((r) => r.data),
    enabled: !!watchPurchaseOrderId && (watchPurchaseOrderId as number) > 0,
  })
  const poDetail = (poData as any)?.data

  const { data: soData } = useQuery({
    queryKey: ['so-detail-for-delivery', watchSalesOrderId],
    queryFn: () =>
      salesOrdersService
        .findById(watchSalesOrderId as number, {
          include: 'buyer_branch,sales_order_details',
        })
        .then((r) => r.data),
    enabled: !!watchSalesOrderId && (watchSalesOrderId as number) > 0,
  })
  const soDetail = (soData as any)?.data

  useEffect(() => {
    console.log('PO detail:', poDetail)
    console.log('PO details array:', poDetail?.purchase_order_details)
    if (!poDetail?.purchase_order_details?.length) return

    // source_type must match the PO's own type — a branch PO needs
    // po_from_branch, not po_from_supplier, or the backend wrongly demands
    // a supplier_id that doesn't apply to it.
    const derivedSourceType = poDetail?.type === 'branch' ? 'po_from_branch' : 'po_from_supplier'
    setValue('source_type', derivedSourceType)

    const newDetails = poDetail.purchase_order_details.map((d: any) => ({
      product_uom_id: d.product_uom_id ?? 0,
      product_uom_batch_id: undefined,
      purchase_order_detail_id: d.id,
      sales_order_detail_id: undefined,
      qty: d.qty ?? 1,
      price: d.price ?? d.product_uom?.franchise_price ?? 0,
      status: 'packed' as const,
      description: d.description ?? '',
    }))

    replace(newDetails)

    if (
      (watchSourceType === 'po_from_supplier' ||
        watchSourceType === 'po_from_branch') &&
      poDetail?.branch_id
    ) {
      setValue('target_branch_id', poDetail.branch_id)
    }

    toast.info('Line items loaded from Purchase Order')
  }, [poDetail?.id])

  useEffect(() => {
    if (!soDetail) return

    if (soDetail.buyer_branch_id) {
      setValue('target_branch_id', soDetail.buyer_branch_id)
    }

    if (soDetail.sales_order_details?.length) {
      const newDetails = soDetail.sales_order_details.map((d: any) => ({
        product_uom_id: d.product_uom_id ?? 0,
        product_uom_batch_id: undefined,
        purchase_order_detail_id: undefined,
        sales_order_detail_id: d.id,
        qty: d.qty ?? 1,
        price: d.price ?? 0,
        status: 'packed' as const,
        description: d.description ?? '',
      }))
      replace(newDetails)
      toast.info('Items loaded from Sales Order')
    }
  }, [soDetail?.id])

  useEffect(() => {
    if (!showLinkedPO) {
      setValue('purchase_order_id', undefined)
    }
  }, [showLinkedPO])

  useEffect(() => {
    if (!showLinkedSO) {
      setValue('sales_order_id', undefined)
    }
  }, [showLinkedSO])

  const branchOptions = branches.map((b: any) => ({
    value: b.id as number,
    label: (b.name as string) ?? `Branch #${b.id}`,
    sublabel: b.code as string | undefined,
  }))
  const productUomOptions = productUoms.map((pu: any) => ({
    value: pu.id as number,
    label: (pu.product?.name as string) ?? '',
    sublabel: (pu.uom?.name as string) ?? (pu.code as string) ?? '',
    base_price: pu.base_price ?? 0,
  }))
  const purchaseOrderOptions = [
    { value: 0, label: 'No linked PO' },
    ...purchaseOrders.map((po: any) => ({
      value: po.id as number,
      label: `${po.code ?? `PO-${po.id}`} - ${po.supplier?.name ?? po.supplier_branch?.name ?? 'Internal / No Supplier'}`,
      sublabel: po.date ? po.date : undefined,
    })),
  ]
  const salesOrderOptions = [
    { value: 0, label: 'No linked SO' },
    ...salesOrders.map((so: any) => ({
      value: so.id as number,
      label: so.code ?? `SO-${so.id}`,
      sublabel: undefined,
    })),
  ]
  const sourceTypeOptions = [
    { value: 'po_from_supplier', label: 'PO from Supplier' },
    { value: 'po_from_branch', label: 'PO from Branch' },
    { value: 'transfer_to_branch', label: 'Transfer to Branch' },
    { value: 'so_to_branch', label: 'SO to Branch' },
  ] as const

  useEffect(() => {
    if (initialData && mode === 'edit') {
      reset({
        source_owner_ref: 'GENERAL',
        source_stage: 'GENERAL',
        source_location_ref: 'GENERAL',
        ...initialData,
      })
    }
  }, [initialData, mode])

  const buildPayload = (values: FormValues) => ({
    ...values,
    status: 'final',
    // Internal deliveries/transfers are price-free — never submit prices.
    total_price: totalPrice,
    purchase_order_id: values.purchase_order_id || undefined,
    sales_order_id: values.sales_order_id || undefined,
    source_owner_ref: values.source_owner_ref,
    source_stage: values.source_stage,
    source_location_ref: values.source_location_ref || 'GENERAL',
    details: values.details
      .filter((d) => Number(d.product_uom_id) > 0)
      .map((d) => ({
        product_uom_id: d.product_uom_id,
        product_uom_batch_id:
          watchSourceType !== 'po_from_supplier'
            ? d.product_uom_batch_id || undefined
            : undefined,
        purchase_order_detail_id: d.purchase_order_detail_id || undefined,
        sales_order_detail_id: d.sales_order_detail_id || undefined,
        qty: d.qty,
        price: d.price,
        status: d.status,
        description: d.description || undefined,
      })),
  })

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      deliveriesService.create(buildPayload(values) as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] })
      toast.success('Delivery created')
      router.push('/transfer/deliveries')
    },
    onError: (err: any) => {
      console.log('createMutation error', err)
      toastMutationApiError(err, 'Failed to create delivery')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      deliveriesService.update(deliveryId!, buildPayload(values) as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] })
      queryClient.invalidateQueries({ queryKey: ['delivery-detail', deliveryId] })
      toast.success('Delivery updated')
      router.push(`/transfer/deliveries/${deliveryId}/detail`)
    },
    onError: (err: any) => {
      console.log('updateMutation error', err)
      toastMutationApiError(err, 'Failed to update delivery')
    },
  })

  const onSubmit = (values: FormValues) => {
    console.log('DeliveryForm onSubmit called', { ...values, total_price: totalPrice })
    if (mode === 'edit' && deliveryId) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const onInvalid = (errs: any) => {
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch]);

    console.log('DeliveryForm validation errors:', errs)
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
            {mode === 'edit' ? 'Edit Delivery' : 'New Delivery'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            {mode === 'edit'
              ? 'Update the details of this delivery'
              : 'Fill in the details below to create a new delivery'}
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
        {/* Section 1 — Delivery Info */}
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionLabelStyle}>Delivery Info</span>
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
                Delivery Date
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
                Source Type
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <Controller
                name="source_type"
                control={control}
                render={({ field }) => (
                  <select
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    style={{ ...selectStyle }}
                  >
                    {sourceTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Target Branch (Receiving)
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              {targetBranchReadonly ? (
                <div
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--background)',
                    fontSize: 13,
                    color: 'var(--foreground-muted)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {branches.find((b: any) => b.id === watch('target_branch_id'))?.name
                    ?? 'Auto-filled from selection'}
                </div>
              ) : (
                <Controller
                  name="target_branch_id"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? 0}
                      onChange={field.onChange}
                      options={branchOptions.filter(
                        (o: any) => !myBranchId || o.value !== myBranchId,
                      )}
                      placeholder="Select target branch..."
                      searchPlaceholder="Search branches..."
                      loading={branchesLoading}
                      error={errors.target_branch_id?.message as string | undefined}
                      onSearchChange={setDropdownSearch}
/>
                  )}
                />
              )}
            </div>

            {showLinkedPO && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>Linked Purchase Order (Optional)</label>
                <Controller
                  name="purchase_order_id"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? 0}
                      onChange={(v) => field.onChange(v > 0 ? v : undefined)}
                      options={purchaseOrderOptions}
                      placeholder="No linked PO"
                      searchPlaceholder="Search POs..."
                      loading={purchaseOrdersLoading}
                      onSearchChange={setDropdownSearch}
/>
                  )}
                />
                {!!watchPurchaseOrderId && watchPurchaseOrderId > 0 && poDetail && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--success)',
                      marginTop: 4,
                      display: 'block',
                    }}
                  >
                    ✓ {poDetail.purchase_order_details?.length ?? 0} item(s) loaded from PO
                  </span>
                )}
              </div>
            )}

            {showLinkedSO && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>Linked Sales Order (Optional)</label>
                <Controller
                  name="sales_order_id"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? 0}
                      onChange={(v) => field.onChange(v > 0 ? v : undefined)}
                      options={salesOrderOptions}
                      placeholder="No linked SO"
                      searchPlaceholder="Search SOs..."
                      loading={salesOrdersLoading}
                      onSearchChange={setDropdownSearch}
/>
                  )}
                />
                {!!watchSalesOrderId && watchSalesOrderId > 0 && soDetail && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--success)',
                      marginTop: 4,
                      display: 'block',
                    }}
                  >
                    ✓ {soDetail.sales_order_details?.length ?? 0} item(s) loaded from SO
                  </span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
              <label style={labelStyle}>Notes</label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Optional delivery notes"
                style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }}
              />
            </div>
          </div>
        </div>

        {/* Section 1b — Konsumsi Dari */}
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionLabelStyle}>Konsumsi Dari</span>
          </div>
          <div
            style={{
              padding: 20,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>
                Owner <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <Controller
                name="source_owner_ref"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 'GENERAL'}
                    onChange={field.onChange}
                    options={companyOptions}
                    placeholder="Pilih owner..."
                    searchPlaceholder="Cari perusahaan..."
                    loading={companiesLoading}
                    error={errors.source_owner_ref?.message as string | undefined}
                    onSearchChange={setDropdownSearch}
/>
                )}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>
                Stage <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <Controller
                name="source_stage"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 'GENERAL'}
                    onChange={field.onChange}
                    options={stageOptions}
                    placeholder="Pilih stage..."
                    searchPlaceholder="Cari stage..."
                    loading={stagesLoading}
                    error={errors.source_stage?.message as string | undefined}
                    onSearchChange={setDropdownSearch}
/>
                )}
              />
            </div>
          </div>
        </div>

        {/* Section 2 — Line Items */}
        <div style={cardStyle}>
          <div
            style={{
              ...sectionHeaderStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={sectionLabelStyle}>Delivery Items</span>
            <button
              type="button"
              onClick={() =>
                append({
                  product_uom_id: 0,
                  product_uom_batch_id: undefined,
                  purchase_order_detail_id: undefined,
                  sales_order_detail_id: undefined,
                  qty: 1,
                  price: 0,
                  status: 'packed',
                  description: '',
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
              gridTemplateColumns: requiresBatch
                ? '2fr 1fr 90px 110px 1fr 40px'
                : '2fr 90px 110px 1fr 40px',
              gap: 10,
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--background)',
            }}
          >
            {(requiresBatch
              ? ['Product', 'Batch', 'Qty', 'Status', 'Notes', '']
              : ['Product', 'Qty', 'Status', 'Notes', '']
            ).map((h, i) => (
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
                gridTemplateColumns: requiresBatch
                ? '2fr 1fr 90px 120px 110px 1fr 40px'
                : '2fr 90px 130px 110px 1fr 40px',
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
                      onChange={(v) => {
                        f.onChange(v)
                        setValue(
                          `details.${index}.product_uom_batch_id`,
                          undefined,
                        )
                        const opt = productUomOptions.find((o: any) => o.value === v)
                        if (opt && opt.base_price) setValue(`details.${index}.price`, opt.base_price)
                      }}
                      options={productUomOptions}
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
              </div>

              {requiresBatch && (
                <Controller
                  control={control}
                  name={`details.${index}.product_uom_batch_id`}
                  render={({ field: f }) => {
                    const batches = getBatchOptionsForUom(
                      watchDetails[index]?.product_uom_id ?? 0,
                    )
                    const batchError = errors.details?.[index]?.product_uom_batch_id
                      ?.message as string | undefined
                    return (
                      <div
                        style={{ display: 'flex', flexDirection: 'column', gap: 3 }}
                      >
                        <select
                          value={f.value ?? 0}
                          onChange={(e) =>
                            f.onChange(Number(e.target.value) || undefined)
                          }
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            border: `1px solid ${batchError ? 'var(--destructive)' : 'var(--border)'
                              }`,
                            borderRadius: 'var(--radius-md)',
                            fontSize: 12,
                            background: 'var(--surface)',
                            outline: 'none',
                            fontFamily: 'var(--font-sans)',
                            cursor: 'pointer',
                          }}
                        >
                          <option value={0}>
                            {batches.length === 0
                              ? 'No stock available at this branch'
                              : 'Select batch...'}
                          </option>
                          {batches.map((b: any) => (
                            <option key={b.batchId} value={b.batchId}>
                              {`${b.code ?? `Batch #${b.batchId}`} | Exp: ${b.expiry_date ? String(b.expiry_date).split('T')[0] : 'No expiry'} | Stock: ${(b.stock ?? 0).toLocaleString('id-ID')}`}
                            </option>
                          ))}
                        </select>
                        {batchError && (
                          <span
                            style={{ fontSize: 10, color: 'var(--destructive)' }}
                          >
                            {batchError}
                          </span>
                        )}
                      </div>
                    )
                  }}
                />
              )}

              <input
                type="number"
                min={0.001}
                step={0.001}
                {...register(`details.${index}.qty`, { valueAsNumber: true })}
                style={lineInputStyle}
              />

              {/* price input removed */}

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
                    <option value="packaging">Packaging</option>
                    <option value="packed">Packed</option>
                  </select>
                )}
              />

              <input
                {...register(`details.${index}.description`)}
                placeholder="Optional note"
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

          {/* total footer removed */}

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
                : 'Create Delivery'}
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
