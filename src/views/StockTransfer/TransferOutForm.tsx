'use client'
import { formatCurrency, getCanReadPrice } from '@/utils/price';

import React from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deliveriesService } from '@/services/deliveries.service'
import { branchesService } from '@/services/branches.service'
import { productUomsService } from '@/services/product-uoms.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { useAuth } from '@/hooks/useAuth'
import SearchableSelect from '@/components/SearchableSelect'
import { Plus, Trash2, Loader2, X } from 'lucide-react'
import { PriceDisplay } from '@/components/PriceDisplay'

const detailSchema = z.object({
  product_uom_id: z.coerce.number().min(1, 'Select a product'),
  product_uom_batch_id: z.coerce.number().optional(),
  qty: z.coerce.number().min(0.001, 'Qty required'),
  price: z.coerce.number().min(0),
  description: z.string().optional(),
})

const schema = z.object({
  target_branch_id: z.coerce.number().min(1, 'Select target branch'),
  date: z.string().min(1, 'Date required'),
  description: z.string().optional(),
  details: z.array(detailSchema).min(1, 'Add at least one item'),
})

type FormValues = z.infer<typeof schema>

interface TransferOutFormProps {
  onClose: () => void
  onSuccess: () => void
}

export default function TransferOutForm({ onClose, onSuccess }: TransferOutFormProps) {
  const today = new Date().toISOString().split('T')[0]
  const { user } = useAuth()
  const sourceBranchId = user?.branch?.id

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      target_branch_id: 0,
      date: today,
      description: '',
      details: [
        { product_uom_id: 0, product_uom_batch_id: undefined, qty: 1, price: 0, description: '' },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'details' })

  const watchDetails = watch('details')
  const totalPrice = watchDetails.reduce(
    (s, d) => s + Number(d.qty ?? 0) * Number(d.price ?? 0),
    0,
  )

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches-all', 'company'],
    queryFn: () =>
      branchesService.list({ per_page: 100, include: 'company' } as any).then((r) => r.data),
  })
  const branches = (branchesData as any)?.data ?? []

  const { data: productUomsData, isLoading: productUomsLoading } = useQuery({
    queryKey: ['product-uoms-all'],
    queryFn: async () => {
      let allProductUoms: any[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await productUomsService
          .list({ page, per_page: 100, include: 'product,uom' } as any)
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

  // Available stock at the SOURCE branch (current active branch). We fetch all
  // active inventory rows for this branch once, then pick a FIFO batch per line
  // client-side. /v1/product-inventories supports filter[branch_id] directly,
  // and filter[product_uom_id] per-UOM, but a single branch-wide fetch keeps
  // this to one query and matches the fetch-all pattern used elsewhere.
  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['transfer-out-source-inventory', sourceBranchId],
    enabled: !!sourceBranchId,
    queryFn: async () => {
      let allInv: any[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await productInventoriesService
          .list({
            page,
            per_page: 100,
            'filter[branch_id]': sourceBranchId,
            'filter[status]': 'active',
            include: 'branch,product_uom_batch',
          } as any)
          .then((r) => r.data)
        const items = (res as any)?.data ?? []
        allInv = allInv.concat(items)
        totalPages =
          (res as any)?.meta?.last_page ??
          (res as any)?.meta?.total_pages ??
          1
        page += 1
      } while (page <= totalPages)
      return { data: allInv }
    },
  })
  const inventories = (inventoryData as any)?.data ?? []

  // FIFO batch picker: oldest-expiring inventory row (with stock) for a UOM.
  // Primary sort: expiry_date ASC, NULL expiry treated as +Infinity so dated
  // batches ship before undated ones. Tiebreaker: batch created_at ASC.
  const pickFifoInventory = React.useCallback(
    (productUomId: number) => {
      if (!productUomId) return undefined
      const ts = (v?: string | null) => {
        if (!v) return Number.POSITIVE_INFINITY
        const t = new Date(v).getTime()
        return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
      }
      const candidates = inventories
        .filter((inv: any) => {
          const matchesUom =
            inv.product_uom_id === productUomId ||
            inv.product_uom_batch?.product_uom?.id === productUomId
          return (
            matchesUom &&
            !!inv.product_uom_batch?.id &&
            Number(inv.stock ?? 0) > 0
          )
        })
        .sort((a: any, b: any) => {
          const ae = ts(a.product_uom_batch?.expiry_date ?? a.expiry_date)
          const be = ts(b.product_uom_batch?.expiry_date ?? b.expiry_date)
          if (ae !== be) return ae - be
          const ac = ts(a.product_uom_batch?.created_at ?? a.created_at)
          const bc = ts(b.product_uom_batch?.created_at ?? b.created_at)
          return ac - bc
        })
      return candidates[0]
    },
    [inventories],
  )

  const formatBatchLabel = (inv: any) => {
    const code = inv?.product_uom_batch?.code ?? `Batch #${inv?.product_uom_batch?.id}`
    const exp = inv?.product_uom_batch?.expiry_date ?? inv?.expiry_date
    return exp
      ? `${code} — Exp: ${String(exp).split('T')[0]}`
      : `${code} — No expiry`
  }

  const branchOptions = branches
    .filter((b: any) => b.id !== (user as any)?.employee?.branch_id)
    .map((b: any) => ({
      value: b.id as number,
      label: (b.name as string) ?? '',
      sublabel: (b.company?.name as string) ?? '',
    }))

  const productUomOptions = productUoms.map((pu: any) => ({
    value: pu.id as number,
    label: (pu.product?.name as string) ?? '',
    sublabel: (pu.uom?.name as string) ?? (pu.code as string) ?? '',
  }))

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        source_type: 'transfer_to_branch',
        target_branch_id: values.target_branch_id,
        date: values.date,
        total_price: totalPrice,
        status: 'final',
        description: values.description || undefined,
        details: values.details
          .filter((d) => Number(d.product_uom_id) > 0)
          .map((d) => {
            const pick = pickFifoInventory(Number(d.product_uom_id))
            return {
              product_uom_id: d.product_uom_id,
              product_uom_batch_id: pick?.product_uom_batch?.id,
              qty: d.qty,
              price: d.price,
              status: 'packed',
              description: d.description || undefined,
            }
          }),
      }
      return deliveriesService.create(payload as any)
    },
    onSuccess: () => {
      toast.success('Transfer created')
      onSuccess()
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? 'Failed to create transfer'),
  })

  const onSubmit = (values: FormValues) => {
    if (!sourceBranchId) {
      toast.error('No active source branch — cannot determine stock')
      return
    }
    if (inventoryLoading) {
      toast.error('Still loading source branch stock — try again in a moment')
      return
    }
    const missing = values.details
      .filter((d) => Number(d.product_uom_id) > 0)
      .filter((d) => !pickFifoInventory(Number(d.product_uom_id)))
    if (missing.length > 0) {
      toast.error('No stock available at source branch for one or more items')
      return
    }
    createMutation.mutate(values)
  }

  const onInvalid = (errs: any) => {
    const first = Object.values(errs)[0] as any
    toast.error(first?.message ?? 'Please fill required fields')
  }

  const inputStyle: React.CSSProperties = {
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

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--foreground)',
    marginBottom: 4,
    display: 'block',
  }

  const errorStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--destructive)',
    marginTop: 4,
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 24,
        marginBottom: 20,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            margin: 0,
            color: 'var(--foreground)',
            fontFamily: 'var(--font-display)',
          }}
        >
          New Stock Transfer
        </h3>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--foreground-muted)',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <div>
            <label style={labelStyle}>
              Date <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <input
              type="date"
              {...register('date')}
              style={{
                ...inputStyle,
                ...(errors.date ? { border: '1px solid var(--destructive)' } : {}),
              }}
            />
            {errors.date && <span style={errorStyle}>{errors.date.message}</span>}
          </div>
        </div>

        <div>
          <label style={labelStyle}>
            Destination Branch <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <Controller
            name="target_branch_id"
            control={control}
            render={({ field }) => (
              <SearchableSelect
                value={field.value ?? 0}
                onChange={field.onChange}
                options={branchOptions}
                placeholder="Select destination branch..."
                searchPlaceholder="Search branches..."
                loading={branchesLoading}
                error={errors.target_branch_id?.message as string | undefined}
              />
            )}
          />
        </div>

        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            {...register('description')}
            rows={2}
            placeholder="Optional notes"
            style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Items</span>
            <button
              type="button"
              onClick={() =>
                append({
                  product_uom_id: 0,
                  product_uom_batch_id: undefined,
                  qty: 1,
                  price: 0,
                  description: '',
                })
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
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
              <Plus size={12} />
              Add Item
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 90px 110px 90px 1fr 32px',
              gap: 8,
              padding: '6px 0',
              borderBottom: '1px solid var(--border)',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--foreground-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            <span>Product / UOM</span>
            <span>Qty</span>
            <span>Unit Price</span>
            <span>Subtotal</span>
            <span>Notes</span>
            <span></span>
          </div>

          {fields.map((field, index) => {
            const qty = Number(watchDetails?.[index]?.qty ?? 0)
            const price = Number(watchDetails?.[index]?.price ?? 0)
            const subtotal = qty * price
            return (
              <div
                key={field.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 90px 110px 90px 1fr 32px',
                  gap: 8,
                  alignItems: 'start',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Controller
                    name={`details.${index}.product_uom_id`}
                    control={control}
                    render={({ field: f }) => (
                      <SearchableSelect
                        value={f.value ?? 0}
                        onChange={(val) => {
                          f.onChange(val)
                          const selectedPu = productUoms.find((pu: any) => pu.id === Number(val))
                          if (selectedPu && selectedPu.base_price !== undefined) {
                            setValue(`details.${index}.price`, Number(selectedPu.base_price))
                          }
                        }}
                        options={productUomOptions.filter((o: any) => {
                          const selectedIds = watch('details').map((d: any) => d.product_uom_id).filter((id: number) => id > 0)
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
                      />
                    )}
                  />
                  {(() => {
                    const uomId = Number(watchDetails?.[index]?.product_uom_id ?? 0)
                    if (!uomId) return null
                    if (inventoryLoading)
                      return (
                        <span
                          style={{ fontSize: 11, color: 'var(--foreground-muted)' }}
                        >
                          Checking source stock…
                        </span>
                      )
                    const pick = pickFifoInventory(uomId)
                    if (!pick)
                      return (
                        <span style={{ fontSize: 11, color: 'var(--destructive)' }}>
                          No stock available at source branch
                        </span>
                      )
                    return (
                      <span
                        style={{ fontSize: 11, color: 'var(--foreground-muted)' }}
                      >
                        {formatBatchLabel(pick)}
                      </span>
                    )
                  })()}
                </div>
                <input
                  type="number"
                  min={0.001}
                  step={0.001}
                  {...register(`details.${index}.qty`, { valueAsNumber: true })}
                  style={inputStyle}
                />
                {getCanReadPrice() ? (
                  <input
                    type="number"
                    min={0}
                    step={1}
                    {...register(`details.${index}.price`, { valueAsNumber: true })}
                    style={inputStyle}
                  />
                ) : (
                  <input
                    type="text"
                    value="***"
                    disabled
                    style={{ ...inputStyle, background: 'var(--surface)', cursor: 'not-allowed' }}
                  />
                )}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--foreground-muted)',
                    paddingTop: 8,
                  }}
                >
                  <PriceDisplay amount={subtotal} />
                </span>
                <input
                  {...register(`details.${index}.description`)}
                  placeholder="Note"
                  style={inputStyle}
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
            )
          })}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 8,
              padding: '10px 0 0',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Total:</span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--accent)',
                fontFamily: 'var(--font-display)',
              }}
            >
              <PriceDisplay amount={totalPrice} />
            </span>
          </div>

          {errors.details && typeof (errors.details as any).message === 'string' && (
            <span style={errorStyle}>{(errors.details as any).message}</span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
            disabled={createMutation.isPending}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: createMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: createMutation.isPending ? 0.7 : 1,
            }}
          >
            {createMutation.isPending && (
              <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
            )}
            Create Transfer
          </button>
        </div>
      </form>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
