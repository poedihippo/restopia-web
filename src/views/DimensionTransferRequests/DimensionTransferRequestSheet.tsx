'use client'

import React, { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { dimensionTransferRequestsService } from '@/services/dimension-transfer-requests.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { companiesService } from '@/services/companies.service'
import { branchesService } from '@/services/branches.service'
import { toastMutationApiError } from '@/utils/apiError'
import api from '@/hooks/useApi'
import { useAuth } from '@/hooks/useAuth'
import SearchableSelect from '@/components/SearchableSelect'
import { X, Loader2 } from 'lucide-react'

const GENERAL_OWNER_OPTION = { value: 'GENERAL', label: 'General (Umum)' }

interface DimensionInventoryRow {
  id: number
  product_uom_batch_id?: number
  stock?: number
  qty?: number
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
  qty: z.coerce.number().min(1, 'Qty minimal 1'),
  from_owner_ref: z.string().min(1, 'Owner asal wajib diisi'),
  from_stage: z.string().min(1, 'Stage asal wajib diisi'),
  from_location_ref: z.string().default('GENERAL'),
  to_owner_ref: z.string().min(1, 'Owner tujuan wajib diisi'),
  to_stage: z.string().min(1, 'Stage tujuan wajib diisi'),
  to_location_ref: z.string().default('GENERAL'),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface DimensionTransferRequestSheetProps {
  open: boolean
  onClose: () => void
}

export default function DimensionTransferRequestSheet({
  open,
  onClose,
}: DimensionTransferRequestSheetProps) {
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

  const { data: branchesData } = useQuery({
    queryKey: ['branches-all'],
    queryFn: () => branchesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const allBranches: any[] = (branchesData as any)?.data ?? []
  const availableBranches: any[] = isSuperadmin ? allBranches : user?.branches ?? []
  const effectiveBranchId = selectedBranchId || user?.branch?.id

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
      to_owner_ref: '',
      to_stage: '',
      to_location_ref: 'GENERAL',
      description: '',
    },
  })

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['dimension-transfer-source-inventory', effectiveBranchId, debouncedDropdownSearch],
    enabled: !!effectiveBranchId && open,
    queryFn: async () => {
      let allInv: any[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await productInventoriesService
          .list({
            page,
            per_page: 100,
            'filter[branch_id]': effectiveBranchId,
            'filter[search]': debouncedDropdownSearch || undefined,
            include:
              'product_uom_batch,product_uom_batch.product_uom,product_uom_batch.product_uom.product',
          } as any)
          .then((r) => r.data)
        const d = (res as any)?.data
        const items = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []
        allInv = allInv.concat(items)
        totalPages =
          (res as any)?.meta?.last_page ??
          (res as any)?.meta?.total_pages ??
          (d as any)?.meta?.last_page ??
          1
        page += 1
      } while (page <= totalPages && page <= 5)
      return { data: allInv }
    },
  })

  const inventoryRows: DimensionInventoryRow[] = ((inventoryData as any)?.data ?? []).filter(
    (r: any) => Number(r.stock ?? r.qty ?? 0) > 0,
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
    const batchCode =
      row.product_uom_batch?.batch_code ??
      row.product_uom_batch?.code ??
      (row as any).batch_code ??
      '—'
    const owner = ownerLabel(row)
    const stage = row.stage ?? '—'
    const location = row.location_ref ?? '—'
    const stock = row.stock ?? row.qty ?? 0
    return {
      value: row.id,
      label: `${product?.code ?? ''} ${product?.name ?? ''}`.trim() || `Item #${row.id}`,
      sublabel: `batch ${batchCode} · ${owner}/${stage}/${location} · stok ${stock}`,
    }
  })

  const resetForm = () =>
    reset({
      source_inventory_id: 0,
      qty: 1,
      from_owner_ref: 'GENERAL',
      from_stage: 'GENERAL',
      from_location_ref: 'GENERAL',
      to_owner_ref: '',
      to_stage: '',
      to_location_ref: 'GENERAL',
      description: '',
    })

  const createMutation = useMutation({
    mutationFn: (payload: {
      branch_id: number
      product_uom_batch_id: number
      qty: number
      from: { owner_ref: string; stage: string; location_ref: string }
      to: { owner_ref: string; stage: string; location_ref: string }
      description?: string
    }) => dimensionTransferRequestsService.create(payload),
    onSuccess: () => {
      toast.success('Permintaan transfer dimensi berhasil diajukan')
      queryClient.invalidateQueries({ queryKey: ['dimension-transfer-requests'] })
      queryClient.invalidateQueries({ queryKey: ['dimension-transfer-source-inventory'] })
      resetForm()
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal mengajukan permintaan transfer'),
  })

  const fromOwner = watch('from_owner_ref')
  const fromStage = watch('from_stage')
  const fromLocation = watch('from_location_ref') || 'GENERAL'

  const toOwnerRef = watch('to_owner_ref')
  const toStage = watch('to_stage')
  const toLocationRef = watch('to_location_ref') || 'GENERAL'
  const qtyWatched = watch('qty')

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
  const targetCurrentStock = targetRow?.stock ?? targetRow?.qty ?? 0
  const targetAfterStock = targetCurrentStock + Number(qtyWatched || 0)
  const showTargetCaption = !!selectedRow && !!toOwnerRef && !!toStage && !isSameDimension

  const onSubmit = (values: FormValues) => {
    const row = inventoryRows.find((r) => r.id === Number(values.source_inventory_id))
    if (!row) {
      toast.error('Pilih item sumber terlebih dahulu')
      return
    }

    const batchId = row.product_uom_batch_id ?? row.product_uom_batch?.id
    if (!batchId) {
      toast.error('Item sumber tidak memiliki batch')
      return
    }

    const stock = Number(row.stock ?? row.qty ?? 0)
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

    const branchToSend = effectiveBranchId || (row as any).branch_id || user?.branch?.id
    if (!branchToSend) {
      toast.error('Tidak ada cabang aktif')
      return
    }

    createMutation.mutate({
      branch_id: branchToSend,
      product_uom_batch_id: batchId,
      qty: values.qty,
      from: {
        owner_ref: values.from_owner_ref,
        stage: values.from_stage,
        location_ref: values.from_location_ref || 'GENERAL',
      },
      to: {
        owner_ref: values.to_owner_ref,
        stage: values.to_stage,
        location_ref: values.to_location_ref || 'GENERAL',
      },
      description: values.description || undefined,
    })
  }

  const onInvalid = (errs: any) => {
    const first = Object.values(errs)[0] as any
    toast.error(first?.message ?? 'Mohon lengkapi field yang wajib diisi')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
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

  const isPending = createMutation.isPending

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
      <div
        onClick={handleClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 50,
          width: 520,
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
            Permintaan Transfer Dimensi
          </h2>
          <button
            onClick={handleClose}
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
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: 0 }}>
            Ajukan permintaan untuk memindahkan stok antar owner/stage/lokasi sesuai spesifikasi OpenAPI.
          </p>

          {/* Cabang Asal (Lokasi Stok) */}
          <div>
            <label style={labelStyle}>
              Cabang Asal (Lokasi Stok) <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <select
              value={effectiveBranchId || ''}
              onChange={(e) => {
                const newBranchId = Number(e.target.value) || undefined
                setSelectedBranchId(newBranchId)
                setValue('source_inventory_id', 0)
                setValue('from_owner_ref', 'GENERAL')
                setValue('from_stage', 'GENERAL')
                setValue('from_location_ref', 'GENERAL')
                setValue('to_owner_ref', '')
                setValue('to_stage', '')
                setValue('to_location_ref', 'GENERAL')
              }}
              style={inputStyle}
            >
              {availableBranches.length > 0 ? (
                availableBranches.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.company?.name ? `(${b.company.name})` : ''}
                  </option>
                ))
              ) : (
                <option value={user?.branch?.id || ''}>
                  {user?.branch?.name ?? 'Cabang Aktif'}
                </option>
              )}
            </select>
          </div>

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
                      setValue('to_owner_ref', '')
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
                Dimensi Asal: {ownerLabel(selectedRow)} / {selectedRow.stage ?? '—'} / {selectedRow.location_ref ?? '—'} · Stok: {selectedRow.stock ?? selectedRow.qty ?? 0}
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
              min={1}
              step={1}
              {...register('qty', { valueAsNumber: true })}
              style={{
                ...inputStyle,
                ...(errors.qty ? { border: '1px solid var(--destructive)' } : {}),
              }}
            />
            {selectedRow && (
              <span style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 4, display: 'block' }}>
                Tersedia: {selectedRow.stock ?? selectedRow.qty ?? 0}
              </span>
            )}
            {errors.qty && <span style={errorStyle}>{errors.qty.message}</span>}
          </div>

          {/* SECTION FROM (Dimensi Asal) */}
          <div
            style={{
              padding: 14,
              background: 'var(--muted)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>
              Dimensi Asal (From)
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
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
            </div>

            <div>
              <label style={labelStyle}>Lokasi Asal (location_ref)</label>
              <input
                type="text"
                placeholder="GENERAL"
                {...register('from_location_ref')}
                style={inputStyle}
              />
            </div>
          </div>

          {/* SECTION TO (Dimensi Tujuan) */}
          <div
            style={{
              padding: 14,
              background: 'var(--surface-raised)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>
              Dimensi Tujuan (To)
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <div>
                <label style={labelStyle}>
                  Owner Tujuan <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <Controller
                  name="to_owner_ref"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      options={companyOptions}
                      placeholder="Pilih owner tujuan..."
                      searchPlaceholder="Cari perusahaan..."
                      loading={companiesLoading}
                      error={errors.to_owner_ref?.message as string | undefined}
                    />
                  )}
                />
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
            </div>

            <div>
              <label style={labelStyle}>Lokasi Tujuan (location_ref)</label>
              <input
                type="text"
                placeholder="GENERAL"
                {...register('to_location_ref')}
                style={inputStyle}
              />
            </div>

            {isSameDimension && (
              <span style={{ fontSize: 11, color: 'var(--destructive)' }}>
                ⚠️ Dimensi tujuan sama dengan dimensi asal. Harap ubah owner, stage, atau lokasi tujuan.
              </span>
            )}

            {showTargetCaption && (
              <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 500 }}>
                ℹ️ Stok dimensi tujuan saat ini: {targetCurrentStock.toLocaleString('id-ID')} → akan menjadi{' '}
                {targetAfterStock.toLocaleString('id-ID')}
              </span>
            )}
          </div>

          {/* Catatan */}
          <div>
            <label style={labelStyle}>Catatan</label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="Catatan opsional"
              style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }}
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
            onClick={handleClose}
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
            Batal
          </button>
          <button
            type="button"
            disabled={isPending || isSameDimension}
            onClick={handleSubmit(onSubmit, onInvalid)}
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              color: 'white',
              cursor: isPending || isSameDimension ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: isPending || isSameDimension ? 0.6 : 1,
            }}
          >
            {isPending && (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            )}
            Ajukan Permintaan
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
