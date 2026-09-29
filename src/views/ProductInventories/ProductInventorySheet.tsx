'use client'

import React, { useState,  useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productInventoriesService } from '@/services/product-inventories.service'
import { toastMutationApiError } from '@/utils/apiError'
import { getProductUomName } from '@/utils/productUomName'
import { productUomsService } from '@/services/product-uoms.service'
import { X, Loader2 } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'



const createSchema = z.object({
  product_uom_id: z.coerce.number().min(1, 'Please select a product'),
  code: z.string().min(1, 'SKU Code is required'),
  expiry_date: z.string().optional(),
  status: z.enum(['active', 'inactive'], { message: 'Status is required' }),
})

const editSchema = z.object({
  code: z.string().optional(),
  expiry_date: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

const schema = z.object({
  product_uom_id: z.coerce.number().min(0).optional(),
  code: z.string().optional(),
  expiry_date: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
})
type FormValues = z.infer<typeof schema>

interface ProductInventorySheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    product_uom_id: number
    code?: string
    expiry_date?: string
    status?: 'active' | 'inactive'
    product_uom_batch?: {
      code?: string
      expiry_date?: string
    }
  } | null
}

const parseExpiryDate = (dateStr?: string) => {
  if (!dateStr) return ''
  // Jika format awalnya YYYY-MM-DD
  if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
    return dateStr.split('T')[0]
  }
  // Jika formatnya DD-MM-YYYY (contoh: 15-06-2026 04:55 WIB)
  const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})/)
  if (match) {
    const [, d, m, y] = match
    return `${y}-${m}-${d}`
  }
  return ''
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 14,
  color: 'var(--foreground)',
  background: 'var(--surface-raised)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--foreground)',
  marginBottom: 4,
  display: 'block',
}

export default function ProductInventorySheet({
  open,
  onClose,
  editData,
}: ProductInventorySheetProps) {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const queryClient = useQueryClient()
  const isEditMode = !!editData

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(isEditMode ? editSchema : createSchema) as any,
    defaultValues: {
      product_uom_id: 0,
      code: '',
      expiry_date: '',
      status: 'active',
    },
  })

  const { data: productUomsData, isLoading: productUomsLoading } = useQuery({
    queryKey: ['product-uoms-all', debouncedDropdownSearch],
    queryFn: () =>
      productUomsService
        .list({
          'filter[search]': debouncedDropdownSearch || undefined,
          per_page: 1000,
          include: 'product,uom',
          'filter[is_active]': true,
        })
        .then((r) => r.data),
    enabled: !isEditMode,
  })
  const productUoms = (productUomsData as any)?.data ?? []

  const productUomOptions = productUoms.map((pu: any) => ({
    value: pu.id as number,
    label: getProductUomName(pu, pu.product?.name) || `Product UOM #${pu.id}`,
    sublabel: pu.uom?.name ?? undefined,
    description: pu.code ?? undefined,
  }))

  useEffect(() => {
    if (editData) {
      const code = editData.product_uom_batch?.code ?? editData.code ?? ''
      const expiry = editData.product_uom_batch?.expiry_date ?? editData.expiry_date

      reset({
        product_uom_id: editData.product_uom_id,
        code: code,
        expiry_date: parseExpiryDate(expiry),
        status: editData.status ?? 'active',
      })
    } else {
      reset({
        product_uom_id: 0,
        code: '',
        expiry_date: '',
        status: 'active',
      })
    }
  }, [editData, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) =>
      productInventoriesService.create({
        product_uom_id: data.product_uom_id!,
        code: data.code!,
        expiry_date: data.expiry_date || undefined,
        status: data.status ?? 'active',
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      toast.success('Inventory item created')
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to create inventory item'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) =>
      productInventoriesService.update(editData!.id, {
        code: data.code,
        expiry_date: data.expiry_date || undefined,
        status: data.status,
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      toast.success('Inventory item updated')
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to update inventory item'),
  })

  const onSubmit = (values: FormValues) => {
    if (isEditMode) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const onInvalid = (errs: any) => {

    const first = Object.values(errs)[0] as { message?: string } | undefined
    toast.error(first?.message ?? 'Please fill in all required fields')
    if (typeof document !== 'undefined') {
      document
        .querySelector('[data-sheet-body]')
        ?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

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
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.18)',
        }}
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
            {isEditMode ? 'Edit Inventory Item' : 'New Inventory Item'}
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

        <form
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <div
            data-sheet-body
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
          {/* Create: Product UOM */}
          {!isEditMode && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Product UOM
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <Controller
                name="product_uom_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 0}
                    onChange={field.onChange}
                    options={productUomOptions}
                    placeholder="Select product UOM..."
                    searchPlaceholder="Search products..."
                    loading={productUomsLoading}
                    error={errors.product_uom_id?.message as string | undefined}
                    onSearchChange={setDropdownSearch}
/>
                )}
              />
            </div>
          )}

          {!isEditMode && (
            <>
              {/* SKU Code */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  SKU Code
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <input
                  {...register('code')}
                  placeholder="e.g. SK000000001"
                  style={{
                    ...inputStyle,
                    ...(errors.code ? { border: '1px solid var(--destructive)' } : {}),
                  }}
                />
                {errors.code && <span style={{ fontSize: 12, color: 'var(--destructive)', marginTop: 4 }}>{errors.code.message}</span>}
              </div>

              {/* Expiry Date */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>Expiry Date</label>
                <input type="date" {...register('expiry_date')} style={inputStyle} />
                <span style={{ fontSize: 11, color: 'var(--foreground-subtle)', marginTop: 4 }}>
                  Leave empty if no expiry
                </span>
              </div>
            </>
          )}

          {/* Status + price_editable */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Status
                {!isEditMode && <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>}
              </label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['active', 'inactive'] as const).map((s) => {
                      const isSel = field.value === s
                      const isActive = s === 'active'
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => field.onChange(s)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: 'pointer',
                            border: isSel
                              ? isActive
                                ? '1px solid var(--success)'
                                : '1px solid var(--destructive)'
                              : '1px solid var(--border)',
                            background: isSel
                              ? isActive ? 'var(--success-bg)' : 'var(--destructive-bg)'
                              : 'var(--surface)',
                            color: isSel
                              ? isActive ? 'var(--success)' : 'var(--destructive)'
                              : 'var(--foreground-muted)',
                          }}
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      )
                    })}
                  </div>
                )}
              />
              {errors.status && (
                <span style={{ fontSize: 12, color: 'var(--destructive)', marginTop: 4 }}>
                  {errors.status.message as string}
                </span>
              )}
            </div>


          </div>
          </div>

          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: 10,
              justifyContent: 'flex-end',
              flexShrink: 0,
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
              type="submit"
              disabled={isPending}
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
              {isEditMode ? 'Save Changes' : 'Create Inventory Item'}
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}
