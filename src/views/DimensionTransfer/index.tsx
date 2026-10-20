'use client'

import React, { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { dimensionTransfersService } from '@/services/dimension-transfers.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { companiesService } from '@/services/companies.service'
import { branchesService } from '@/services/branches.service'
import { getProductUomName } from '@/utils/productUomName'
import api from '@/hooks/useApi'
import { useAuth } from '@/hooks/useAuth'
import SearchableSelect from '@/components/SearchableSelect'
import { Loader2, ArrowRightLeft, Layers } from 'lucide-react'
import BulkDimensionTransfer from './BulkDimensionTransfer'

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

const schema = z.object({
  source_inventory_id: z.coerce.number().min(1, 'Pilih item sumber'),
  qty: z.coerce.number().min(0.001, 'Qty minimal 1'),
  from_owner_ref: z.string().min(1, 'Owner asal wajib diisi'),
  from_stage: z.string().min(1, 'Stage asal wajib diisi'),
  from_location_ref: z.string().default('GENERAL'),
  to_owner_ref: z.string().min(1, 'Owner tujuan wajib diisi'),
  to_stage: z.string().min(1, 'Stage tujuan wajib diisi'),
  to_location_ref: z.string().default('GENERAL'),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function DimensionTransferView() {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single')
  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400)
    return () => clearTimeout(t)
  }, [dropdownSearch])

  const { user, isSuperadmin } = useAuth()
  const [selectedBranchId, setSelectedBranchId] = useState<number | undefined>(user?.branch?.id)

  useEffect(() => {
    if (!selectedBranchId && user?.branch?.id) {
      setSelectedBranchId(user.branch.id)
    }
  }, [user?.branch?.id, selectedBranchId])

  // Fetch available branches
  const { data: branchesData } = useQuery({
    queryKey: ['branches-all'],
    queryFn: () => branchesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const allBranches: any[] = (branchesData as any)?.data ?? []
  const availableBranches: any[] = isSuperadmin ? allBranches : user?.branches ?? []
  const effectiveBranchId = selectedBranchId || user?.branch?.id

  // Outlet branches always hold stock under the GENERAL owner/location, so the
  // "To" dimension is locked to GENERAL for them.
  const activeBranchType =
    allBranches.find((b: any) => b.id === effectiveBranchId)?.type ??
    (effectiveBranchId === user?.branch?.id ? (user as any)?.branch?.type : undefined)
  const isOutletBranch = activeBranchType === 'outlet'

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
      source_inventory_id: 0,
      qty: 1,
      from_owner_ref: 'GENERAL',
      from_stage: 'GENERAL',
      from_location_ref: 'GENERAL',
      to_owner_ref: 'GENERAL',
      to_stage: '',
      to_location_ref: 'GENERAL',
      description: '',
    },
  })

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

  const inventoryRows: DimensionInventoryRow[] = ((inventoryData as any)?.data ?? []).filter(
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

  const sourceInventoryId = watch('source_inventory_id')
  const selectedRow = inventoryRows.find((r) => r.id === Number(sourceInventoryId))

  const sourceOptions = inventoryRows.map((row) => {
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
  })

  const fromOwner = watch('from_owner_ref')
  const fromStage = watch('from_stage')
  const fromLocation = watch('from_location_ref') || 'GENERAL'

  const toOwnerRef = watch('to_owner_ref')
  const toStage = watch('to_stage')
  const toLocationRef = watch('to_location_ref') || 'GENERAL'
  const qtyWatched = watch('qty')

  // Outlet branch: owner & location tujuan selalu GENERAL (read-only).
  useEffect(() => {
    if (isOutletBranch) {
      setValue('to_owner_ref', 'GENERAL')
      setValue('to_location_ref', 'GENERAL')
    }
  }, [isOutletBranch, setValue])

  const isSameDimension =
    !!fromOwner &&
    !!toOwnerRef &&
    fromOwner === toOwnerRef &&
    fromStage === toStage &&
    fromLocation === toLocationRef

  const targetBatchId = selectedRow?.product_uom_batch_id ?? selectedRow?.product_uom_batch?.id
  const targetRow = inventoryRows.find((r) => {
    const batchId = r.product_uom_batch_id ?? r.product_uom_batch?.id
    return (
      batchId === targetBatchId &&
      (r.owner_ref ?? 'GENERAL') === toOwnerRef &&
      (r.stage ?? 'GENERAL') === toStage &&
      (r.location_ref ?? 'GENERAL') === toLocationRef
    )
  })
  const targetCurrentStock = targetRow?.display_qty ?? targetRow?.stock ?? targetRow?.qty ?? 0
  const targetAfterStock = targetCurrentStock + Number(qtyWatched || 0)
  const showTargetCaption = !!selectedRow && !!toOwnerRef && !!toStage && !isSameDimension

  const createMutation = useMutation({
    mutationFn: (payload: {
      branch_id: number
      product_uom_batch_id: number
      qty: number
      from: { owner_ref: string; stage: string; location_ref: string }
      to: { owner_ref: string; stage: string; location_ref: string }
      description?: string
    }) => dimensionTransfersService.create(payload),
    onSuccess: () => {
      toast.success('Stok dipindahkan')
      reset({
        source_inventory_id: 0,
        qty: 1,
        from_owner_ref: 'GENERAL',
        from_stage: 'GENERAL',
        from_location_ref: 'GENERAL',
        to_owner_ref: 'GENERAL',
        to_stage: '',
        to_location_ref: 'GENERAL',
        description: '',
      })
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      queryClient.invalidateQueries({ queryKey: ['dimension-transfer-source-inventory'] })
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? 'Gagal memindahkan stok'),
  })

  const onSubmit = (values: FormValues) => {
    const row = inventoryRows.find((r) => r.id === Number(values.source_inventory_id))
    if (!row) {
      toast.error('Pilih item sumber yang valid')
      return
    }

    const batchId = row.product_uom_batch_id ?? row.product_uom_batch?.id
    if (!batchId) {
      toast.error('Item sumber tidak memiliki batch')
      return
    }

    // Transfer qty is entered in the source batch's own uom, so availability
    // must use display_qty, not base_stock.
    const stock = Number(row.display_qty ?? row.stock ?? row.qty ?? 0)
    if (Number(values.qty) > stock) {
      toast.error(`Qty melebihi stok tersedia (${stock})`)
      return
    }

    const noOp =
      values.from_owner_ref === values.to_owner_ref &&
      values.from_stage === values.to_stage &&
      (values.from_location_ref || 'GENERAL') === (values.to_location_ref || 'GENERAL')

    if (noOp) {
      toast.error('Dimensi tujuan harus berbeda dari dimensi asal')
      return
    }

    if (!effectiveBranchId) {
      toast.error('Tidak ada cabang aktif')
      return
    }

    createMutation.mutate({
      branch_id: effectiveBranchId,
      product_uom_batch_id: batchId,
      qty: values.qty,
      from: {
        owner_ref: values.from_owner_ref,
        stage: values.from_stage,
        location_ref: values.from_location_ref || 'GENERAL',
      },
      to: {
        // Owner tujuan selalu GENERAL — backend memperlakukan owner_ref sebagai
        // free text, jangan kirim ID company.
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
        padding: '32px 32px 64px',
        maxWidth: 980,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            fontWeight: 500,
            color: 'var(--foreground)',
            margin: 0,
          }}
        >
          Dimension Transfer
        </h1>
        <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
          Pindahkan stok antar owner/stage/lokasi sesuai skema OpenAPI
        </p>
      </div>

      {/* Branch Selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
          Cabang:
        </label>
        <div style={{ minWidth: 250 }}>
          <SearchableSelect
            value={effectiveBranchId ?? 0}
            onChange={(val) => {
              setSelectedBranchId(val as number)
            }}
            options={availableBranches.map((b: any) => ({
              value: b.id,
              label: b.name,
              sublabel: b.company?.name,
            }))}
            placeholder="Pilih cabang..."
            searchPlaceholder="Cari cabang..."
          />
        </div>
        {!effectiveBranchId && (
          <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
            Pilih cabang terlebih dahulu
          </span>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 8,
        }}
      >
        <button
          onClick={() => setActiveTab('single')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: activeTab === 'single' ? 600 : 500,
            background: activeTab === 'single' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'single' ? 'white' : 'var(--foreground-muted)',
          }}
        >
          <ArrowRightLeft size={14} />
          Satuan
        </button>
        <button
          onClick={() => setActiveTab('bulk')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: activeTab === 'bulk' ? 600 : 500,
            background: activeTab === 'bulk' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'bulk' ? 'white' : 'var(--foreground-muted)',
          }}
        >
          <Layers size={14} />
          Bulk (Banyak Item)
        </button>
      </div>

      {activeTab === 'single' ? (
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
          {/* Item Sumber */}
          <div>
            <label style={labelStyle}>
              Item Sumber (Produk / Batch) <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <Controller
              name="source_inventory_id"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? 0}
                  onChange={(val) => {
                    field.onChange(val)
                    const row = inventoryRows.find((r) => r.id === Number(val))
                    if (row) {
                      setValue('from_owner_ref', row.owner_ref ?? 'GENERAL')
                      setValue('from_stage', row.stage ?? 'GENERAL')
                      setValue('from_location_ref', row.location_ref ?? 'GENERAL')
                      setValue('to_owner_ref', 'GENERAL')
                      setValue('to_stage', '')
                      setValue('to_location_ref', 'GENERAL')
                    }
                  }}
                  options={sourceOptions}
                  placeholder="Pilih item, batch, dan dimensi sumber..."
                  searchPlaceholder="Cari produk atau batch..."
                  loading={inventoryLoading}
                  error={errors.source_inventory_id?.message as string | undefined}
                  onSearchChange={setDropdownSearch}
                />
              )}
            />
            {selectedRow && (
              <span style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 4, display: 'block' }}>
                Dimensi Asal Terdeteksi: {ownerLabel(selectedRow)} / {selectedRow.stage ?? '—'} / {selectedRow.location_ref ?? '—'} · Stok: {selectedRow.display_qty ?? selectedRow.stock ?? selectedRow.qty ?? 0}
              </span>
            )}
          </div>

          {/* Qty */}
          <div>
            <label style={labelStyle}>
              Qty <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <input
              type="number"
              min="0.001"
              step="any"
              {...register('qty', { valueAsNumber: true })}
              style={{
                ...inputStyle,
                ...(errors.qty ? { border: '1px solid var(--destructive)' } : {}),
              }}
            />
            {selectedRow && (
              <span style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 4, display: 'block' }}>
                Tersedia: {selectedRow.display_qty ?? selectedRow.stock ?? selectedRow.qty ?? 0}
              </span>
            )}
            {errors.qty && <span style={errorStyle}>{errors.qty.message}</span>}
          </div>

          {/* SECTION FROM (Dimensi Asal) */}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                Dimensi Asal (From)
              </span>
              <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                Diisi otomatis dari inventori sumber
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div>
                <label style={labelStyle}>
                  Owner Asal (owner_ref) <span style={{ color: 'var(--destructive)' }}>*</span>
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
                  Stage Asal (stage) <span style={{ color: 'var(--destructive)' }}>*</span>
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
                <label style={labelStyle}>
                  Lokasi Asal (location_ref)
                </label>
                <input
                  type="text"
                  placeholder="GENERAL"
                  {...register('from_location_ref')}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* SECTION TO (Dimensi Tujuan) */}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                Dimensi Tujuan (To)
              </span>
              <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                Target perpindahan stok barang
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div>
                <label style={labelStyle}>
                  Owner Tujuan (owner_ref) <span style={{ color: 'var(--destructive)' }}>*</span>
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
                  Stage Tujuan (stage) <span style={{ color: 'var(--destructive)' }}>*</span>
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
                <label style={labelStyle}>
                  Lokasi Tujuan (location_ref)
                </label>
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
            </div>

            {isSameDimension && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                ⚠️ Dimensi tujuan sama persis dengan dimensi asal. Harap ubah owner, stage, atau lokasi tujuan.
              </span>
            )}

            {showTargetCaption && (
              <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500 }}>
                ℹ️ Stok dimensi tujuan saat ini: {targetCurrentStock.toLocaleString('id-ID')} → akan menjadi{' '}
                {targetAfterStock.toLocaleString('id-ID')}
              </span>
            )}
          </div>

          {/* Catatan */}
          <div>
            <label style={labelStyle}>Catatan / Deskripsi</label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="Catatan opsional (misal: Transfer stok dari GENERAL ke mitra / pindah stage)"
              style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }}
            />
          </div>

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
              Pindahkan
            </button>
          </div>
        </form>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
      ) : (
        <BulkDimensionTransfer branchId={effectiveBranchId} />
      )}
    </div>
  )
}
