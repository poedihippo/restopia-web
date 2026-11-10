'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { stockMovementsService } from '@/services/stock-movements.service'
import { stagesService } from '@/services/stages.service'
import { toastMutationApiError, parseApiError } from '@/utils/apiError'
import { getProductUomName, withProductType } from '@/utils/productUomName'
import { productInventoriesService } from '@/services/product-inventories.service'
import { useAuth } from '@/hooks/useAuth'
import SearchableSelect from '@/components/SearchableSelect'
import { X, Loader2, TrendingUp, TrendingDown, AlertTriangle, ChevronDown } from 'lucide-react'

const GENERAL = 'GENERAL'

const formatExpiry = (v?: string) => {
  if (!v) return 'No expiry'
  const d = new Date(v)
  return isNaN(d.getTime())
    ? 'No expiry'
    : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

// A missing dimension on a stock row is the GENERAL row.
const dim = (v?: string | null) => (v && String(v).trim() !== '' ? String(v) : GENERAL)

const schema = z.object({
  product_uom_batch_id: z.coerce.number()
    .min(1, 'Product UOM Batch is required'),
  qty: z.coerce.number()
    .min(0.0001, 'Must be greater than 0'),
  direction: z.enum(['in', 'out']),
  description: z.string().optional(),
  // Which stock row of the batch to move (backend defaults each to GENERAL).
  owner_ref: z.string().max(100, 'Max 100 characters').optional(),
  stage: z.string().optional(),
  location_ref: z.string().max(100, 'Max 100 characters').optional(),
})
type FormValues = z.infer<typeof schema>

const EMPTY_VALUES = (batchId?: number | null): FormValues => ({
  product_uom_batch_id: batchId ?? 0,
  qty: 0,
  direction: 'in' as const,
  description: '',
  owner_ref: GENERAL,
  stage: GENERAL,
  location_ref: GENERAL,
})

interface StockMovementSheetProps {
  open: boolean
  onClose: () => void
  /**
   * Batch yang langsung terpilih saat sheet dibuka — dipakai tombol
   * "Adjust Stock" di daftar Product Inventory agar product tidak
   * perlu dicari lagi.
   */
  initialBatchId?: number | null
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

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--foreground)',
  display: 'flex',
  alignItems: 'center',
  gap: 2,
}

const inputStyle = (hasError = false): React.CSSProperties => ({
  width: '100%',
  height: 34,
  padding: '0 10px',
  border: `1px solid ${hasError ? 'var(--destructive)' : 'var(--border)'}`,
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  color: 'var(--foreground)',
  background: 'var(--surface-raised)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
})

const errorText = (msg?: string) =>
  msg ? <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{msg}</span> : null

