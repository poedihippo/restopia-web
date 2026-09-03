'use client'
import { formatCurrency, getCanReadPrice } from '@/utils/price';
import { useAuth } from '@/hooks/useAuth'

import React, { useState,  useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productUomsService } from '@/services/product-uoms.service'
import { toastMutationApiError } from '@/utils/apiError'
import { productsService } from '@/services/products.service'
import { uomsService } from '@/services/uoms.service'
import { X, Loader2 } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import { useActiveBranchProductTypes } from '@/hooks/useProductTypes'
const formatNumber = (n: number | undefined, canReadPrice: boolean): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return ''
  if (!canReadPrice) return '***'
  return Number(n).toLocaleString('id-ID')
}

const schema = z.object({
  product_id: z.coerce.number().min(1, 'Product is required'),
  uom_id: z.coerce.number().min(1, 'UOM is required'),
  code: z.string().min(1, 'Code is required'),
  base_price: z.coerce.number().min(0).optional(),
  online_price: z.coerce.number().min(0).optional(),
  franchise_price: z.coerce.number().min(0).optional(),
  price_editable: z.boolean().optional(),
  is_default: z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

interface ProductUomSheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    product_id: number
    uom_id: number
    code?: string
    base_price?: number
    online_price?: number
    franchise_price?: number
    price_editable?: boolean
    is_default?: boolean
    product?: { id?: number; name?: string; code?: string }
    uom?: { id?: number; name?: string; code?: string }
  } | null
}

export default function ProductUomSheet({ open, onClose, editData }: ProductUomSheetProps) {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canReadFranchisePrice = hasPermission('common.franchise-price.read')
  const isEdit = !!editData
  const activeProductTypes = useActiveBranchProductTypes()

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
      product_id: editData?.product_id ?? 0,
      uom_id: editData?.uom_id ?? 0,
      code: '',
      base_price: 0,
      online_price: 0,
      franchise_price: 0,
      price_editable: false,
      is_default: false,
    },
  })

  // Server-side product search (products list can exceed 100 rows, so the
  // typed query is sent to the backend via filter[search] instead of filtering
  // the first page client-side).
  const [productSearch, setProductSearch] = React.useState('')
  const [productSearchDebounced, setProductSearchDebounced] = React.useState('')
  useEffect(() => {
    const t = setTimeout(() => setProductSearchDebounced(productSearch), 300)
    return () => clearTimeout(t)
  }, [productSearch])

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products-all', productSearchDebounced, activeProductTypes, debouncedDropdownSearch],
    queryFn: () =>
      productsService
        .list({
          page: 1,
          per_page: 50,
          sort: 'name',
          'filter[search]': productSearchDebounced || undefined,
          'filter[product_types]': activeProductTypes,
        } as any)
        .then((r) => r.data),
  })
  const products = (productsData as any)?.data ?? []

  const { data: uomsData, isLoading: uomsLoading } = useQuery({
    queryKey: ['uoms-all', debouncedDropdownSearch],
    queryFn: async () => {
      let allUoms: any[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await uomsService
          .list({ 'filter[search]': debouncedDropdownSearch || undefined,  page, per_page: 100  })
          .then((r) => r.data)
        const items = (res as any)?.data ?? []
        allUoms = allUoms.concat(items)
        totalPages =
          (res as any)?.meta?.last_page ??
          (res as any)?.meta?.total_pages ??
          1
        page += 1
      } while (page <= totalPages)
      return { data: allUoms }
    },
  })
  const uoms = (uomsData as any)?.data ?? []

  // When editing, ensure the currently-selected product/uom is present in
  // the options list even if it lies beyond the first page.
  const productOptions = React.useMemo(() => {
    const base = products.map((p: any) => ({
      value: p.id as number,
      label: (p.name as string) ?? '',
      sublabel: p.code as string | undefined,
    }))
    if (
      editData?.product_id &&
      editData.product &&
      !base.find((o: any) => o.value === editData.product_id)
    ) {
      base.unshift({
        value: editData.product_id,
        label: editData.product.name ?? 'Product',
        sublabel: editData.product.code,
      })
    }
    return base
  }, [products, editData])

  const uomOptions = React.useMemo(() => {
    const base = uoms.map((u: any) => ({
      value: u.id as number,
      label: (u.name as string) ?? '',
      sublabel: u.code as string | undefined,
    }))
    if (
      editData?.uom_id &&
      editData.uom &&
      !base.find((o: any) => o.value === editData.uom_id)
    ) {
      base.unshift({
        value: editData.uom_id,
        label: editData.uom.name ?? 'UOM',
        sublabel: editData.uom.code,
      })
    }
    return base
  }, [uoms, editData])

  useEffect(() => {
    if (editData) {
      reset({
        product_id: editData.product_id ?? 0,
        uom_id: editData.uom_id ?? 0,
        code: editData.code ?? '',
        base_price: editData.base_price ?? 0,
        online_price: editData.online_price ?? 0,
        franchise_price: editData.franchise_price ?? 0,
        price_editable: editData.price_editable ?? false,
        is_default: editData.is_default ?? false,
      })
    } else {
      reset({
        product_id: 0,
        uom_id: 0,
        code: '',
        base_price: 0,
        online_price: 0,
        franchise_price: 0,
        price_editable: false,
        is_default: false,
      })
    }
  }, [editData, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => productUomsService.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-uoms'] })
      toast.success('Product UOM created')
      reset({
        product_id: 0,
        uom_id: 0,
        code: '',
        base_price: 0,
        online_price: 0,
        franchise_price: 0,
        price_editable: false,
        is_default: false,
      })
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to create product UOM'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => productUomsService.update(editData!.id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-uoms'] })
      toast.success('Product UOM updated')
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to update product UOM'),
  })

  const onSubmit = (values: FormValues) => {

    if (editData) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 14,
    color: 'var(--foreground)',
    background: 'var(--surface)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box' as const,
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
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }}
      />

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
            {editData ? 'Edit Product UOM' : 'New Product UOM'}
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
          {/* Product */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 2 }}>
              Product
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <Controller
              control={control}
              name="product_id"
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? 0}
                  onChange={field.onChange}
                  options={productOptions}
                  placeholder="Select product..."
                  searchPlaceholder="Search products..."
                  loading={productsLoading}
                  onSearchChange={setProductSearch}
                  error={errors.product_id?.message as string | undefined}
                  disabled={isEdit}
                />
              )}
            />
          </div>

          {/* UOM */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 2 }}>
              Unit of Measure
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <Controller
              control={control}
              name="uom_id"
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? 0}
                  onChange={field.onChange}
                  options={uomOptions}
                  placeholder="Select UOM..."
                  searchPlaceholder="Search UOMs..."
                  loading={uomsLoading}
                  error={errors.uom_id?.message as string | undefined}
                  onSearchChange={setDropdownSearch}
