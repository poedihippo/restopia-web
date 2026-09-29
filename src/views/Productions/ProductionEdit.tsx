'use client'

import React, { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import useGetProduction from '@/hooks/productions/useGetProduction'
import ProductionForm from './ProductionForm'
import { parseDate } from '@/helper/parseDate'
import { getProductUomName } from '@/utils/productUomName'

interface Props {
  id: number
}

const INCLUDE = 'branch,created_by,production_details'

function getProductName(inv: any): string {
  return getProductUomName(inv?.product_uom_batch?.product_uom ?? inv?.product_uom)
}

function getUomCode(inv: any): string {
  return (
    inv?.product_uom_batch?.product_uom?.uom?.code ??
    inv?.product_uom?.uom?.code ??
    ''
  )
}

function mapApiToForm(production: any) {
  if (!production) return undefined
  const dateStr =
    production.date != null
      ? typeof production.date === 'string'
        ? parseDate(production.date)
        : parseDate(production.date)
      : ''

  const detailsRows = (production.production_details ?? []).map((d: any) => {
    const mats =
      (d.production_detail_materials ?? d.materials ?? []).map((m: any) => ({
        product_inventory_id: m.product_inventory_id ?? 0,
        qty: m.qty ?? 1,
        // Per-material dimension overrides: null = inherit from header
        // Only set if explicitly different from header (user override)
        owner_ref: null,
        stage: null,
        location_ref: null,
      }))
    return {
      product_uom_id: d.product_uom_id ?? 0,
      qty: d.qty ?? 1,
      status: d.status ?? 'pending',
      expiry_date: parseDate(d.expiry_date) ? parseDate(d.expiry_date) : '',
      description: d.description ?? '',
      // Per-detail dimension overrides: null = inherit from header
      owner_ref: null,
      stage: null,
      location_ref: null,
      materials: mats.length > 0 ? mats : [{ product_inventory_id: 0, qty: 1, owner_ref: null, stage: null, location_ref: null }],
    }
  })

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
          owner_ref: null,
          stage: null,
          location_ref: null,
          materials: [{ product_inventory_id: 0, qty: 1, owner_ref: null, stage: null, location_ref: null }],
        },
      ]

  return {
    code: production.code ?? '',
    date: dateStr,
    status: production.status ?? 'pending',
    description: production.description ?? '',
    source_owner_ref: production.source_owner_ref ?? 'GENERAL',
    source_stage: production.source_stage ?? 'GENERAL',
    source_location_ref: production.source_location_ref ?? 'GENERAL',
    output_owner_ref: production.output_owner_ref ?? 'GENERAL',
    output_stage: production.output_stage ?? 'GENERAL',
    output_location_ref: production.output_location_ref ?? 'GENERAL',
    details,
  }
}

/** Build material label map { "detailIdx-matIdx": "ProductName · UomCode · SKU" } from API data */
function buildMaterialLabels(production: any): Record<string, string> {
  const labels: Record<string, string> = {}
  ;(production?.production_details ?? []).forEach((d: any, di: number) => {
    ;(d?.production_detail_materials ?? []).forEach((m: any, mi: number) => {
      const inv = m?.product_inventory
      if (!inv) return
      const name = getProductName(inv)
      const uomCode = getUomCode(inv)
      const sku = inv?.code ?? ''
      labels[`${di}-${mi}`] = [name, uomCode, sku ? `SKU: ${sku}` : '']
        .filter(Boolean)
        .join(' · ')
    })
  })
  return labels
}

export default function ProductionEdit({ id }: Props) {
  const { data, isLoading } = useGetProduction(id, {
    include: INCLUDE,
  })

  const initialData = useMemo(() => mapApiToForm(data), [data])
  const initialMaterialLabels = useMemo(() => buildMaterialLabels(data), [data])

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
      <ProductionForm mode="edit" productionId={id} initialData={initialData} initialMaterialLabels={initialMaterialLabels} />
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}

