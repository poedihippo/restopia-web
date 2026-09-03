'use client'

import React, { useEffect,  useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { dimensionTransferRequestsService } from '@/services/dimension-transfer-requests.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { companiesService } from '@/services/companies.service'
import { toastMutationApiError } from '@/utils/apiError'
import api from '@/hooks/useApi'
import { useAuth } from '@/hooks/useAuth'
import SearchableSelect from '@/components/SearchableSelect'
import { X, Loader2 } from 'lucide-react'

const GENERAL_OWNER_OPTION = { value: 'GENERAL', label: 'Umum (GENERAL)' }

interface DimensionInventoryRow {
  id: number
  product_uom_batch_id?: number
  stock?: number
  owner_ref?: string
  owner_display?: string
  owner_company_name?: string
  stage?: string
  location_ref?: string
  product_uom_batch?: {
    id: number
    code?: string
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
  to_owner_ref: z.string().min(1, 'Owner tujuan wajib diisi'),
  to_stage: z.string().min(1, 'Stage tujuan wajib diisi'),
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
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const { user } = useAuth()
  const branchId = user?.branch?.id
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
      to_owner_ref: '',
      to_stage: '',
      description: '',
    },
  })

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['dimension-transfer-source-inventory', branchId],
    enabled: !!branchId && open,
    queryFn: async () => {
      let allInv: any[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await productInventoriesService
          .list({
            page,
            per_page: 100,
            'filter[branch_id]': branchId,
            'filter[status]': 'active',
            include: 'product_uom_batch.product_uom.product',
          } as any)
          .then((r) => r.data)
        const items = (res as any)?.data ?? []
        allInv = allInv.concat(items)
        totalPages =
          (res as any)?.meta?.last_page ?? (res as any)?.meta?.total_pages ?? 1
        page += 1
      } while (page <= totalPages)
      return { data: allInv }
    },
  })

  const inventoryRows: DimensionInventoryRow[] = ((inventoryData as any)?.data ?? []).filter(
    (r: any) => Number(r.stock ?? 0) > 0,
  )

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies-all', debouncedDropdownSearch],
    queryFn: () => companiesService.list({ 'filter[search]': debouncedDropdownSearch || undefined,  per_page: 100  } as any).then((r) => r.data),
  })
  const companies: { id: number; name: string }[] = (companiesData as any)?.data ?? []
  const companyOptions = [
    GENERAL_OWNER_OPTION,
    ...companies.map((c) => ({ value: String(c.id), label: c.name })),
  ]

  const { data: stagesData, isLoading: stagesLoading } = useQuery({
    queryKey: ['stages-all', debouncedDropdownSearch],
    queryFn: () => api.get('/stages', { params: { per_page: 100 } }).then((r) => r.data),
  })
  const stages: { code: string; name: string }[] = (stagesData as any)?.data ?? []
  const stageOptions = stages.map((s) => ({ value: s.code, label: s.name }))

  const ownerLabel = (row: DimensionInventoryRow | undefined): string => {
    if (!row) return '—'
    if (row.owner_display) return row.owner_display
    if (row.owner_company_name) return row.owner_company_name
    const ownerRef = row.owner_ref
    if (!ownerRef) return '—'
    if (ownerRef === 'GENERAL') return 'Umum'
    const match = companies.find((c) => String(c.id) === String(ownerRef))
    return match?.name ?? ownerRef
  }

  const sourceInventoryId = watch('source_inventory_id')
  const selectedRow = inventoryRows.find((r) => r.id === Number(sourceInventoryId))

  const sourceOptions = inventoryRows.map((row) => {
    const product = row.product_uom_batch?.product_uom?.product
    const batchCode = row.product_uom_batch?.code ?? '—'
    const owner = ownerLabel(row)
    const stage = row.stage ?? '—'
    const location = row.location_ref ?? '—'
    const stock = row.stock ?? 0
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
      to_owner_ref: '',
      to_stage: '',
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
      toast.success('Permintaan transfer dimensi dibuat')
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['dimension-transfer-requests'] })
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Gagal membuat permintaan transfer dimensi'),
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

    const stock = Number(row.stock ?? 0)
    if (Number(values.qty) > stock) {
      toast.error(`Qty melebihi stok tersedia (${stock})`)
      return
    }

    const fromOwner = row.owner_ref ?? ''
    const fromStage = row.stage ?? ''
    const fromLocation = row.location_ref ?? ''
    const noOp = values.to_owner_ref === fromOwner && values.to_stage === fromStage
    if (noOp) {
      toast.error('Dimensi tujuan harus berbeda dari sumber')
      return
    }

    if (!branchId) {
      toast.error('Tidak ada cabang aktif')
      return
    }

    createMutation.mutate({
      branch_id: branchId,
      product_uom_batch_id: batchId,
      qty: values.qty,
      from: { owner_ref: fromOwner, stage: fromStage, location_ref: fromLocation },
      to: {
        owner_ref: values.to_owner_ref,
        stage: values.to_stage,
        location_ref: 'GENERAL',
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
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--foreground)',
    marginBottom: 6,
    display: 'block',
  }

  const errorStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--destructive)',
    marginTop: 4,
  }

  const isPending = createMutation.isPending

  const toOwnerRef = watch('to_owner_ref')
  const toStage = watch('to_stage')
  const qtyWatched = watch('qty')

  const targetBatchId = selectedRow?.product_uom_batch_id ?? selectedRow?.product_uom_batch?.id
  const targetRow = inventoryRows.find((r) => {
    const batchId = r.product_uom_batch_id ?? r.product_uom_batch?.id
    return (
      batchId === targetBatchId &&
      r.owner_ref === toOwnerRef &&
      r.stage === toStage &&
      (r.location_ref ?? 'GENERAL') === 'GENERAL'
    )
  })
  const targetCurrentStock = targetRow?.stock ?? 0
  const targetAfterStock = targetCurrentStock + Number(qtyWatched || 0)
  const showTargetCaption = !!selectedRow && !!toOwnerRef && !!toStage

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
            gap: 20,
          }}
        >
          <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: 0 }}>
            Ajukan permintaan untuk memindahkan stok antar owner/stage. Transfer baru
            dijalankan setelah disetujui.
          </p>

          <div>
            <label style={labelStyle}>
              Item Sumber <span style={{ color: 'var(--destructive)' }}>*</span>
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
                      setValue('to_owner_ref', row.owner_ref ?? 'GENERAL')
                      setValue('to_stage', row.stage ?? '')
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
                Dari: {ownerLabel(selectedRow)}/{selectedRow.stage ?? '—'}/{selectedRow.location_ref ?? '—'},
                {' '}stok {selectedRow.stock ?? 0}
              </span>
            )}
          </div>

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
                Tersedia: {selectedRow.stock ?? 0}
              </span>
            )}
            {errors.qty && <span style={errorStyle}>{errors.qty.message}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
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
                    placeholder="Pilih owner..."
                    searchPlaceholder="Cari perusahaan..."
                    loading={companiesLoading}
                    error={errors.to_owner_ref?.message as string | undefined}
                    onSearchChange={setDropdownSearch}
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
                    placeholder="Pilih stage..."
                    searchPlaceholder="Cari stage..."
                    loading={stagesLoading}
                    error={errors.to_stage?.message as string | undefined}
                    onSearchChange={setDropdownSearch}
/>
                )}
              />
            </div>
          </div>

          {showTargetCaption && (
            <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              Tujuan saat ini: {targetCurrentStock.toLocaleString('id-ID')} → akan menjadi{' '}
              {targetAfterStock.toLocaleString('id-ID')}
            </span>
          )}

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
            disabled={isPending}
            onClick={handleSubmit(onSubmit, onInvalid)}
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              color: 'white',
              cursor: isPending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: isPending ? 0.7 : 1,
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
