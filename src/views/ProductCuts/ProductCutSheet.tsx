'use client'

import React, { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productCutsService } from '@/services/product-cuts.service'
import { productUomsService } from '@/services/product-uoms.service'
import { toastMutationApiError } from '@/utils/apiError'
import { withProductType } from '@/utils/productUomName'
import { X, Loader2, ArrowRight } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'

// A cut row points at product-UOMs, and the backend requires both to be on
// their product's BASE unit (E12: "... must be on its base unit"). Yield must
// be a whole number >= 1 (1 covers a 1-to-1 portioning); scrap_rate must be 0
// (scrap is recorded on the portioning), so it is not exposed here at all.
const schema = z.object({
  parent_product_uom_id: z.coerce.number().min(1, 'Parent is required'),
  child_product_uom_id: z.coerce.number().min(1, 'Child is required'),
  yield_qty: z.coerce
    .number()
    .int('Yield must be a whole number')
    .min(1, 'Yield must be at least 1'),
})
type FormValues = z.infer<typeof schema>

interface ProductCutSheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    parent_product_uom_id: number
    child_product_uom_id: number
    yield_qty: number
  } | null
}

export default function ProductCutSheet({ open, onClose, editData }: ProductCutSheetProps) {
  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400)
    return () => clearTimeout(t)
  }, [dropdownSearch])

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
      parent_product_uom_id: 0,
      child_product_uom_id: 0,
      yield_qty: 2,
    },
  })

  // Product-UOMs that sit on their product's base unit — the only valid cut
  // endpoints. Resolved client-side because the cut table has no dedicated
  // "base units only" list.
  const { data: puData, isLoading: puLoading } = useQuery({
    queryKey: ['product-cuts-base-uoms', debouncedDropdownSearch],
    queryFn: () =>
      productUomsService
        .list({
          per_page: 1000,
          include: 'product,uom',
          'filter[search]': debouncedDropdownSearch || undefined,
        } as any)
        .then((r) => r.data),
  })
  const allPu: any[] = (puData as any)?.data ?? []

  // A product-UOM is "on its base unit" when its uom_id matches the product's
  // base_uom_id. Products without a base_uom_id fall back to their default
  // product-UOM so the picker is never empty for a valid product.
  const basePu: any[] = allPu.filter((pu) => {
    const base = pu?.product?.base_uom_id
    if (base) return Number(pu?.uom_id) === Number(base)
    return !!pu?.is_default
  })

  const puLabel = (pu: any) =>
    withProductType(
      [pu?.product?.name ?? pu?.name, pu?.uom?.code ?? pu?.uom_code].filter(Boolean).join(' · '),
      pu?.product?.type,
    )

  const puOptions = basePu.map((pu) => ({
    value: Number(pu.id),
    label: puLabel(pu),
    sublabel: pu?.code ? `SKU: ${pu.code}` : undefined,
  }))

  useEffect(() => {
    if (editData) {
      reset({
        parent_product_uom_id: editData.parent_product_uom_id,
        child_product_uom_id: editData.child_product_uom_id,
        yield_qty: editData.yield_qty,
      })
    } else {
      reset({ parent_product_uom_id: 0, child_product_uom_id: 0, yield_qty: 2 })
    }
  }, [editData, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => productCutsService.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-cuts'] })
      queryClient.invalidateQueries({ queryKey: ['portioning-source-outputs'] })
      toast.success('Cut dibuat')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal membuat cut'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => productCutsService.update(editData!.id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-cuts'] })
      queryClient.invalidateQueries({ queryKey: ['portioning-source-outputs'] })
      toast.success('Cut diperbarui')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal memperbarui cut'),
  })

  const onSubmit = (values: FormValues) => {
    if (editData) updateMutation.mutate(values)
    else createMutation.mutate(values)
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const watchedParent = watch('parent_product_uom_id')
  const watchedChild = watch('child_product_uom_id')
  const watchedYield = watch('yield_qty')

  const parentPu = basePu.find((pu) => Number(pu.id) === Number(watchedParent))
  const childPu = basePu.find((pu) => Number(pu.id) === Number(watchedChild))
  const parentName = parentPu?.product?.name ?? ''
  const childName = childPu?.product?.name ?? ''

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--foreground)',
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  }

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />

      <div
        style={{
          position: 'relative', zIndex: 50, width: 480, height: '100%',
          background: 'var(--surface)', borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
            {editData ? 'Edit Cut' : 'New Cut'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 'var(--radius-sm)', color: 'var(--foreground-muted)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit(onSubmit)} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, fontSize: 11, color: 'var(--foreground-subtle)' }}>
            <span style={{ color: 'var(--destructive)' }}>*</span>
            <span>Required fields</span>
          </div>

          {/* Parent */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>
              Parent (Induk)
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <Controller
              name="parent_product_uom_id"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? 0}
                  onChange={field.onChange}
                  options={puOptions}
                  placeholder="Pilih produk induk (unit dasar)..."
                  searchPlaceholder="Cari produk..."
                  loading={puLoading}
                  error={errors.parent_product_uom_id?.message as string | undefined}
                  onSearchChange={setDropdownSearch}
                />
              )}
            />
            <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
              Hanya unit dasar produk yang boleh dipakai.
            </span>
          </div>

          {/* Child */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>
              Child (Anak)
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <Controller
              name="child_product_uom_id"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? 0}
                  onChange={field.onChange}
                  options={puOptions.filter((o) => o.value !== Number(watchedParent))}
                  placeholder="Pilih produk anak (unit dasar)..."
                  searchPlaceholder="Cari produk..."
                  loading={puLoading}
                  error={errors.child_product_uom_id?.message as string | undefined}
                  onSearchChange={setDropdownSearch}
                />
              )}
            />
          </div>

          {/* Yield */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>
              Yield (1 induk → N anak)
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <input
              {...register('yield_qty', { valueAsNumber: true })}
              type="number"
              step="1"
              min="1"
              placeholder="e.g. 4"
              style={{
                width: '100%', padding: '9px 12px',
                border: `1px solid ${errors.yield_qty ? 'var(--destructive)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)', fontSize: 14, color: 'var(--foreground)',
                background: 'var(--surface-raised)', outline: 'none',
                fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
              }}
            />
            {errors.yield_qty && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.yield_qty.message}</span>
            )}
            <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
              Bilangan bulat minimal 1. Scrap dicatat di portioning, bukan di sini.
            </span>
          </div>

          {/* Live preview */}
          {watchedParent > 0 && watchedChild > 0 && Number(watchedYield) >= 1 && (
            <div style={{ padding: '14px 16px', background: 'var(--accent-light-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 6 }}>
                Preview
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                  1 {parentName || 'induk'}
                </span>
                <ArrowRight size={14} style={{ color: 'var(--foreground-muted)' }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                  {Number(watchedYield)} {childName || 'anak'}
                </span>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" disabled={isPending} onClick={handleSubmit(onSubmit)} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: isPending ? 0.7 : 1 }}>
            {isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {editData ? 'Save Changes' : 'Create Cut'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
