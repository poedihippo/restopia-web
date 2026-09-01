'use client'

import React, { useState,  useEffect } from 'react'
import { useRouter } from 'next/router'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { toastMutationApiError } from '@/utils/apiError'
import { branchesService } from '@/services/branches.service'
import { productUomsService } from '@/services/product-uoms.service'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes, isProductTypeAllowed } from '@/hooks/useProductTypes'
import { Plus, Trash2, ArrowLeft, Loader2, Save } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'

const detailSchema = z.object({
  product_uom_id: z.coerce.number().min(0, 'Product required'),
  qty: z.coerce.number().min(0.01, 'Qty must be > 0'),
  description: z.string().optional(),
})

const schema = z.object({
  supplier_branch_id: z.coerce.number().min(1, 'Source branch is required'),
  date: z.string().min(1, 'Date is required'),
  fulfillment_date: z.string().min(1, 'Fulfillment Date is required'),
  status: z.enum(['pending', 'final']),
  description: z.string().optional(),
  details: z.array(detailSchema).min(1, 'At least one item required'),
})

type FormValues = z.infer<typeof schema>

interface InternalOrderFormProps {
  mode: 'create' | 'edit'
  initialData?: any
  orderId?: number
}

export default function InternalOrderForm(props: InternalOrderFormProps) {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const { mode, initialData, orderId } = props
  const router = useRouter()
  const queryClient = useQueryClient()

  const { user } = useAuth()
  const myBranchId = (user as any)?.branch?.id

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      supplier_branch_id: 0,
      date: new Date().toISOString().split('T')[0],
      fulfillment_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      description: '',
      details: [{ product_uom_id: 0, qty: 1, description: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'details' })

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches-all', debouncedDropdownSearch],
    queryFn: () => branchesService.list({ 'filter[search]': debouncedDropdownSearch || undefined,  per_page: 100 }).then((r) => r.data),
  })
  const branches = (branchesData as any)?.data ?? []

  const activeProductTypes = useActiveBranchProductTypes()

  const { data: productUomsData, isLoading: productUomsLoading } = useQuery({
    queryKey: ['product-uoms-all', activeProductTypes, debouncedDropdownSearch],
    queryFn: async () => {
      let allProductUoms: any[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await productUomsService
          .list({ 'filter[search]': debouncedDropdownSearch || undefined, 
            page,
            per_page: 100,
            include: 'product,uom,product.product_category',
            'filter[product_types]': activeProductTypes,
           } as any)
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
  const allProductUoms = (productUomsData as any)?.data ?? []
  const productUoms = allProductUoms.filter((pu: any) => isProductTypeAllowed(pu.product, activeProductTypes))

  // Internal-source branches: every branch except our own.
  const sourceBranchOptions = branches
    .filter((b: any) => b.id !== myBranchId)
    .map((b: any) => ({
      value: b.id as number,
      label: (b.name as string) ?? `Branch #${b.id}`,
      sublabel: b.code as string | undefined,
    }))
  const productUomOptions = productUoms.map((pu: any) => ({
    value: pu.id as number,
    label: (pu.product?.name as string) ?? '',
    sublabel: (pu.uom?.name as string) ?? (pu.code as string) ?? '',
    price: pu.base_price ?? 0,
  }))

  useEffect(() => {
    if (initialData && mode === 'edit') {
      reset({
        ...initialData,
        date: initialData.date?.split('T')[0],
        fulfillment_date: initialData.fulfillment_date?.split('T')[0],
      })
    }
  }, [initialData, mode])

  // Internal orders are always type 'branch'; supplier_id is never sent.
  const watchDetails = watch('details')

  const buildPayload = (values: FormValues) => ({
    ...values,
    fulfillment_date: values.fulfillment_date ? new Date(values.fulfillment_date).toISOString().split('T')[0] : undefined,
    type: 'branch',
    supplier_branch_id: values.supplier_branch_id || undefined,
    details: values.details
      .filter((d) => Number(d.product_uom_id) > 0)
      .map((d) => ({
        product_uom_id: d.product_uom_id,
        qty: d.qty,
        description: d.description || undefined,
      })),
  })

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      purchaseOrdersService.create(buildPayload(values) as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-orders'] })
      toast.success('Internal order created')
      router.push('/purchase/internal-orders')
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to create internal order'),
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      purchaseOrdersService.update(orderId!, buildPayload(values) as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-orders'] })
      queryClient.invalidateQueries({ queryKey: ['internal-order-detail', orderId] })
      toast.success('Internal order updated')
      router.push(`/purchase/internal-orders/${orderId}/detail`)
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to update internal order'),
  })

  const onSubmit = (values: FormValues) => {
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch]);

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

  const lineGridCols = '2fr 100px 100px 1fr 40px'

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
            {mode === 'edit' ? 'Edit Internal Order' : 'New Internal Order'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            {mode === 'edit'
              ? 'Update the details of this internal order'
              : 'Order stock from another branch'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--foreground-subtle)' }}>
          <span style={{ color: 'var(--destructive)' }}>*</span>
          <span>Required fields</span>
        </div>
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

            {/* Date */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Order Date
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <input
                type="date"
                {...register('date')}
                style={errors.date ? inputErrorStyle : inputStyle}
              />
              {errors.date && <span style={errorStyle}>{errors.date.message}</span>}
            </div>

            {/* Fulfillment Date */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Fulfillment Date
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <input
                type="date"
                {...register('fulfillment_date')}
                style={errors.fulfillment_date ? inputErrorStyle : inputStyle}
              />
              {errors.fulfillment_date && <span style={errorStyle}>{errors.fulfillment_date.message}</span>}
            </div>

            {/* Source Branch (internal) — always shown; type is locked to branch. */}
            <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Order From
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)', marginBottom: 6 }}>
                Branch that will supply the stock
              </span>
              <Controller
                name="supplier_branch_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 0}
                    onChange={field.onChange}
                    options={sourceBranchOptions}
                    placeholder="Select source branch..."
                    searchPlaceholder="Search branches..."
                    loading={branchesLoading}
                    error={errors.supplier_branch_id?.message as string | undefined}
                    onSearchChange={setDropdownSearch}
/>
                )}
              />
            </div>

            {/* Status */}
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
                      const isPendingStatus = s === 'pending'
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
                              ? isPendingStatus
                                ? 'var(--warning-bg)'
                                : 'var(--success-bg)'
                              : 'var(--background)',
                            color: isSelected
                              ? isPendingStatus
                                ? 'var(--warning)'
                                : 'var(--success)'
                              : 'var(--foreground-muted)',
                            border: isSelected
                              ? isPendingStatus
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
              onClick={() => append({ product_uom_id: 0, qty: 1, description: '' })}
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
              gridTemplateColumns: lineGridCols,
              gap: 10,
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--background)',
            }}
          >
            {['Product / UOM', 'Qty', 'Notes', ''].map((h, i) => (
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
                gridTemplateColumns: lineGridCols,
                gap: 10,
                padding: '12px 20px',
                borderBottom: '1px solid var(--border)',
                alignItems: 'start',
              }}
            >
              {/* Product UOM */}
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
                      }}
                      options={productUomOptions.filter((o: any) => {
                        const selectedIds = watch('details').map(d => d.product_uom_id).filter(id => id > 0)
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
              </div>



              {/* Qty */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  {...register(`details.${index}.qty`, { valueAsNumber: true })}
                  style={lineInputStyle}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
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

          {/* Array-level error */}
          {errors.details && typeof (errors.details as any).message === 'string' && (
            <div style={{ padding: '8px 20px' }}>
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {(errors.details as any).message}
              </span>
            </div>
          )}

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
              : isPending ? 'Creating...' : 'Create Internal Order'}
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
