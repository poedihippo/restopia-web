'use client'

import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Layers, X } from 'lucide-react'
import { dimensionTransfersService } from '@/services/dimension-transfers.service'
import { toastMutationApiError } from '@/utils/apiError'
import { getProductUomName } from '@/utils/productUomName'
import SearchableSelect from '@/components/SearchableSelect'
import api from '@/hooks/useApi'

export interface ChangeDimensionInventory {
  id: number
  branch_id: number
  stock?: number
  qty?: number
  display_qty?: number | null
  display_uom_code?: string | null
  owner_ref?: string
  stage?: string
  location_ref?: string
  product_uom?: { code?: string; product?: { name: string }; uom?: { code: string } }
  product_uom_batch?: {
    id: number
    code?: string
    batch_code?: string
    product_uom?: { code?: string; product?: { name: string }; uom?: { code: string } }
  }
}

interface Props {
  inventory: ChangeDimensionInventory
  onClose: () => void
}

/**
 * Pindah stage untuk satu baris inventori — hit endpoint yang sama dengan
 * menu Dimension Transfer (single). Owner & lokasi dikunci, hanya stage yang
 * berubah.
 */
export default function ChangeDimensionModal({ inventory, onClose }: Props) {
  const queryClient = useQueryClient()
  const ownerRef = inventory.owner_ref ?? 'GENERAL'
  const fromStage = inventory.stage ?? 'GENERAL'
  const locationRef = inventory.location_ref ?? 'GENERAL'
  const available = Number(inventory.display_qty ?? inventory.stock ?? inventory.qty ?? 0)
  const uomCode = inventory.display_uom_code ?? ''
  const batchId = inventory.product_uom_batch?.id

  const [toStage, setToStage] = useState('')
  const [qty, setQty] = useState<string>(String(available || ''))
  const [description, setDescription] = useState('')

  const { data: stagesData, isLoading: stagesLoading } = useQuery({
    queryKey: ['stages-all'],
    queryFn: () => api.get('/stages', { params: { per_page: 100 } }).then((r) => r.data),
  })
  const stages: { code?: string; name: string }[] = (stagesData as any)?.data ?? []
  const stageOptions = (
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
  ).filter((o) => o.value !== fromStage)

  const mutation = useMutation({
    mutationFn: () =>
      dimensionTransfersService.create({
        branch_id: inventory.branch_id,
        product_uom_batch_id: batchId as number,
        qty: Number(qty),
        from: { owner_ref: ownerRef, stage: fromStage, location_ref: locationRef },
        to: { owner_ref: ownerRef, stage: toStage, location_ref: locationRef },
        description: description || undefined,
      }),
    onSuccess: () => {
      toast.success('Stage berhasil diubah')
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      queryClient.invalidateQueries({ queryKey: ['dimension-transfer-source-inventory'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal mengubah dimensi'),
  })

  const handleSubmit = () => {
    if (!batchId) return toast.error('Inventori ini tidak memiliki batch')
    if (!toStage) return toast.error('Pilih stage tujuan')
    const n = Number(qty)
    if (!Number.isFinite(n) || n <= 0) return toast.error('Qty harus lebih dari 0')
    if (n > available) return toast.error(`Qty melebihi stok tersedia (${available})`)
    mutation.mutate()
  }

  const productUom = inventory.product_uom_batch?.product_uom ?? inventory.product_uom
  const productLabel = getProductUomName(productUom as any, productUom?.product?.name)
  const batchCode = inventory.product_uom_batch?.batch_code ?? inventory.product_uom_batch?.code ?? '—'

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
  const lockedStyle: React.CSSProperties = {
    ...inputStyle,
    background: 'var(--muted)',
    cursor: 'not-allowed',
    color: 'var(--foreground-muted)',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--foreground)',
    marginBottom: 4,
    display: 'block',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }}
      />
      <div
        style={{
          position: 'relative',
          width: 480,
          maxWidth: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)' }}>
              Change Dimension
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--foreground-muted)',
              display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: 'var(--foreground-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{productLabel}</span>
            <span>
              Batch {batchCode} · Stok {available.toLocaleString('id-ID', { maximumFractionDigits: 3 })} {uomCode}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Owner (owner_ref)</label>
              <input type="text" value={ownerRef} readOnly disabled style={lockedStyle} />
            </div>
            <div>
              <label style={labelStyle}>Lokasi (location_ref)</label>
              <input type="text" value={locationRef} readOnly disabled style={lockedStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Stage Asal</label>
              <input type="text" value={fromStage} readOnly disabled style={lockedStyle} />
            </div>
            <div>
              <label style={labelStyle}>
                Stage Tujuan <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <SearchableSelect
                value={toStage}
                onChange={(v) => setToStage(String(v))}
                options={stageOptions}
                placeholder="Pilih stage tujuan..."
                searchPlaceholder="Cari stage..."
                loading={stagesLoading}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>
              Qty {uomCode && `(${uomCode})`} <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <input
              type="number"
              min="0.001"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              style={inputStyle}
            />
            <span style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 4, display: 'block' }}>
              Tersedia: {available.toLocaleString('id-ID', { maximumFractionDigits: 3 })} {uomCode}
            </span>
          </div>

          <div>
            <label style={labelStyle}>Catatan</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Catatan opsional"
              style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }}
            />
          </div>
        </div>

        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
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
              color: 'var(--foreground)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
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
              cursor: mutation.isPending ? 'not-allowed' : 'pointer',
              opacity: mutation.isPending ? 0.6 : 1,
            }}
          >
            {mutation.isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Change Dimension
          </button>
        </div>
      </div>
    </div>
  )
}
