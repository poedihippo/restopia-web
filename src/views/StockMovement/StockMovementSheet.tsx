'use client'

import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { stockMovementsService } from '@/services/stock-movements.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { X, Loader2, TrendingUp, TrendingDown, SlidersHorizontal } from 'lucide-react'

const schema = z.object({
  product_inventory_id: z.coerce.number()
    .min(1, 'Inventory item is required'),
  qty: z.coerce.number()
    .min(0.0001, 'Must be greater than 0'),
  type: z.enum(['in', 'out', 'adjustment']),
  description: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface StockMovementSheetProps {
  open: boolean
  onClose: () => void
}

const TYPE_OPTIONS = [
  {
    value: 'in' as const,
    label: 'Stock In',
    description: 'Add stock to inventory',
    icon: TrendingUp,
    color: 'var(--success)',
    bg: 'var(--success-bg)',
    border: 'var(--success)',
  },
  {
    value: 'out' as const,
    label: 'Stock Out',
    description: 'Remove stock from inventory',
    icon: TrendingDown,
    color: 'var(--destructive)',
    bg: 'var(--destructive-bg)',
    border: 'var(--destructive)',
  },
  {
    value: 'adjustment' as const,
    label: 'Adjustment',
    description: 'Manual stock correction',
    icon: SlidersHorizontal,
    color: 'var(--warning)',
    bg: 'var(--warning-bg)',
    border: 'var(--warning)',
  },
]

export default function StockMovementSheet({ open, onClose }: StockMovementSheetProps) {
  const queryClient = useQueryClient()

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
      product_inventory_id: 0,
      qty: 0,
      type: 'in',
      description: '',
    },
  })

  const { data: inventoryData } = useQuery({
    queryKey: ['product-inventories-all'],
    queryFn: () =>
      productInventoriesService
        .list({
          per_page: 200,
          include: 'product_uom.product,product_uom.uom,branch',
        })
        .then((r) => r.data),
  })
  const inventoryItems = (inventoryData as any)?.data?.data ?? []

  const watchType = watch('type')
  const watchQty = watch('qty')

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => stockMovementsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      toast.success('Stock movement recorded')
      reset()
      onClose()
    },
    onError: () => toast.error('Failed to record movement'),
  })

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values)
  }

  const isPending = createMutation.isPending

  const getQtyBorderColor = () => {
    if (!watchQty) return 'var(--border)'
    if (watchType === 'in') return 'var(--success)'
    if (watchType === 'out') return 'var(--destructive)'
    return 'var(--warning)'
  }

  const getSubmitBg = () => {
    if (watchType === 'in') return 'var(--success)'
    if (watchType === 'out') return 'var(--destructive)'
    return 'var(--warning)'
  }

  const getSubmitLabel = () => {
    if (watchType === 'in') return 'Record Stock In'
    if (watchType === 'out') return 'Record Stock Out'
    return 'Record Adjustment'
  }

  const getQtyLabel = () => {
    if (watchType === 'in') return 'Quantity to Add'
    if (watchType === 'out') return 'Quantity to Remove'
    return 'Adjusted Quantity'
  }

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
            Record Stock Movement
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
          {/* Movement Type — card selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--foreground)',
              }}
            >
              Movement Type
            </label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                  }}
                >
                  {TYPE_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    const isSelected = field.value === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field.onChange(opt.value)}
                        style={{
                          padding: '10px 8px',
                          border: `1px solid ${isSelected ? opt.border : 'var(--border)'}`,
                          borderRadius: 'var(--radius-md)',
                          background: isSelected ? opt.bg : 'var(--surface)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 150ms ease',
                        }}
                      >
                        <Icon
                          size={18}
                          style={{
                            color: isSelected ? opt.color : 'var(--foreground-muted)',
                          }}
                        />
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: isSelected ? opt.color : 'var(--foreground)',
                          }}
                        >
                          {opt.label}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            textAlign: 'center',
                            color: isSelected ? opt.color : 'var(--foreground-muted)',
                            lineHeight: 1.3,
                          }}
                        >
                          {opt.description}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            />
          </div>

          {/* Inventory Item */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--foreground)',
              }}
            >
              Inventory Item
            </label>
            <Controller
              name="product_inventory_id"
              control={control}
              render={({ field }) => (
                <select
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  style={{
                    ...selectStyle,
                    border: `1px solid ${errors.product_inventory_id ? 'var(--destructive)' : 'var(--border)'}`,
                  }}
                >
                  <option value="" disabled>
                    Select inventory item
                  </option>
                  {inventoryItems.map((inv: any) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.product_uom?.product?.name ?? inv.id}
                      {' — '}
                      {inv.product_uom?.uom?.code ?? ''}
                      {' ('}
                      {inv.branch?.name ?? 'Unknown Branch'}
                      {') — Qty: '}
                      {inv.qty}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.product_inventory_id && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {errors.product_inventory_id.message}
              </span>
            )}
          </div>

          {/* Qty */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--foreground)',
              }}
            >
              {getQtyLabel()}
            </label>
            <input
              {...register('qty', { valueAsNumber: true })}
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0"
              style={{
                width: '100%',
                padding: '9px 12px',
                border: `1px solid ${errors.qty ? 'var(--destructive)' : getQtyBorderColor()}`,
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                color: 'var(--foreground)',
                background: 'var(--surface)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                boxSizing: 'border-box',
              }}
            />
            {errors.qty && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {errors.qty.message}
              </span>
            )}
          </div>

          {/* Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--foreground)',
              }}
            >
              Notes
            </label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Reason for this adjustment (optional)"
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                color: 'var(--foreground)',
                background: 'var(--surface)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                resize: 'vertical',
                minHeight: 80,
                boxSizing: 'border-box',
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
              background: getSubmitBg(),
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
            {getSubmitLabel()}
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