/>
              )}
            />
          </div>

          {/* Code */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 2 }}>
              Code
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <input
              {...register('code')}
              placeholder="e.g. CHOC-KG"
              style={inputStyle}
            />
            {errors.code?.message && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {errors.code.message as string}
              </span>
            )}
          </div>

          {/* Base Price / Online Price / Franchise Price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                Base Price
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatNumber(watch('base_price'), getCanReadPrice())}
                disabled={!getCanReadPrice()}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d]/g, '')
                  setValue('base_price', raw === '' ? 0 : parseInt(raw, 10) || 0)
                }}
                placeholder="0"
                style={{ ...inputStyle, ...( !getCanReadPrice() ? { background: 'var(--surface)', cursor: 'not-allowed' } : {} ) }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                Online Price
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatNumber(watch('online_price'), getCanReadPrice())}
                disabled={!getCanReadPrice()}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d]/g, '')
                  setValue('online_price', raw === '' ? 0 : parseInt(raw, 10) || 0)
                }}
                placeholder="0"
                style={{ ...inputStyle, ...( !getCanReadPrice() ? { background: 'var(--surface)', cursor: 'not-allowed' } : {} ) }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                Franchise Price
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatNumber(watch('franchise_price'), canReadFranchisePrice)}
                disabled={!canReadFranchisePrice}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d]/g, '')
                  setValue('franchise_price', raw === '' ? 0 : parseInt(raw, 10) || 0)
                }}
                placeholder="0"
                style={{ ...inputStyle, ...( !canReadFranchisePrice ? { background: 'var(--surface)', cursor: 'not-allowed' } : {} ) }}
              />
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Price Editable */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                Price Editable
              </label>
              <Controller
                name="price_editable"
                control={control}
                render={({ field }) => (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {([true, false] as const).map((val) => (
                      <button
                        key={String(val)}
                        type="button"
                        onClick={() => field.onChange(val)}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          background: field.value === val
                            ? val ? 'var(--success-bg)' : 'var(--destructive-bg)'
                            : 'var(--background)',
                          color: field.value === val
                            ? val ? 'var(--success)' : 'var(--destructive)'
                            : 'var(--foreground-muted)',
                          border: field.value === val
                            ? `1px solid ${val ? 'var(--success)' : 'var(--destructive)'}`
                            : '1px solid var(--border)',
                        }}
                      >
                        {val ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* Is Default */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                Is Default
              </label>
              <Controller
                name="is_default"
                control={control}
                render={({ field }) => (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {([true, false] as const).map((val) => (
                      <button
                        key={String(val)}
                        type="button"
                        onClick={() => field.onChange(val)}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          background: field.value === val
                            ? val ? 'var(--success-bg)' : 'var(--destructive-bg)'
                            : 'var(--background)',
                          color: field.value === val
                            ? val ? 'var(--success)' : 'var(--destructive)'
                            : 'var(--foreground-muted)',
                          border: field.value === val
                            ? `1px solid ${val ? 'var(--success)' : 'var(--destructive)'}`
                            : '1px solid var(--border)',
                        }}
                      >
                        {val ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>
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
            {editData ? 'Save Changes' : 'Create Product UOM'}
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
