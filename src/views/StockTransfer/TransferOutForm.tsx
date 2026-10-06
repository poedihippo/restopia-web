'use client'
import { formatCurrency, getCanReadPrice } from '@/utils/price';

import React, { useEffect,  useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deliveriesService } from '@/services/deliveries.service'
import { branchesService } from '@/services/branches.service'
import { companiesService } from '@/services/companies.service'
import { productUomsService } from '@/services/product-uoms.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { getProductUomName } from '@/utils/productUomName'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes, isProductTypeAllowed } from '@/hooks/useProductTypes'
import SearchableSelect from '@/components/SearchableSelect'
import { useFormKeyboardNavigation } from '@/hooks/useFormKeyboardNavigation'
import api from '@/hooks/useApi'
import { Plus, Trash2, Loader2, X } from 'lucide-react'
import { PriceDisplay } from '@/components/PriceDisplay'

const GENERAL_OWNER_OPTION = { value: 'GENERAL', label: 'Umum (GENERAL)' }

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
  source_owner_ref: z.string().min(1, 'Owner sumber wajib diisi'),
  source_stage: z.string().min(1, 'Stage sumber wajib diisi'),
  source_location_ref: z.string().optional(),
  details: z.array(detailSchema).min(1, 'Add at least one item'),
})

type FormValues = z.infer<typeof schema>

interface TransferOutFormProps {
  onClose: () => void
  onSuccess: () => void
}

export default function TransferOutForm({ onClose, onSuccess }: TransferOutFormProps) {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
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
      source_owner_ref: 'GENERAL',
      source_stage: 'GENERAL',
      source_location_ref: 'GENERAL',
      details: [
        { product_uom_id: 0, product_uom_batch_id: undefined, qty: 1, price: 0, description: '' },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'details' })

  const [focusNewRowIndex, setFocusNewRowIndex] = useState<number | null>(null)

  const handleAddItem = () => {
    append({
      product_uom_id: 0,
      product_uom_batch_id: undefined,
      qty: 1,
      price: 0,
      description: '',
    })
    setFocusNewRowIndex(fields.length)
  }

  useFormKeyboardNavigation({
    onAddItem: handleAddItem,
  })

  useEffect(() => {
    if (focusNewRowIndex !== null) {
      const timer = setTimeout(() => {
        const el = document.querySelector<HTMLElement>(
          `[data-transfer-row-index="${focusNewRowIndex}"] [data-focus-first="true"], [data-transfer-row-index="${focusNewRowIndex}"] button, [data-transfer-row-index="${focusNewRowIndex}"] input`
        )
        if (el) {
          el.focus()
        }
        setFocusNewRowIndex(null)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [focusNewRowIndex, fields.length])

  const watchDetails = watch('details')
  const watchSourceOwnerRef = watch('source_owner_ref')
  const watchSourceStage = watch('source_stage')
  const watchSourceLocationRef = watch('source_location_ref')
  const totalPrice = watchDetails.reduce(
    (s, d) => s + Number(d.qty ?? 0) * Number(d.price ?? 0),
    0,
  )

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches-all', 'company', debouncedDropdownSearch],
    queryFn: () =>
      branchesService.list({ 'filter[search]': debouncedDropdownSearch || undefined,  per_page: 100, include: 'company' } as any).then((r) => r.data),
  })
  const branches = (branchesData as any)?.data ?? []

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies-all'],
    queryFn: () => companiesService.list({ per_page: 100 } as any).then((r) => r.data),
  })
  const companies: { id: number; name: string }[] = (companiesData as any)?.data ?? []
  const companyOptions = [
    GENERAL_OWNER_OPTION,
    ...companies.map((c) => ({ value: String(c.id), label: c.name })),
  ]

  const { data: stagesData, isLoading: stagesLoading } = useQuery({
    queryKey: ['stages-all'],
    queryFn: () => api.get('/stages', { params: { per_page: 100 } }).then((r) => r.data),
  })
  const stages: { code: string; name: string }[] = (stagesData as any)?.data ?? []
  const stageOptions = stages.map((s: any) => ({ value: s.code, label: s.name }))

  const activeProductTypes = useActiveBranchProductTypes()

  const { data: productUomsData, isLoading: productUomsLoading } = useQuery({
    queryKey: ['product-uoms-all', activeProductTypes, debouncedDropdownSearch],
    queryFn: () =>
      productUomsService
        .list({
          'filter[search]': debouncedDropdownSearch || undefined,
          per_page: 1000,
          include: 'product,uom',
          'filter[product_types]': activeProductTypes,
          'filter[is_active]': true,
        } as any)
        .then((r) => r.data),
  })
  const allProductUoms = (productUomsData as any)?.data ?? []
  const productUoms = allProductUoms.filter((pu: any) => isProductTypeAllowed(pu.product, activeProductTypes))

  // Available stock at the SOURCE branch for the selected owner/stage/location.
  // filter[stage]/filter[owner_ref]/filter[location_ref] are supported by
  // GET /v1/product-inventories — without them the picker shows every stage
  // and qty is wrong when the user switches source dimension.
  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: [
      'transfer-out-source-inventory',
      sourceBranchId,
      debouncedDropdownSearch,
      watchSourceOwnerRef,
      watchSourceStage,
      watchSourceLocationRef,
    ],
    enabled: !!sourceBranchId,
    queryFn: () =>
      productInventoriesService
        .list({
          'filter[search]': debouncedDropdownSearch || undefined,
          per_page: 1000,
          'filter[branch_id]': sourceBranchId,
          'filter[status]': 'active',
          'filter[owner_ref]': watchSourceOwnerRef || undefined,
          'filter[stage]': watchSourceStage || undefined,
          'filter[location_ref]': watchSourceLocationRef || undefined,
          include: 'branch,product_uom_batch',
        } as any)
        .then((r) => r.data),
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
    const stage = inv?.stage ?? inv?.product_uom_batch?.stage
    const owner = inv?.owner_ref ?? inv?.product_uom_batch?.owner_ref
    const dim = [owner, stage].filter(Boolean).join(' / ')
    const base = exp
      ? `${code} — Exp: ${String(exp).split('T')[0]}`
      : `${code} — No expiry`
    return dim ? `${base} · ${dim}` : base
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
    label: getProductUomName(pu, pu.product?.name),
    sublabel: (pu.uom?.name as string) ?? '',
    description: (pu.code as string) ?? undefined,
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
        source_owner_ref: values.source_owner_ref || 'GENERAL',
        source_stage: values.source_stage || 'GENERAL',
        source_location_ref: values.source_location_ref || 'GENERAL',
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
    background: 'var(--surface-raised)',
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
                onSearchChange={setDropdownSearch}
