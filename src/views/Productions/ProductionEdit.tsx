'use client'

import React, { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import useGetProduction from '@/hooks/productions/useGetProduction'
import ProductionForm from './ProductionForm'

interface Props {
  id: number
}

const INCLUDE =
  'branch,production_details.product_inventory.product_uom,production_details.product_detail_materials'

function mapApiToForm(data: any) {
  if (!data) return undefined
  const dateStr =
    data.date != null
      ? typeof data.date === 'string'
        ? data.date.slice(0, 10)
        : new Date(data.date).toISOString().split('T')[0]
      : ''

  const detailsRows =
    data.production_details?.map((d: any) => {
      const mats =
        d.product_detail_materials?.map((m: any) => ({
          product_inventory_id: m.product_inventory_id ?? 0,
          qty: m.qty ?? 1,
        })) ?? []
      return {
        product_uom_id: d.product_inventory?.product_uom_id ?? d.product_uom_id ?? 0,
        qty: d.qty ?? 1,
        status: d.status === 'final' ? 'final' : 'pending',
        expiry_date: d.expiry_date ? String(d.expiry_date).slice(0, 10) : '',
        description: d.description ?? '',
        materials: mats.length > 0 ? mats : [{ product_inventory_id: 0, qty: 1 }],
      }
    }) ?? []

  const details =
    detailsRows.length > 0
      ? detailsRows
      : [
          {
            product_uom_id: 0,
            qty: 1,
            status: 'pending' as const,
            expiry_date: '',
            description: '',
            materials: [{ product_inventory_id: 0, qty: 1 }],
          },
        ]

  return {
    code: data.code ?? '',
    date: dateStr,
    status: data.status === 'final' ? 'final' : 'pending',
    description: data.description ?? '',
    details,
  }
}

export default function ProductionEdit({ id }: Props) {
  const { data, isLoading } = useGetProduction(id, {
    include: INCLUDE,
  })

  const initialData = useMemo(() => mapApiToForm(data), [data])

  if (!id || Number.isNaN(id)) {
    return null
  }

  if (isLoading || !data) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 240,
          color: 'var(--foreground-muted)',
        }}
      >
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <>
      <ProductionForm mode="edit" productionId={id} initialData={initialData} />
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
