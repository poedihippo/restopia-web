'use client'

import React, { useState,  useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { stockMovementsService } from '@/services/stock-movements.service'
import { toastMutationApiError } from '@/utils/apiError'
import { productUomBatchesService } from '@/services/product-uom-batches.service'
import { useAuth } from '@/hooks/useAuth'
import SearchableSelect from '@/components/SearchableSelect'
import { X, Loader2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'

const formatExpiry = (v?: string) => {
  if (!v) return 'No expiry'
  const d = new Date(v)
  return isNaN(d.getTime())
    ? 'No expiry'
    : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const schema = z.object({
  product_uom_batch_id: z.coerce.number()
    .min(1, 'Product UOM Batch is required'),
  qty: z.coerce.number()
    .min(0.0001, 'Must be greater than 0'),
  direction: z.enum(['in', 'out']),
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
]

export default function StockMovementSheet({ open, onClose }: StockMovementSheetProps) {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const activeBranchId = (user as any)?.branch?.id
  const activeBranchName = (user as any)?.branch?.name

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
      product_uom_batch_id: 0,
      qty: 0,
      direction: 'in' as const,
      description: '',
    },
  })

  const { data: batchesData } = useQuery({
    queryKey: ['product-uom-batches-all', debouncedDropdownSearch],
    queryFn: async () => {
      let allBatches: any[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await productUomBatchesService
          .list({ 'filter[search]': debouncedDropdownSearch || undefined, 
            page,
            per_page: 100,
            include: 'product_uom',
          } as any)
          .then((r) => r.data)
        const items = (res as any)?.data ?? []
        allBatches = allBatches.concat(items)
        totalPages =
          (res as any)?.meta?.last_page ??
          (res as any)?.meta?.total_pages ??
          1
        page += 1
      } while (page <= totalPages)
      return { data: allBatches }
    },
  })
  const batchesItems = (batchesData as any)?.data ?? []

  const watchDirection = watch('direction')
  const watchQty = watch('qty')
  const watchBatchId = watch('product_uom_batch_id')
  //trigger
  const batchOptions = batchesItems.map((batch: any) => {
    const name =
      batch.product_uom?.product?.name ??
      batch.code ??
      `BATCH-${batch.id}`
    const uomCode =
      batch.product_uom?.uom?.code ??
      batch.product_uom?.uom?.name ??
      ''
    const expiryDate = batch.expiry_date?.substring(0, 10) ?? 'No expiry';
    return {
      value: batch.id as number,
      label: `${name} — ${uomCode} — Stock: ${batch.stock}-Exp Date:${expiryDate}`,
      sublabel: batch.batch_code ?? undefined,
    }
  })

  const selectedBatch = batchesItems.find((batch: any) => batch.id === watchBatchId)
  const negativeStock =
    watchDirection === 'out' &&
    selectedBatch &&
    Number(watchQty) > Number(selectedBatch.stock)

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => stockMovementsService.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      toast.success('Stock movement recorded')
      reset()
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to record movement'),
  })

  const onSubmit = (values: FormValues) => {
    const selectedBatch = batchesItems.find((batch: any) => batch.id === values.product_uom_batch_id)
    if (!selectedBatch) {
      toast.error('Invalid batch selected')
      return
    }

    const payload = {
      product_uom_batch_id: values.product_uom_batch_id,
      qty: values.qty,
      direction: values.direction,
      description: values.description,
    }

    createMutation.mutate(payload as any)
  }

  const isPending = createMutation.isPending

  const getQtyBorderColor = () => {
    if (!watchQty) return 'var(--border)'
    if (watchDirection === 'in') return 'var(--success)'
    return 'var(--destructive)'
  }

  const getSubmitBg = () => {
    if (watchDirection === 'in') return 'var(--success)'
    return 'var(--destructive)'
  }

  const getSubmitLabel = () => {
    if (watchDirection === 'in') return 'Record Stock In'
    return 'Record Stock Out'
  }

  const getQtyLabel = () => {
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch]);

    if (watchDirection === 'in') return 'Quantity to Add'
    return 'Quantity to Remove'
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
          <div>
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
            {activeBranchName && (
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: 12,
                  color: 'var(--foreground-muted)',
                }}
              >
                At: {activeBranchName}
              </p>
            )}
          </div>
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
          {/* Movement Type — card selector */}
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
              Movement Type
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <Controller
              name="direction"
              control={control}
              render={({ field }) => (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
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

          {/* Batch Item */}
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
              Product UOM Batch
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <Controller
              name="product_uom_batch_id"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? 0}
                  onChange={(v) => field.onChange(v)}
                  options={batchOptions}
                  placeholder="Select batch"
                  searchPlaceholder="Search batch..."
                  error={errors.product_uom_batch_id?.message}
                  onSearchChange={setDropdownSearch}
/>
              )}
            />
            {selectedBatch && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '10px 12px',
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  color: 'var(--foreground-muted)',
                }}
              >
                <span>
                  Current stock:{' '}
                  <strong style={{ color: 'var(--foreground)' }}>
                    {selectedBatch.stock}
                  </strong>
                </span>
                <span>
                  Batch:{' '}
                  {selectedBatch.batch_code ?? '—'}
                </span>
                <span>
                  Expiry:{' '}
                  {formatExpiry(selectedBatch.expiry_date)}
                </span>
              </div>
            )}
          </div>

          {/* Qty */}
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
              {getQtyLabel()}
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
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
            {negativeStock && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: 'var(--warning)',
                }}
              >
                <AlertTriangle size={13} />
                This will result in negative stock
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