/>
            )}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <div>
            <label style={labelStyle}>
              Source Owner <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <Controller
              name="source_owner_ref"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? 'GENERAL'}
                  onChange={field.onChange}
                  options={companyOptions}
                  placeholder="Pilih owner..."
                  searchPlaceholder="Cari perusahaan..."
                  loading={companiesLoading}
                  error={errors.source_owner_ref?.message as string | undefined}
                />
              )}
            />
          </div>
          <div>
            <label style={labelStyle}>
              Source Stage <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <Controller
              name="source_stage"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? 'GENERAL'}
                  onChange={field.onChange}
                  options={stageOptions}
                  placeholder="Pilih stage..."
                  searchPlaceholder="Cari stage..."
                  loading={stagesLoading}
                  error={errors.source_stage?.message as string | undefined}
                />
              )}
            />
          </div>
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
              onClick={handleAddItem}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
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
              <kbd style={{ fontSize: 10, opacity: 0.7, background: 'var(--muted)', padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)' }}>
                Ctrl+B
              </kbd>
            </button>
          </div>

          <div
            style={{
            display: 'grid',
            gridTemplateColumns: '24px 2fr 90px 1fr 32px',
            gap: 8,
            padding: '6px 0',
            borderBottom: '1px solid var(--border)',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--foreground-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            alignItems: 'center',
          }}
        >
          <span style={{ textAlign: 'center' }}>#</span>
          <span>Product / UOM</span>
          <span>Qty</span>
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
                data-transfer-row-index={index}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '24px 2fr 90px 1fr 32px',
                  gap: 8,
                  alignItems: 'start',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {/* Row index */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 38,
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  {index + 1}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Controller
                    name={`details.${index}.product_uom_id`}
                    control={control}
                    render={({ field: f }) => (
                      <SearchableSelect
                        dataFocusFirst={true}
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
                        onSearchChange={setDropdownSearch}
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
                <input
                  type="hidden"
                  {...register(`details.${index}.price`, { valueAsNumber: true })}
                />
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
