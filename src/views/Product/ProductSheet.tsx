'use client'

import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productsService } from '@/services/products.service'
import { productCategoriesService } from '@/services/product-categories.service'
import { X, Loader2 } from 'lucide-react'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  product_category_id: z.coerce.number()
    .min(1, 'Category is required'),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']),
})
type FormValues = z.infer<typeof schema>

interface ProductSheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    name: string
    code?: string
    product_category_id: number
    description?: string
    status: 'active' | 'inactive'
  } | null
}

export default function ProductSheet({ open, onClose, editData }: ProductSheetProps) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      code: '',
      product_category_id: undefined as unknown as number,
      description: '',
      status: 'active',
    },
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories-all'],
    queryFn: () =>
      productCategoriesService.list({ per_page: 100 }).then((r) => r.data.data),
  })
  const categories: { id: number; name: string }[] = (categoriesData as any)?.data ?? []

  useEffect(() => {
    if (editData) {
      reset({
        name: editData.name,
        code: editData.code ?? '',
        product_category_id: editData.product_category_id,
        description: editData.description ?? '',
        status: editData.status,
      })
    } else {
      reset({
        name: '',
        code: '',
        product_category_id: undefined as unknown as number,
        description: '',
        status: 'active',
      })
    }
  }, [editData, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => productsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product created')
      onClose()
    },
    onError: () => toast.error('Failed to create product'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => productsService.update(editData!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product updated')
      onClose()
    },
    onError: () => toast.error('Failed to update product'),
  })

  const onSubmit = (values: FormValues) => {
    if (editData) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!open) return null

  const fieldLabel = (text: string) => (
    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
      {text}
    </label>
  )

  const inputBase = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '9px 12px',
    border: `1px solid ${hasError ? 'var(--destructive)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-md)',
    fontSize: 14,
    color: 'var(--foreground)',
    background: 'var(--surface)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  })

  const errorMsg = (msg?: string) =>
    msg ? (
      <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{msg}</span>
    ) : null

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
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'relative',
          zIndex: 50,
          width: 460,
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
            {editData ? 'Edit Product' : 'New Product'}
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
          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fieldLabel('Product Name')}
            <input
              {...register('name')}
              placeholder="e.g. Chocolate Truffle Cake"
              style={inputBase(!!errors.name)}
            />
            {errorMsg(errors.name?.message)}
          </div>

          {/* Code */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fieldLabel('Product Code')}
            <input
              {...register('code')}
              placeholder="e.g. CHOC-001 (optional)"
              style={inputBase(false)}
            />
          </div>

          {/* Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fieldLabel('Category')}
            <Controller
              name="product_category_id"
              control={control}
              render={({ field }) => (
                <select
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value ? Number(e.target.value) : undefined)
                  }
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: `1px solid ${errors.product_category_id ? 'var(--destructive)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    fontSize: 14,
                    color: 'var(--foreground)',
                    background: 'var(--surface)',
                    outline: 'none',
                    appearance: 'none',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="" disabled>
                    Select a category
                  </option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              )}
            />
            {errorMsg(errors.product_category_id?.message)}
          </div>

          {/* Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fieldLabel('Status')}
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['active', 'inactive'] as const).map((s) => {
                    const isSelected = field.value === s
                    const isActive = s === 'active'
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
                            ? isActive
                              ? 'var(--success-bg)'
                              : 'var(--destructive-bg)'
                            : 'var(--background)',
                          color: isSelected
                            ? isActive
                              ? 'var(--success)'
                              : 'var(--destructive)'
                            : 'var(--foreground-muted)',
                          border: isSelected
                            ? `1px solid ${isActive ? 'var(--success)' : 'var(--destructive)'}`
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

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fieldLabel('Description')}
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Optional notes about this product"
              style={{
                ...inputBase(false),
                resize: 'vertical',
                minHeight: 80,
              }}
            />
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
            {editData ? 'Save Changes' : 'Create Product'}
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
