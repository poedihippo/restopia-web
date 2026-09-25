'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productInventoriesService } from '@/services/product-inventories.service'
import { productUomsService } from '@/services/product-uoms.service'
import { toastMutationApiError } from '@/utils/apiError'
import type { ConvertProductInventoryResponse } from '@/types/api'
import { X, Loader2, ArrowLeftRight, CheckCircle2, AlertTriangle } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'

const schema = z.object({
  target_product_uom_id: z.coerce.number().min(1, 'Please select a target product UOM'),
  qty: z.coerce.number({ message: 'Qty is required' }).positive('Qty must be greater than 0'),
})
type FormValues = z.infer<typeof schema>

export interface ConvertSourceInventory {
  id: number
  qty?: number
  stock?: number
  display_qty?: number | null
  display_uom_code?: string | null
  code?: string
  product_uom_id: number
  product_uom_batch?: {
    batch_code?: string
    product_uom?: {
      id?: number
      code?: string
      product?: { id: number; name: string }
      uom?: { name: string; code: string }
    }
  }
  product_uom?: {
    id?: number
    code?: string
    product?: { id: number; name: string }
    uom?: { name: string; code: string }
  }
  branch?: { name?: string; code?: string }
}

interface ConvertSheetProps {
  open: boolean
  onClose: () => void
  inventory: ConvertSourceInventory | null
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

const summaryBoxStyle: React.CSSProperties = {
  flex: 1,
  padding: 14,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--background)',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const num = (v?: number) => (v ?? 0).toLocaleString('id-ID')

export default function ProductInventoryConvertSheet({
  open,
  onClose,
  inventory,
}: ConvertSheetProps) {
  const queryClient = useQueryClient()
  const [result, setResult] = useState<ConvertProductInventoryResponse | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      target_product_uom_id: 0,
      qty: 0,
    },
  })

  const qtyWatch = watch('qty')
  const targetPuId = watch('target_product_uom_id')

  // Convert moves stock out of `inventory` in ITS OWN product_uom (the qty
  // entered below is in that unit, sent straight to the backend), so
  // availability must compare against display_qty — the on-hand quantity in
  // that specific row's uom — never base_stock (a different unit).
  const sourceStock = Number(inventory?.display_qty ?? inventory?.stock ?? inventory?.qty ?? 0)

  const sourceProductId =
    inventory?.product_uom_batch?.product_uom?.product?.id ??
    inventory?.product_uom?.product?.id

  const { data: productUomsData, isLoading: productUomsLoading } = useQuery({
    queryKey: ['product-uoms-all', sourceProductId],
    queryFn: () =>
      productUomsService
        .list({
          per_page: 1000,
          include: 'product,uom',
          'filter[is_active]': true,
        })
        .then((r: any) => r.data),
    enabled: !!open && !!inventory,
  })
  const productUoms = (productUomsData as any)?.data ?? []

  const sourcePuCode =
    inventory?.product_uom_batch?.product_uom?.code ??
    inventory?.product_uom?.code ??
    productUoms.find((pu: any) => pu.id === inventory?.product_uom_id)?.code

  const sameProductUoms = useMemo(() => {
    const pid = sourceProductId
    if (!pid) return []
    return productUoms.filter(
      (pu: any) => (pu.product?.id ?? pu.product_id) === pid && pu.id !== inventory?.product_uom_id,
    )
  }, [productUoms, sourceProductId, inventory?.product_uom_id])

  const targetOptions = sameProductUoms.map((pu: any) => ({
    value: pu.id as number,
    label: pu.uom?.name ?? `UOM #${pu.uom_id ?? pu.id}`,
    sublabel: pu.uom?.code ?? undefined,
    description: pu.code ?? undefined,
  }))

  const selectedTargetPu = sameProductUoms.find((pu: any) => pu.id === Number(targetPuId))

  useEffect(() => {
    if (!open) {
      setResult(null)
      reset({ target_product_uom_id: 0, qty: 0 })
    }
  }, [open, reset])

  const convertMutation = useMutation({
    mutationFn: (values: FormValues) =>
      productInventoriesService.convert({
        product_inventory_id: inventory!.id,
        target_product_uom_id: values.target_product_uom_id,
        qty: values.qty,
      } as any),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      setResult(res?.data?.data ?? res?.data ?? null)
      toast.success('Inventory converted successfully')
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to convert inventory'),
  })

  const onSubmit = (values: FormValues) => {
    if (values.qty > sourceStock) {
      toast.error(`Qty cannot exceed available stock (${sourceStock.toLocaleString('id-ID')})`)
      return
    }
    convertMutation.mutate(values)
  }

  const onInvalid = (errs: any) => {
    const first = Object.values(errs)[0] as { message?: string } | undefined
    toast.error(first?.message ?? 'Please fill in all required fields')
  }

  const isPending = convertMutation.isPending
  const overStock = qtyWatch !== undefined && Number(qtyWatch) > sourceStock

  if (!open || !inventory) return null

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
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ArrowLeftRight size={18} color="var(--accent)" />
            Convert UOM
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
          {/* Source inventory info */}
          <div style={summaryBoxStyle}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--foreground-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
              }}
            >
              Source Inventory
            </span>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
              {inventory.product_uom_batch?.product_uom?.product?.name ??
                inventory.product_uom?.product?.name ??
                `Inventory #${inventory.id}`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
              {sourcePuCode ? `SKU: ${sourcePuCode} · ` : ''}
              {inventory.product_uom_batch?.batch_code ?? 'No batch'}
              {inventory.branch?.name ? ` · ${inventory.branch.name}` : ''}
            </div>
            <div style={{ fontSize: 13, color: 'var(--foreground)' }}>
              Available stock:{' '}
              <strong>
                {num(sourceStock)}{' '}
                {inventory.display_uom_code ??
                  inventory.product_uom_batch?.product_uom?.uom?.code ??
                  inventory.product_uom?.uom?.code ??
                  ''}
              </strong>
            </div>
          </div>

          {result ? (
            /* Result summary */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  background: 'var(--success-bg)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--success)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <CheckCircle2 size={16} />
                Conversion completed
                {result.conversion_amount !== undefined && (
                  <span style={{ fontWeight: 400 }}>
                    · 1 source unit = {result.conversion_amount} target unit
                  </span>
                )}
              </div>

              {[
                {
                  title: 'Source (out)',
                  s: result.source,
                  extra: result.source_product_uom_id,
                },
                {
                  title: `Target (in)${result.target_product_inventory_created ? ' — new inventory created' : ''}`,
                  s: result.target,
                  extra: result.target_product_uom_id,
                },
              ].map((row) => (
                <div key={row.title} style={summaryBoxStyle}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--foreground-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                    }}
                  >
                    {row.title}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13, color: 'var(--foreground)' }}>
                    <span>Qty moved: <strong>{num(row.s?.qty)}</strong> {row.s?.uom_code ?? ''}</span>
                    <span>
                      Stock: {num(row.s?.stock_before)} → <strong>{num(row.s?.stock_after)}</strong> {row.s?.uom_code ?? ''}
                    </span>
                    {row.s?.batch_code && (
                      <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                        Batch: {row.s.batch_code}
                      </span>
                    )}
                    {!row.s && (
                      <span style={{ color: 'var(--foreground-muted)' }}>No movement data returned</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Form */
            <form
              id="convert-inventory-form"
              onSubmit={handleSubmit(onSubmit, onInvalid)}
              style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
            >
              {/* Target product UOM */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
                  Target Product UOM
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <SearchableSelect
                  value={targetPuId ?? 0}
                  onChange={(v: number) => setValue('target_product_uom_id', v, { shouldValidate: true })}
                  options={targetOptions}
                  placeholder={
                    sameProductUoms.length === 0
                      ? 'No other UOM for this product'
                      : 'Select target UOM...'
                  }
                  searchPlaceholder="Search UOMs..."
                  loading={productUomsLoading}
                  disabled={sameProductUoms.length === 0}
                />
                <span style={{ fontSize: 11, color: 'var(--foreground-subtle)', marginTop: 4 }}>
                  Target must be another UOM of the same product
                </span>
              </div>

              {/* Qty */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
                  Qty to Convert
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  {...register('qty')}
                  placeholder="e.g. 5"
                  style={{
                    ...inputStyle,
                    ...(overStock || errors.qty ? { border: '1px solid var(--destructive)' } : {}),
                  }}
                />
                {overStock && (
                  <span style={{ fontSize: 12, color: 'var(--destructive)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={12} />
                    Exceeds available stock ({num(sourceStock)})
                  </span>
                )}
                {errors.qty && !overStock && (
                  <span style={{ fontSize: 12, color: 'var(--destructive)', marginTop: 4 }}>
                    {errors.qty.message}
                  </span>
                )}
                <span style={{ fontSize: 11, color: 'var(--foreground-subtle)', marginTop: 4 }}>
                  Converted qty in target UOM is calculated automatically from the product conversion rules
                </span>
                {selectedTargetPu && (
                  <span style={{ fontSize: 12, color: 'var(--info)', marginTop: 4 }}>
                    Target: {selectedTargetPu.uom?.name ?? 'UOM'} ({selectedTargetPu.uom?.code ?? selectedTargetPu.code ?? ''})
                  </span>
                )}
              </div>
            </form>
          )}
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
          {result ? (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 500,
                color: 'white',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          ) : (
            <>
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
                form="convert-inventory-form"
                disabled={isPending || overStock || Number(qtyWatch) <= 0 || !Number(targetPuId)}
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
                <ArrowLeftRight size={14} />
                Convert
              </button>
            </>
          )}
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}
