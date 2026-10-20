'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { dimensionTransfersService } from '@/services/dimension-transfers.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { companiesService } from '@/services/companies.service'
import { branchesService } from '@/services/branches.service'
import { toastMutationApiError } from '@/utils/apiError'
import { getProductUomName } from '@/utils/productUomName'
import api from '@/hooks/useApi'
import { useAuth } from '@/hooks/useAuth'
import SearchableSelect from '@/components/SearchableSelect'
import { Loader2, ArrowRightLeft, Plus, Trash2 } from 'lucide-react'

const GENERAL_OWNER_OPTION = { value: 'GENERAL', label: 'General (Umum)' }

interface DimensionInventoryRow {
  id: number
  product_uom_batch_id?: number
  stock?: number
  qty?: number
  display_qty?: number | null
  display_uom_code?: string | null
  owner_ref?: string
  owner_display?: string
  owner_company_name?: string
  stage?: string
  location_ref?: string
  product_uom_batch?: {
    id: number
    code?: string
    batch_code?: string
    product_uom?: {
      id: number
      code?: string
      product?: { id: number; name: string; code?: string }
      uom?: { id: number; name: string; code: string }
    }
  }
}

const itemSchema = z.object({
  source_inventory_id: z.coerce.number().min(1, 'Pilih item'),
  qty: z.coerce.number().min(0.001, 'Qty minimal 0.001'),
})