export default function StockMovementSheet({ open, onClose, initialBatchId }: StockMovementSheetProps) {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const activeBranchId = (user as any)?.branch?.id
  const activeBranchName = (user as any)?.branch?.name

  // Owner + Location sit behind "Allocation" (Stage is always visible).
  const [showAllocation, setShowAllocation] = useState(false)
  // Non-field API errors (e.g. insufficient stock in that row), shown inline.
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: EMPTY_VALUES(),
  })

  // Form selalu dibuka dalam keadaan bersih, dan bila sheet dipanggil dari
  // tombol "Adjust Stock" (Product Inventory) batch produk langsung terpilih.
  useEffect(() => {
    if (!open) return
    reset(EMPTY_VALUES(initialBatchId))
    setShowAllocation(false)
    setSubmitError(null)
  }, [open, initialBatchId, reset])

  // Stock lives on product-inventories, not on the batch row. /product-uom-batches
  // reports a global cross-branch `stock` that doesn't match the active branch,
  // so availability is read from this branch's inventory rows instead.
  const { data: inventoriesData, isLoading: inventoriesLoading } = useQuery({
    queryKey: ['stock-movement-inventories', activeBranchId, debouncedDropdownSearch],
    queryFn: () =>
      productInventoriesService
        .list({
          per_page: 1000,
          include:
            'product_uom_batch,product_uom_batch.product_uom,product_uom_batch.product_uom.product',
          'filter[branch_id]': activeBranchId,
          'filter[search]': debouncedDropdownSearch || undefined,
        } as any)
        .then((r) => r.data),
  })
  const inventoryRows: any[] = useMemo(() => ((inventoriesData as any)?.data ?? []) as any[], [inventoriesData])

  const { data: stagesData, isLoading: stagesLoading } = useQuery({
    queryKey: ['stages-all'],
    queryFn: () => stagesService.list({ per_page: 100 } as any).then((r) => r.data),
  })
  const stageOptions = useMemo(() => {
    const raw = (stagesData as any)?.data
    const list: any[] = Array.isArray(raw) ? raw : raw?.data ?? []
    const opts = list
      .filter((s) => s?.code && String(s.code).toUpperCase() !== GENERAL)
      .map((s) => ({ value: String(s.code), label: s.name ? `${s.name} (${s.code})` : String(s.code) }))
    return [{ value: GENERAL, label: 'General (GENERAL)' }, ...opts]
  }, [stagesData])

  // One option per batch, with the branch's on-hand stock summed across rows
  // (a batch can have several inventory rows in different dimensions).
  const batchesItems: any[] = useMemo(() => {
    const byBatch = new Map<number, any>()
    for (const inv of inventoryRows) {
      const batch = inv?.product_uom_batch
      const batchId = Number(batch?.id ?? inv?.product_uom_batch_id)
      if (!batchId) continue
      const entry = byBatch.get(batchId) ?? { ...batch, id: batchId, stock: 0 }
      entry.stock += Number(inv.display_qty ?? inv.stock ?? 0)
      byBatch.set(batchId, entry)
    }
    return Array.from(byBatch.values())
  }, [inventoryRows])

  const watchDirection = watch('direction')
  const watchQty = watch('qty')
  const watchBatchId = watch('product_uom_batch_id')
  const watchOwner = dim(watch('owner_ref'))
  const watchStage = dim(watch('stage'))
  const watchLocation = dim(watch('location_ref'))

  const batchOptions = batchesItems.map((batch: any) => {
    const name =
      getProductUomName(batch.product_uom, batch.product_uom?.product?.name) ||
      batch.batch_code ||
      `BATCH-${batch.id}`
    const uomCode =
      batch.display_uom_code ??
      batch.product_uom?.uom?.code ??
      batch.product_uom?.uom?.name ??
      ''
    const displayStock = batch.display_qty ?? batch.stock ?? 0
    const expiryDate = batch.expiry_date ? formatExpiry(batch.expiry_date) : 'No expiry'
    return {
      value: batch.id as number,
      label: withProductType(
        `${name}${uomCode ? ` · ${uomCode}` : ''} · Stok: ${displayStock} · Exp: ${expiryDate}`,
        batch.product_uom?.product?.type,
      ),
      sublabel: batch.batch_code ?? undefined,
    }
  })

  const selectedBatch = batchesItems.find((batch: any) => batch.id === watchBatchId)
  const uomCode = selectedBatch?.display_uom_code ?? selectedBatch?.product_uom?.uom?.code ?? ''

  // The batch's stock rows in this branch, one per owner/stage/location.
  const batchRows = useMemo(
    () =>
      inventoryRows
        .filter((inv) => Number(inv?.product_uom_batch?.id ?? inv?.product_uom_batch_id) === Number(watchBatchId))
        .map((inv) => ({
          owner: dim(inv.owner_ref),
          stage: dim(inv.stage),
          location: dim(inv.location_ref),
          qty: Number(inv.display_qty ?? inv.stock ?? 0),
        })),
    [inventoryRows, watchBatchId],
  )
  const rowMatches = (r: { owner: string; stage: string; location: string }) =>
    r.owner === watchOwner && r.stage === watchStage && r.location === watchLocation
  const selectedRow = batchRows.find(rowMatches)
  // Stock of the exact row this movement touches; 0 when the row doesn't exist yet.
  const rowStock = selectedRow?.qty ?? 0

  // Existing values for the Owner / Location suggestions.
  const ownerSuggestions = Array.from(new Set([GENERAL, ...inventoryRows.map((inv) => dim(inv.owner_ref))]))
  const locationSuggestions = Array.from(new Set([GENERAL, ...inventoryRows.map((inv) => dim(inv.location_ref))]))

  const hasCustomAllocation = watchOwner !== GENERAL || watchLocation !== GENERAL
  useEffect(() => {
    if (hasCustomAllocation) setShowAllocation(true)
  }, [hasCustomAllocation])

  // qty is entered in the selected batch's own product_uom (payload sends
  // product_uom_batch_id + qty as-is). "out" only takes from the chosen row,
  // so availability is that row's stock, not the batch total.
  const negativeStock =
    watchDirection === 'out' &&
    !!selectedBatch &&
    Number(watchQty) > rowStock

  const pickRow = (r: { owner: string; stage: string; location: string }) => {
    setValue('stage', r.stage, { shouldValidate: true })
    setValue('owner_ref', r.owner, { shouldValidate: true })
    setValue('location_ref', r.location, { shouldValidate: true })
    setSubmitError(null)
  }

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => stockMovementsService.create(data as any),
    onSuccess: () => {
      // A stock movement changes inventory everywhere it is displayed, and
      // each screen keeps its own query key ('stock-movement-inventories' for
      // this sheet's batch picker, 'product-inventories' / '-all' / '-pos',
      // 'stock-card', the dimension-transfer pickers, ...). Invalidating by
      // prefix list would silently miss one whenever a key is renamed — the
      // stale-stock bug this replaces — so match every query whose key refers
      // to inventory or stock. React Query only refetches queries that are
      // currently mounted, so this stays cheap.
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey.some((part) => typeof part === 'string' && /inventor|stock/i.test(part)),
      })
      toast.success('Stock movement recorded')
      reset(EMPTY_VALUES())
      onClose()
    },
    onError: (err: any) => {
      const fieldErrors = err?.response?.data?.errors
      const stageError = fieldErrors?.stage
      if (stageError) {
        // 422 "stage: invalid stage: X" → show it under the Stage select.
        setError('stage', { type: 'server', message: String(Array.isArray(stageError) ? stageError[0] : stageError) })
      } else if (!err?.response || err.response.status < 500) {
        // e.g. insufficient stock in the chosen row.
        setSubmitError(parseApiError(err))
      }
      toastMutationApiError(err, 'Failed to record movement')
    },
  })

  const onSubmit = (values: FormValues) => {
    setSubmitError(null)
    const selectedBatch = batchesItems.find((batch: any) => batch.id === values.product_uom_batch_id)
    if (!selectedBatch) {
      toast.error('Invalid batch selected')
      return
    }

    const payload: Record<string, unknown> = {
      product_uom_batch_id: values.product_uom_batch_id,
      qty: values.qty,
      direction: values.direction,
      description: values.description,
      owner_ref: dim(values.owner_ref?.trim()),
      stage: dim(values.stage),
      location_ref: dim(values.location_ref?.trim()),
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
          maxWidth: '100vw',
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
            padding: '14px 20px',
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
                fontSize: 16,
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
          <button type="button" onClick={onClose} className="v2-icon-btn" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Form body */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--foreground-subtle)' }}>
            <span style={{ color: 'var(--destructive)' }}>*</span>
            <span>Required fields</span>
          </div>

          {/* Movement Type — card selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>
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
                            fontWeight: 500,
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
            <label style={labelStyle}>
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
                  loading={inventoriesLoading}
                  error={errors.product_uom_batch_id?.message}
                  onSearchChange={setDropdownSearch}
/>
              )}
            />
            {selectedBatch && (
              <div className="sm-batch-info">
                <div className="sm-stock-grid">
                  <div>
                    <span className="sm-stock-label">Batch total</span>
                    <strong>{selectedBatch.display_qty ?? selectedBatch.stock} {uomCode}</strong>
                  </div>
                  <div>
                    <span className="sm-stock-label">Stock in this row</span>
                    <strong style={{ color: negativeStock ? 'var(--destructive)' : 'var(--foreground)' }}>
                      {rowStock} {uomCode}
                    </strong>
                    {!selectedRow && (
                      <span className="sm-stock-hint">
                        {watchDirection === 'in' ? 'New row — created on save' : 'Row not found'}
                      </span>
                    )}
                  </div>
                </div>
                <span>
                  Batch: {selectedBatch.batch_code ?? '—'} · Expiry: {formatExpiry(selectedBatch.expiry_date)}
                </span>
                {batchRows.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="sm-stock-label">Rows of this batch — click to use</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {batchRows.map((r) => (
                        <button
                          key={`${r.owner}|${r.stage}|${r.location}`}
                          type="button"
                          className="sm-row-chip"
                          data-active={rowMatches(r) || undefined}
                          onClick={() => pickRow(r)}
                          title={`Owner ${r.owner} · Stage ${r.stage} · Location ${r.location}`}
                        >
                          {r.stage}
                          {(r.owner !== GENERAL || r.location !== GENERAL) && (
                            <span className="sm-row-chip-dim"> · {r.owner}/{r.location}</span>
                          )}
                          <strong>{r.qty}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stock row: Stage always visible, Owner + Location behind Allocation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <label style={labelStyle}>Stage</label>
              <button
                type="button"
                className="alloc-toggle"
                aria-expanded={showAllocation}
                onClick={() => setShowAllocation((v) => !v)}
                title="Show Owner and Location"
              >
                <span className="v2-link">Allocation</span>
                {!showAllocation && (
                  <span className="alloc-summary">{hasCustomAllocation ? 'custom' : GENERAL}</span>
                )}
                <ChevronDown size={14} style={{ transform: showAllocation ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }} />
              </button>
            </div>
            <Controller
              name="stage"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? GENERAL}
                  onChange={(v) => {
                    field.onChange(v ? String(v) : GENERAL)
                    setSubmitError(null)
                  }}
                  options={stageOptions}
                  placeholder="Select stage..."
                  searchPlaceholder="Search stage..."
                  loading={stagesLoading}
                  error={errors.stage?.message}
                />
              )}
            />

            {showAllocation && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 6 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={labelStyle} htmlFor="sm-owner">Owner</label>
                  <input
                    id="sm-owner"
                    list="sm-owner-options"
                    placeholder={GENERAL}
                    {...register('owner_ref', { onChange: () => setSubmitError(null) })}
                    style={inputStyle(!!errors.owner_ref)}
                  />
                  <datalist id="sm-owner-options">
                    {ownerSuggestions.map((v) => <option key={v} value={v} />)}
                  </datalist>
                  {errorText(errors.owner_ref?.message)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={labelStyle} htmlFor="sm-location">Location</label>
                  <input
                    id="sm-location"
                    list="sm-location-options"
                    placeholder={GENERAL}
                    {...register('location_ref', { onChange: () => setSubmitError(null) })}
                    style={inputStyle(!!errors.location_ref)}
                  />
                  <datalist id="sm-location-options">
                    {locationSuggestions.map((v) => <option key={v} value={v} />)}
                  </datalist>
                  {errorText(errors.location_ref?.message)}
                </div>
              </div>
            )}
          </div>

          {/* Qty */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>
              {getQtyLabel()}
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <input
              {...register('qty', { valueAsNumber: true, onChange: () => setSubmitError(null) })}
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0"
              style={{
                ...inputStyle(),
                border: `1px solid ${errors.qty ? 'var(--destructive)' : getQtyBorderColor()}`,
              }}
            />
            {errorText(errors.qty?.message)}
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
                More than this row holds ({rowStock} {uomCode}) — the movement will be rejected
              </span>
            )}
          </div>

          {/* Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Reason for this adjustment (optional)"
              style={{
                ...inputStyle(),
                height: 'auto',
                minHeight: 72,
                padding: '8px 10px',
                lineHeight: 1.5,
                resize: 'vertical',
                display: 'block',
              }}
            />
          </div>
        </form>

        {submitError && (
          <div className="sm-submit-error" role="alert">
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ whiteSpace: 'pre-line' }}>{submitError}</span>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" onClick={onClose} className="v2-btn v2-btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSubmit(onSubmit)}
            className="v2-btn"
            style={{ background: getSubmitBg(), border: `1px solid ${getSubmitBg()}`, color: 'white' }}
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
        .sm-batch-info {
          display: flex; flex-direction: column; gap: 10px; padding: 10px 12px;
          background: var(--surface-muted, var(--background)); border: 1px solid var(--border);
          border-radius: var(--radius-md); font-size: 12px; color: var(--foreground-muted);
        }
        .sm-stock-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .sm-stock-grid > div { display: flex; flex-direction: column; gap: 2px; }
        .sm-stock-grid strong { font-size: 14px; font-weight: 500; color: var(--foreground); }
        .sm-stock-label { font-size: 11px; color: var(--foreground-subtle); }
        .sm-stock-hint { font-size: 11px; color: var(--foreground-subtle); font-style: italic; }
        .sm-row-chip {
          display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px;
          border: 1px solid var(--border); border-radius: 999px; background: var(--surface);
          font-size: 11.5px; font-family: var(--font-sans); color: var(--foreground); cursor: pointer;
          transition: border-color 150ms ease, background 150ms ease;
        }
        .sm-row-chip:hover { border-color: var(--border-strong); }
        .sm-row-chip[data-active] { border-color: var(--accent); background: var(--accent-light-bg); }
        .sm-row-chip strong { font-weight: 500; }
        .sm-row-chip-dim { color: var(--foreground-muted); }
        .sm-submit-error {
          display: flex; gap: 8px; margin: 0 20px 12px; padding: 10px 12px;
          border: 1px solid var(--destructive); border-radius: var(--radius-md);
          background: var(--destructive-bg); color: var(--destructive); font-size: 12.5px;
        }
        .alloc-toggle {
          display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 6px 0 8px;
          border: none; border-radius: 6px; background: none; cursor: pointer;
          font-size: 12px; font-family: var(--font-sans); color: var(--accent);
          transition: background 150ms ease;
        }
        .alloc-toggle:hover { background: var(--surface-muted, var(--background)); }
        .alloc-summary {
          font-size: 10.5px; font-weight: 500; padding: 1px 6px; border-radius: 999px;
          color: var(--foreground-muted); background: var(--surface-muted, var(--background)); border: 1px solid var(--border);
        }
      `}</style>
    </div>
  )
}
