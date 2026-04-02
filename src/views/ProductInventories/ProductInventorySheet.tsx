'use client'

import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productInventoriesService } from '@/services/product-inventories.service'
import { productUomsService } from '@/services/product-uoms.service'
import { branchesService } from '@/services/branches.service'
import { X, Loader2 } from 'lucide-react'

const schema = z.object({
  product_uom_id: z.preprocess(
    val => (val === '' || val === undefined || val === null) ? undefined : Number(val),
    z.number({ message: 'Product UOM is required' })
  ),
  branch_id: z.preprocess(
    val => (val === '' || val === undefined || val === null) ? undefined : Number(val),
    z.number({ message: 'Branch is required' })
  ),
  qty: z.number().min(0).optional(),
  min_qty: z.number().min(0).optional(),
})
type FormValues = z.infer<typeof schema>

interface ProductInventorySheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    product_uom_id: number
    branch_id: number
    qty?: number
    min_qty?: number
  } | null
}

export default function ProductInventorySheet({
  open,
  onClose,
  editData,
}: ProductInventorySheetProps) {
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
      product_uom_id: undefined,
      branch_id: undefined,
      qty: 0,
      min_qty: 0,
    },
  })

  const { data: productUomsData } = useQuery({
    queryKey: ['product-uoms-all'],
    queryFn: () =>
      productUomsService
        .list({ per_page: 200, include: 'product,uom' })
        .then((r) => r.data.data),
  })
  const productUoms = (productUomsData as any)?.data ?? []

  const { data: branchesData } = useQuery({
    queryKey: ['branches-all'],
    queryFn: () =>
      branchesService.list({ per_page: 100 }).then((r) => r.data.data),
  })
  const branches = (branchesData as any)?.data ?? []

  useEffect(() => {
    if (editData) {
      reset({
        product_uom_id: editData.product_uom_id,
        branch_id: editData.branch_id,
        qty: editData.qty ?? 0,
        min_qty: editData.min_qty ?? 0,
      })
    } else {
      reset({
        product_uom_id: undefined,
        branch_id: undefined,
        qty: 0,
        min_qty: 0,
      })
    }
  }, [editData, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => productInventoriesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      toast.success('Inventory item created')
      onClose()
    },
    onError: () => toast.error('Failed to create inventory item'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) =>
      productInventoriesService.update(editData!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      toast.success('Inventory item updated')
      onClose()
    },
    onError: () => toast.error('Failed to update inventory item'),
  })

  const onSubmit = (values: FormValues) => {
    if (editData) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const selectStyle = {
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
    cursor: 'pointer',
  }

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
            {editData ? 'Edit Inventory Item' : 'New Inventory Item'}
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
          {/* Product UOM field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--foreground)',
              }}
            >
              Product UOM
            </label>
            <Controller
              name="product_uom_id"
              control={control}
              render={({ field }) => (
                <select
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  style={{
                    ...selectStyle,
                    border: `1px solid ${errors.product_uom_id ? 'var(--destructive)' : 'var(--border)'}`,
                  }}
                >
                  <option value="" disabled>
                    Select product UOM
                  </option>
                  {productUoms.map((pu: any) => (
                    <option key={pu.id} value={pu.id}>
                      {pu.product?.name ?? pu.id}
                      {' — '}
                      {pu.uom?.name ?? ''}
                      {pu.code ? ` (${pu.code})` : ''}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.product_uom_id && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {errors.product_uom_id.message}
              </span>
            )}
          </div>

          {/* Branch field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--foreground)',
              }}
            >
              Branch
            </label>
            <Controller
              name="branch_id"
              control={control}
              render={({ field }) => (
                <select
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  style={{
                    ...selectStyle,
                    border: `1px solid ${errors.branch_id ? 'var(--destructive)' : 'var(--border)'}`,
                  }}
                >
                  <option value="" disabled>
                    Select branch
                  </option>
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.branch_id && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {errors.branch_id.message}
              </span>
            )}
          </div>

          {/* Qty + Min Qty row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            {/* Current Qty */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                }}
              >
                Current Qty
              </label>
              <input
                {...register('qty', { valueAsNumber: true })}
                type="number"
                min="0"
                placeholder="0"
                style={inputStyle}
              />
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                Initial stock quantity
              </span>
            </div>

            {/* Minimum Qty */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                }}
              >
                Minimum Qty
              </label>
              <input
                {...register('min_qty', { valueAsNumber: true })}
                type="number"
                min="0"
                placeholder="0"
                style={inputStyle}
              />
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                Alert threshold for low stock
              </span>
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
              <Loader2
                size={14}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            )}
            {editData ? 'Save Changes' : 'Create Inventory Item'}
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
