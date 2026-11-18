'use client'

import React, { useState,  useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productConversionsService } from '@/services/product-conversions.service'
import { toastMutationApiError } from '@/utils/apiError'
import { withProductType } from '@/utils/productUomName'
import { productsService } from '@/services/products.service'
import { uomsService } from '@/services/uoms.service'
import { X, Loader2, ArrowRight } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import { useActiveBranchProductTypes } from '@/hooks/useProductTypes'

const schema = z.object({
  product_id: z.coerce.number()
    .min(1, 'Product is required'),
  uom_id: z.coerce.number()
    .min(1, 'From UOM is required'),
  target_uom_id: z.coerce.number()
    .min(1, 'To UOM is required'),
  amount: z.coerce.number()
    .min(0.0001, 'Must be greater than 0'),
})
type FormValues = z.infer<typeof schema>

interface ProductConversionSheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    product_id: number
    uom_id: number
    target_uom_id: number
    amount: number
  } | null
}

export default function ProductConversionSheet({
  open,
  onClose,
  editData,
}: ProductConversionSheetProps) {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const queryClient = useQueryClient()
  const activeProductTypes = useActiveBranchProductTypes()

  // Conversion-factor change confirmation state
  const [showFactorChangeConfirm, setShowFactorChangeConfirm] = useState(false)
  const [factorChangeReason, setFactorChangeReason] = useState('')
  const [pendingPayload, setPendingPayload] = useState<FormValues | null>(null)

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
      product_id: 0,
      uom_id: 0,
      target_uom_id: 0,
      amount: 1,
    },
  })

  // Products for the picker — paged (20 per page, next page on scroll),
  // search delegated to the server (`filter[search]`).
  const productOpts = useInfiniteOptions<any>({
    queryKey: ['products-all', 'active', activeProductTypes, debouncedDropdownSearch],
    fetchPage: (page) =>
      productsService
        .list({
          page,
          'filter[search]': debouncedDropdownSearch || undefined,
          per_page: 20,
          sort: 'name,id',
          'filter[status]': 'active',
          'filter[is_active]': true,
          'filter[types]': activeProductTypes,
        } as any)
        .then((r) => r.data),
  })
  const productsLoading = productOpts.loading
  const products = productOpts.items

  const { data: uomsData, isLoading: uomsLoading } = useQuery({
    queryKey: ['uoms-all', debouncedDropdownSearch],
    queryFn: () =>
      uomsService
        .list({
          'filter[search]': debouncedDropdownSearch || undefined,
          per_page: 1000,
        })
        .then((r) => r.data),
  })
  const uoms = (uomsData as any)?.data ?? []

  const toProductOption = (p: any) => ({
    value: p.id as number,
    label: withProductType((p.name as string) ?? '', p.type),
    sublabel: p.code as string | undefined,
  })
  const productOptions = products.map(toProductOption)
  // Edit mode: the saved product may not be on a loaded page — keep its label
  // from the row's included `product` relation.
  const editProduct = (editData as any)?.product
  if (editProduct?.id && !productOptions.some((o: any) => o.value === editProduct.id)) {
    productOptions.unshift(toProductOption(editProduct))
  }
  const uomOptions = uoms.map((u: any) => ({
    value: u.id as number,
    label: (u.name as string) ?? '',
    sublabel: u.code as string | undefined,
  }))

  useEffect(() => {
    if (editData) {
      reset({
        product_id: editData.product_id,
        uom_id: editData.uom_id,
        target_uom_id: editData.target_uom_id,
        amount: editData.amount,
      })
    } else {
      reset({
        product_id: 0,
        uom_id: 0,
        target_uom_id: 0,
        amount: 1,
      })
    }
  }, [editData, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => productConversionsService.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-conversions'] })
      toast.success('Conversion created')
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to create conversion'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues & { confirm_conversion_factor_change?: boolean; reason?: string }) =>
      productConversionsService.update(editData!.id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-conversions'] })
      toast.success('Conversion updated')
      onClose()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.response?.data?.errors?.message ?? ''
      if (/cannot change conversion factor/i.test(msg)) {
        setPendingPayload(formValues)
        setShowFactorChangeConfirm(true)
      } else {
        toastMutationApiError(err, 'Failed to update conversion')
      }
    },
  })

  const formValues = watch()

  const onSubmit = (values: FormValues) => {
    if (editData) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const handleConfirmFactorChange = () => {
    if (!factorChangeReason.trim()) {
      toast.error('Reason is required')
      return
    }
    if (!pendingPayload) return
    updateMutation.mutate({
      ...pendingPayload,
      confirm_conversion_factor_change: true,
      reason: factorChangeReason.trim(),
    })
    setShowFactorChangeConfirm(false)
    setFactorChangeReason('')
    setPendingPayload(null)
  }

  const handleCancelFactorChange = () => {
    setShowFactorChangeConfirm(false)
    setFactorChangeReason('')
    setPendingPayload(null)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const watchedValues = watch([
    'product_id',
    'uom_id',
    'target_uom_id',
    'amount',
  ])
  const [watchedProductId, watchedFromUomId, watchedToUomId, watchedAmount] =
    watchedValues

  const showPreview =
    watchedProductId !== undefined &&
    watchedFromUomId !== undefined &&
    watchedToUomId !== undefined &&
    watchedAmount !== undefined &&
    !isNaN(watchedAmount) &&
    watchedAmount >= 0.0001

  const fromUomName = uoms.find((u: any) => u.id === watchedFromUomId)?.name ?? ''
  const toUomName = uoms.find((u: any) => u.id === watchedToUomId)?.name ?? ''

  const selectStyle = {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 14,
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box' as const,
    cursor: 'pointer',
  }

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

      {/* Sheet panel */}
      <div
        style={{
          position: 'relative',
          zIndex: 50,
          width: 480,
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
            {editData ? 'Edit Conversion' : 'New Conversion'}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, fontSize: 11, color: 'var(--foreground-subtle)' }}>
            <span style={{ color: 'var(--destructive)' }}>*</span>
            <span>Required fields</span>
          </div>
          {/* Product field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--foreground)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              Product
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <Controller
              name="product_id"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? 0}
                  onChange={field.onChange}
                  options={productOptions}
                  placeholder="Select product..."
                  searchPlaceholder="Search products..."
                  loading={productsLoading}
                  error={errors.product_id?.message as string | undefined}
                  onSearchChange={setDropdownSearch}
                  {...productOpts.selectProps}
/>
              )}
            />
          </div>

          {/* Conversion row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--foreground)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              Conversion
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {/* From UOM */}
              <Controller
                name="uom_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 0}
                    onChange={field.onChange}
                    options={uomOptions}
                    placeholder="From UOM"
                    searchPlaceholder="Search UOMs..."
                    loading={uomsLoading}
                    error={errors.uom_id?.message as string | undefined}
                    onSearchChange={setDropdownSearch}
/>
                )}
              />

              {/* Arrow */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowRight size={16} style={{ color: 'var(--foreground-muted)' }} />
              </div>

              {/* To UOM */}
              <Controller
                name="target_uom_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 0}
                    onChange={field.onChange}
                    options={uomOptions.filter((uom: any) => uom.value !== watch('uom_id'))}
                    placeholder="To UOM"
                    searchPlaceholder="Search UOMs..."
                    loading={uomsLoading}
                    error={errors.target_uom_id?.message as string | undefined}
                    onSearchChange={setDropdownSearch}
/>
                )}
              />
            </div>
          </div>

          {/* Amount */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--foreground)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              Amount
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <input
              {...register('amount', { valueAsNumber: true })}
              type="number"
              step="0.0001"
              min="0.0001"
              placeholder="e.g. 1000"
              style={{
                width: '100%',
                padding: '9px 12px',
                border: `1px solid ${errors.amount ? 'var(--destructive)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                color: 'var(--foreground)',
                background: 'var(--surface-raised)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                boxSizing: 'border-box',
              }}
            />
            {errors.amount && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {errors.amount.message}
              </span>
            )}
            <span
              style={{
                fontSize: 11,
                color: 'var(--foreground-subtle)',
              }}
            >
              1 {watchedFromUomId ? fromUomName || 'From UOM' : 'From UOM'} ={' '}
              {watchedAmount ?? '?'} {watchedToUomId ? toUomName || 'To UOM' : 'To UOM'}
            </span>
          </div>

          {/* Live preview */}
          {showPreview && (
            <div
              style={{
                padding: '14px 16px',
                background: 'var(--accent-light-bg)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--foreground-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Preview
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--accent)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  1 {fromUomName}
                </span>
                <ArrowRight size={14} style={{ color: 'var(--foreground-muted)' }} />
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--accent)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {watchedAmount} {toUomName}
                </span>
              </div>
            </div>
          )}
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
              <Loader2
                size={14}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            )}
            {editData ? 'Save Changes' : 'Create Conversion'}
          </button>
        </div>
      </div>

      {/* Conversion-factor change confirmation dialog */}
      {showFactorChangeConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              padding: 32,
              width: 440,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                marginBottom: 8,
                color: 'var(--foreground)',
              }}
            >
              Confirm Conversion Factor Change
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--foreground-muted)',
                marginBottom: 16,
                lineHeight: 1.6,
              }}
            >
              Changing the conversion factor <strong>re-interprets existing quantities</strong> on
              inventory rows that hold stock in the affected unit. A stock adjustment should be run
              afterwards to realign quantities to physical counts.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                Reason (required)
              </label>
              <textarea
                value={factorChangeReason}
                onChange={(e) => setFactorChangeReason(e.target.value)}
                placeholder="e.g. relabeling PACK to the new contract..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  color: 'var(--foreground)',
                  background: 'var(--background)',
                  outline: 'none',
                  fontFamily: 'var(--font-sans)',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                Reason will be stored in the audit log.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleCancelFactorChange}
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
                onClick={handleConfirmFactorChange}
                disabled={updateMutation.isPending || !factorChangeReason.trim()}
                style={{
                  padding: '8px 16px',
                  background: 'var(--destructive)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'white',
                  cursor:
                    updateMutation.isPending || !factorChangeReason.trim()
                      ? 'not-allowed'
                      : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: updateMutation.isPending || !factorChangeReason.trim() ? 0.7 : 1,
                }}
              >
                {updateMutation.isPending && (
                  <Loader2
                    size={14}
                    style={{ animation: 'spin 1s linear infinite' }}
                  />
                )}
                Change Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
