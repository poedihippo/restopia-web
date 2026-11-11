'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import api from '@/hooks/useApi'
import { productUomsService } from '@/services/product-uoms.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import ProductionForm from './ProductionForm'
import BackLink from '@/components/BackLink'
import { parseDate } from '@/helper/parseDate'
import { getProductUomName } from '@/utils/productUomName'

interface Props {
  id: number
}

// Edit needs every detail's materials (or saving would drop them) plus enough
// nesting to show names. Deep includes on productions can 500, so try the
// richer one first and fall back to the include the detail page already uses;
// any names still missing are looked up separately below.
const INCLUDES = [
  'branch,created_by,production_details,production_details.product_uom,production_details.production_detail_materials,production_details.production_detail_materials.product_inventory',
  'branch,created_by,updated_by,production_details,production_details.production_detail_materials',
]

const materialsOf = (d: any): any[] => d?.production_detail_materials ?? d?.materials ?? []
const nullable = (v: any) => (v == null || v === '' ? null : v)

export function mapApiToForm(production: any) {
  if (!production) return undefined

  const details = (production.production_details ?? []).map((d: any) => ({
    id: d.id ?? undefined,
    recipe_id: d.recipe_id ?? undefined,
    product_uom_id: d.product_uom_id ?? 0,
    qty: d.qty ?? 1,
    status: d.status ?? 'pending',
    // API field is planned_expiry_date (expiry_date kept as a fallback).
    expiry_date: parseDate(d.planned_expiry_date ?? d.expiry_date ?? ''),
    planned_batch_code: d.planned_batch_code ?? '',
    description: d.description ?? '',
    // Saved per-item / per-material dimensions (null = follow the header).
    owner_ref: nullable(d.owner_ref),
    stage: nullable(d.stage),
    location_ref: nullable(d.location_ref),
    materials: materialsOf(d).map((m: any) => ({
      id: m.id ?? undefined,
      product_inventory_id: m.product_inventory_id ?? 0,
      qty: m.qty ?? 1,
      // Per-unit ratio so changing the item qty rescales saved materials too.
      base_ratio: Number(d.qty) > 0 ? Number(m.qty ?? 0) / Number(d.qty) : undefined,
      owner_ref: nullable(m.owner_ref),
      stage: nullable(m.stage),
      location_ref: nullable(m.location_ref),
    })),
  }))

  return {
    code: production.code ?? '',
    date: parseDate(production.date ?? ''),
    status: production.status ?? 'pending',
    description: production.description ?? '',
    source_owner_ref: production.source_owner_ref ?? 'GENERAL',
    source_stage: production.source_stage ?? 'GENERAL',
    source_location_ref: production.source_location_ref ?? 'GENERAL',
    output_owner_ref: production.output_owner_ref ?? 'GENERAL',
    output_stage: production.output_stage ?? 'GENERAL',
    output_location_ref: production.output_location_ref ?? 'GENERAL',
    details:
      details.length > 0
        ? details
        : [{ product_uom_id: 0, qty: 1, status: 'pending' as const, expiry_date: '', planned_batch_code: '', description: '', owner_ref: null, stage: null, location_ref: null, materials: [] }],
  }
}