const schema = z.object({
  items: z.array(itemSchema).min(1, 'Minimal 1 item'),
  from_owner_ref: z.string().min(1, 'Owner asal wajib diisi'),
  from_stage: z.string().min(1, 'Stage asal wajib diisi'),
  from_location_ref: z.string().default('GENERAL'),
  to_owner_ref: z.string().min(1, 'Owner tujuan wajib diisi'),
  to_stage: z.string().min(1, 'Stage tujuan wajib diisi'),
  to_location_ref: z.string().default('GENERAL'),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface BulkDimensionTransferProps {
  branchId?: number
}

export default function BulkDimensionTransfer({ branchId }: BulkDimensionTransferProps) {
  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400)
    return () => clearTimeout(t)
  }, [dropdownSearch])

  const { user } = useAuth()
  const effectiveBranchId = branchId || user?.branch?.id
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      items: [{ source_inventory_id: 0, qty: 1 }],
      from_owner_ref: 'GENERAL',
      from_stage: 'GENERAL',
      from_location_ref: 'GENERAL',
      to_owner_ref: 'GENERAL',
      to_stage: '',
      to_location_ref: 'GENERAL',
      description: '',
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['dimension-transfer-source-inventory', effectiveBranchId, debouncedDropdownSearch],
    enabled: !!effectiveBranchId,
    queryFn: () =>
      productInventoriesService
        .list({
          per_page: 1000,
          'filter[branch_id]': effectiveBranchId,
          'filter[search]': debouncedDropdownSearch || undefined,
          include:
            'product_uom_batch,product_uom_batch.product_uom,product_uom_batch.product_uom.product',
        } as any)
        .then((r) => r.data),
  })

  const allInventoryRows: DimensionInventoryRow[] = ((inventoryData as any)?.data ?? []).filter(
    (r: any) => Number(r.display_qty ?? r.stock ?? r.qty ?? 0) > 0,
  )

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies-all'],
    queryFn: () => companiesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const companies: { id: number; name: string }[] = (companiesData as any)?.data ?? []
  const companyOptions = [
    GENERAL_OWNER_OPTION,
    ...companies.map((c) => ({ value: String(c.id), label: c.name })),
  ]

  // Outlet branches always hold stock under the GENERAL owner/location, so the
  // "To" dimension is locked to GENERAL for them.
  const { data: branchesData } = useQuery({
    queryKey: ['branches-all'],
    queryFn: () => branchesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const branches: { id: number; type?: string }[] = (branchesData as any)?.data ?? []
  const activeBranchType =
    branches.find((b) => b.id === effectiveBranchId)?.type ??
    (effectiveBranchId === user?.branch?.id ? (user as any)?.branch?.type : undefined)
  const isOutletBranch = activeBranchType === 'outlet'

  const { data: stagesData, isLoading: stagesLoading } = useQuery({
    queryKey: ['stages-all'],
    queryFn: () => api.get('/stages', { params: { per_page: 100 } }).then((r) => r.data),
  })
  const stages: { code?: string; name: string }[] = (stagesData as any)?.data ?? []
  const stageOptions =
    stages.length > 0
      ? stages.map((s) => ({ value: s.code || s.name, label: s.name }))
      : [
          { value: 'GENERAL', label: 'General' },
          { value: 'RAW', label: 'Raw' },
          { value: 'WIP', label: 'WIP' },
          { value: 'FINISHED', label: 'Finished' },
          { value: 'CHILLED', label: 'Chilled' },
          { value: 'NORMAL', label: 'Normal' },
        ]

  const ownerLabel = (row: DimensionInventoryRow | undefined): string => {
    if (!row) return '—'
    if (row.owner_display) return row.owner_display
    if (row.owner_company_name) return row.owner_company_name
    const ownerRef = row.owner_ref
    if (!ownerRef) return '—'
    if (ownerRef === 'GENERAL') return 'General (Umum)'
    const match = companies.find((c) => String(c.id) === String(ownerRef) || c.name === ownerRef)
    return match?.name ?? ownerRef
  }

  const fromOwner = watch('from_owner_ref')
  const fromStage = watch('from_stage')
  const fromLocation = watch('from_location_ref') || 'GENERAL'
  const toOwnerRef = watch('to_owner_ref')
  const toStage = watch('to_stage')
  const toLocationRef = watch('to_location_ref') || 'GENERAL'
  const watchItems = watch('items')

  // Outlet branch: owner & location tujuan selalu GENERAL (read-only).
  useEffect(() => {
    if (isOutletBranch) {
      setValue('to_owner_ref', 'GENERAL')
      setValue('to_location_ref', 'GENERAL')
    }
  }, [isOutletBranch, setValue])

  // Only offer inventory rows that live in the selected source dimension.
  const inventoryRows = useMemo(
    () =>
      allInventoryRows.filter(
        (r) =>
          (r.owner_ref ?? 'GENERAL') === fromOwner &&
          (r.stage ?? 'GENERAL') === fromStage &&
          (r.location_ref ?? 'GENERAL') === fromLocation,
      ),
    [allInventoryRows, fromOwner, fromStage, fromLocation],
  )

  // Changing the source dimension invalidates previously picked items.
  const prevFrom = useRef(`${fromOwner}|${fromStage}|${fromLocation}`)
  useEffect(() => {
    const key = `${fromOwner}|${fromStage}|${fromLocation}`
    if (prevFrom.current === key) return
    prevFrom.current = key
    fields.forEach((_, i) => setValue(`items.${i}.source_inventory_id`, 0))
  }, [fromOwner, fromStage, fromLocation]) // eslint-disable-line react-hooks/exhaustive-deps

  const sourceOptions = useMemo(() => inventoryRows.map((row) => {
    const product =
      row.product_uom_batch?.product_uom?.product ||
      (row as any).product_uom?.product ||
      (row as any).product
    const productUom = row.product_uom_batch?.product_uom || (row as any).product_uom
    const productLabel = getProductUomName(productUom, product?.name)
    const batchCode =
      row.product_uom_batch?.batch_code ??
      row.product_uom_batch?.code ??
      (row as any).batch_code ??
      '—'
    const owner = ownerLabel(row)
    const stage = row.stage ?? '—'
    const location = row.location_ref ?? '—'
    const stock = row.display_qty ?? row.stock ?? row.qty ?? 0
    const stockUom = row.display_uom_code ? ` ${row.display_uom_code}` : ''
    return {
      value: row.id,
      label: `${product?.code ?? ''} ${productLabel}`.trim() || `Item #${row.id}`,
      sublabel: `batch ${batchCode} · ${owner}/${stage}/${location} · stok ${stock}${stockUom}`,
    }
  }), [inventoryRows, companies])

  const isSameDimension =
    !!fromOwner &&
    !!toOwnerRef &&
    fromOwner === toOwnerRef &&
    fromStage === toStage &&
    fromLocation === toLocationRef

  const createMutation = useMutation({
    mutationFn: (payload: {
      branch_id: number
      items: { product_uom_batch_id: number; qty: number }[]
      from: { owner_ref: string; stage: string; location_ref: string }
      to: { owner_ref: string; stage: string; location_ref: string }
      description?: string
    }) => dimensionTransfersService.bulkCreate(payload),
    onSuccess: () => {
      toast.success(`${watchItems.length} item berhasil dipindahkan`)
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      queryClient.invalidateQueries({ queryKey: ['dimension-transfer-source-inventory'] })
      reset({
        items: [{ source_inventory_id: 0, qty: 1 }],
        from_owner_ref: 'GENERAL',
        from_stage: 'GENERAL',
        from_location_ref: 'GENERAL',
        to_owner_ref: 'GENERAL',
        to_stage: '',
        to_location_ref: 'GENERAL',
        description: '',
      })
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal memindahkan stok'),
  })

  const onSubmit = (values: FormValues) => {
    if (!effectiveBranchId) {
      toast.error('Tidak ada cabang aktif')
      return
    }

    if (isSameDimension) {
      toast.error('Dimensi tujuan harus berbeda dari dimensi asal')
      return
    }

    const items: { product_uom_batch_id: number; qty: number }[] = []
    for (const item of values.items) {
      const row = inventoryRows.find((r) => r.id === Number(item.source_inventory_id))
      if (!row) {
        toast.error(`Item #${item.source_inventory_id} tidak valid`)
        return
      }
      const batchId = row.product_uom_batch_id ?? row.product_uom_batch?.id
      if (!batchId) {
        toast.error('Item tidak memiliki batch')
        return
      }
      const stock = Number(row.display_qty ?? row.stock ?? row.qty ?? 0)
      if (Number(item.qty) > stock) {
        toast.error(`Qty melebihi stok tersedia (${stock})`)
        return
      }
      items.push({ product_uom_batch_id: batchId, qty: item.qty })
    }

    createMutation.mutate({
      branch_id: effectiveBranchId,
      items,
      from: {
        owner_ref: values.from_owner_ref,
        stage: values.from_stage,
        location_ref: values.from_location_ref || 'GENERAL',
      },
      to: {
        // Owner tujuan selalu GENERAL — backend memperlakukan owner_ref sebagai
        // free text, jadi jangan kirim ID company.
        owner_ref: 'GENERAL',
        stage: values.to_stage,
        location_ref: isOutletBranch ? 'GENERAL' : values.to_location_ref || 'GENERAL',
      },
      description: values.description || undefined,
    })
  }

  const onInvalid = (errs: any) => {
    const first = Object.values(errs)[0] as any
    toast.error(first?.message ?? 'Mohon lengkapi field yang wajib diisi')
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
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        {/* Dimension Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* FROM */}
          <div
            style={{
              padding: 16,
              background: 'var(--muted)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
              Dimensi Asal (From)
            </span>
            <div>
              <label style={labelStyle}>
                Owner Asal <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <Controller
                name="from_owner_ref"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={companyOptions}
                    placeholder="Pilih owner..."
                    searchPlaceholder="Cari perusahaan..."
                    loading={companiesLoading}
                    error={errors.from_owner_ref?.message as string | undefined}
                  />
                )}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Stage Asal <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <Controller
                name="from_stage"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={stageOptions}
                    placeholder="Pilih stage..."
                    searchPlaceholder="Cari stage..."
                    loading={stagesLoading}
                    error={errors.from_stage?.message as string | undefined}
                  />
                )}
              />
            </div>
            <div>
              <label style={labelStyle}>Lokasi Asal</label>
              <input
                type="text"
                placeholder="GENERAL"
                {...register('from_location_ref')}
                style={inputStyle}
              />
            </div>
          </div>

          {/* TO */}
          <div
            style={{
              padding: 16,
              background: 'var(--surface-raised)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
              Dimensi Tujuan (To)
            </span>
            <div>
              <label style={labelStyle}>
                Owner Tujuan <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <input
                type="text"
                value="GENERAL"
                readOnly
                placeholder="GENERAL"
                style={{
                  ...inputStyle,
                  background: 'var(--muted)',
                  cursor: 'not-allowed',
                  color: 'var(--foreground-muted)',
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 4, display: 'block' }}>
                Owner tujuan selalu GENERAL
              </span>
            </div>
            <div>
              <label style={labelStyle}>
                Stage Tujuan <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <Controller
                name="to_stage"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={stageOptions}
                    placeholder="Pilih stage tujuan..."
                    searchPlaceholder="Cari stage..."
                    loading={stagesLoading}
                    error={errors.to_stage?.message as string | undefined}
                  />
                )}
              />
            </div>
            <div>
              <label style={labelStyle}>Lokasi Tujuan</label>
              <input
                type="text"
                placeholder="GENERAL"
                readOnly={isOutletBranch}
                {...register('to_location_ref')}
                style={
                  isOutletBranch
                    ? {
                        ...inputStyle,
                        background: 'var(--muted)',
                        cursor: 'not-allowed',
                        color: 'var(--foreground-muted)',
                      }
                    : inputStyle
                }
              />
              {isOutletBranch && (
                <span style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 4, display: 'block' }}>
                  Cabang outlet selalu menggunakan lokasi GENERAL
                </span>
              )}
            </div>
            {isSameDimension && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                Dimensi tujuan sama dengan dimensi asal
              </span>
            )}
          </div>
        </div>

        {/* Items */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
              Item yang Dipindahkan
            </span>
            <button
              type="button"
              onClick={() => append({ source_inventory_id: 0, qty: 1 })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--foreground)',
                cursor: 'pointer',
              }}
            >
              <Plus size={13} /> Tambah Item
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fields.map((field, index) => (
              <div
                key={field.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 40px',
                  gap: 10,
                  alignItems: 'start',
                }}
              >
                <Controller
                  name={`items.${index}.source_inventory_id`}
                  control={control}
                  render={({ field: f }) => (
                    <SearchableSelect
                      value={f.value ?? 0}
                      onChange={f.onChange}
                      options={sourceOptions}
                      placeholder="Pilih item..."
                      searchPlaceholder="Cari produk atau batch di dimensi asal..."
                      loading={inventoryLoading}
                      error={errors.items?.[index]?.source_inventory_id?.message as string | undefined}
                      onSearchChange={setDropdownSearch}
                    />
                  )}
                />
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  {...register(`items.${index}.qty`, { valueAsNumber: true })}
                  placeholder="Qty"
                  style={{
                    ...inputStyle,
                    ...(errors.items?.[index]?.qty ? { border: '1px solid var(--destructive)' } : {}),
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (fields.length > 1) remove(index)
                  }}
                  disabled={fields.length <= 1}
                  style={{
                    padding: 8,
                    background: 'none',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: fields.length <= 1 ? 'not-allowed' : 'pointer',
                    color: fields.length <= 1 ? 'var(--border)' : 'var(--destructive)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Catatan</label>
          <textarea
            {...register('description')}
            rows={2}
            placeholder="Catatan opsional"
            style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }}
          />
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="submit"
            disabled={createMutation.isPending || isSameDimension}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 18px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: createMutation.isPending || isSameDimension ? 'not-allowed' : 'pointer',
              opacity: createMutation.isPending || isSameDimension ? 0.6 : 1,
            }}
          >
            {createMutation.isPending ? (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <ArrowRightLeft size={14} />
            )}
            Pindahkan Semua ({fields.length} item)
          </button>
        </div>
      </form>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