export default function ProductionEdit({ id }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['production', id, 'edit'],
    enabled: !!id && !Number.isNaN(id),
    retry: false,
    queryFn: async () => {
      let lastError: unknown
      for (const include of INCLUDES) {
        try {
          const r = await api.get(`productions/${id}`, { params: { include } })
          return (r.data as any)?.data
        } catch (e) {
          lastError = e
        }
      }
      throw lastError
    },
  })

  const details: any[] = data?.production_details ?? []

  // Item products without a nested product_uom → look them up by id.
  const missingUomIds = Array.from(
    new Set(details.filter((d) => d.product_uom_id && !d.product_uom).map((d) => Number(d.product_uom_id))),
  ).sort((a, b) => a - b)
  const { data: uomLookup, isLoading: uomLookupLoading } = useQuery({
    queryKey: ['production-edit-uoms', missingUomIds],
    enabled: missingUomIds.length > 0,
    queryFn: () =>
      productUomsService
        .list({ per_page: 200, include: 'product,uom', 'filter[ids]': missingUomIds.join(',') } as any)
        .then((r) => r.data),
  })

  // Materials whose inventory lacks batch → product_uom → look up by batch id.
  const missingBatchIds = Array.from(
    new Set(
      details
        .flatMap(materialsOf)
        .map((m) => m?.product_inventory)
        .filter((inv) => inv && !inv.product_uom_batch?.product_uom && inv.product_uom_batch_id)
        .map((inv) => Number(inv.product_uom_batch_id)),
    ),
  ).sort((a, b) => a - b)
  const { data: invLookup, isLoading: invLookupLoading } = useQuery({
    queryKey: ['production-edit-inventories', missingBatchIds],
    enabled: missingBatchIds.length > 0,
    queryFn: () =>
      productInventoriesService
        .list({
          per_page: 200,
          include: 'product_uom_batch,product_uom_batch.product_uom,product_uom_batch.product_uom.uom',
          'filter[product_uom_batch_ids]': missingBatchIds.join(','),
        } as any)
        .then((r) => r.data),
  })

  const initialData = useMemo(() => mapApiToForm(data), [data])

  // "Product — UOM" for each item's finished-product picker.
  const initialDetailLabels = useMemo(() => {
    const byId = new Map<number, any>()
    for (const pu of ((uomLookup as any)?.data ?? []) as any[]) byId.set(Number(pu.id), pu)
    const labels: Record<number, string> = {}
    details.forEach((d, i) => {
      const pu = d.product_uom ?? byId.get(Number(d.product_uom_id))
      if (!pu) return
      const name = getProductUomName(pu)
      const code = pu?.uom?.code
      if (name) labels[i] = code ? `${name} — ${code}` : name
    })
    return labels
  }, [details, uomLookup])

  // "Product · UOM · SKU" for each material row.
  const initialMaterialLabels = useMemo(() => {
    const byBatch = new Map<number, any>()
    for (const inv of ((invLookup as any)?.data ?? []) as any[]) {
      if (inv?.product_uom_batch) byBatch.set(Number(inv.product_uom_batch_id), inv.product_uom_batch)
    }
    const labels: Record<string, string> = {}
    details.forEach((d, di) => {
      materialsOf(d).forEach((m: any, mi: number) => {
        const inv = m?.product_inventory
        if (!inv) return
        const batch = inv.product_uom_batch?.product_uom ? inv.product_uom_batch : byBatch.get(Number(inv.product_uom_batch_id))
        const pu = batch?.product_uom ?? inv.product_uom
        const name = getProductUomName(pu)
        const uomCode = pu?.uom?.code ?? ''
        const sku = inv.code ?? ''
        const label = [name, uomCode, sku ? `SKU: ${sku}` : ''].filter(Boolean).join(' · ')
        if (label) labels[`${di}-${mi}`] = label
      })
    })
    return labels
  }, [details, invLookup])

  if (!id || Number.isNaN(id)) {
    return null
  }

  if (isError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <BackLink href="/production" label="Productions" />
        <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: 'var(--destructive)' }}>
          Failed to load this production. Go back and try again.
        </div>
      </div>
    )
  }

  // Wait for the name lookups too, so the form opens with labels filled in.
  if (isLoading || !data || (missingUomIds.length > 0 && uomLookupLoading) || (missingBatchIds.length > 0 && invLookupLoading)) {
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
      <ProductionForm
        mode="edit"
        productionId={id}
        initialData={initialData}
        initialMaterialLabels={initialMaterialLabels}
        initialDetailLabels={initialDetailLabels}
      />
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
