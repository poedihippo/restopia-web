'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { deliveriesService } from '@/services/deliveries.service'
import DeliveryForm from './DeliveryForm'
import BackLink from '@/components/BackLink'
import { PackageSearch } from 'lucide-react'
import { parseDate } from '@/helper/parseDate'

interface DeliveryEditProps {
  id: number
}

export default function DeliveryEdit({ id }: DeliveryEditProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['delivery-detail', id],
    queryFn: () =>
      deliveriesService
        .findById(id, {
          include:
            'branch,target_branch,purchase_order,sales_order,' +
            'delivery_details,delivery_details.product_uom_batch',
        })
        .then((r) => r.data),
    enabled: !!id && !isNaN(id),
  })

  const delivery = (data as any)?.data

  const rawDetails =
    delivery?.delivery_details ?? delivery?.details ?? []

  const initialData = delivery
    ? {
      code: delivery.code,
      source_type: delivery.source_type ?? 'po_from_supplier',
      // The delivery's own source branch — where its stock/batches actually
      // are. Not a form field (DeliveryForm has no branch_id input), but
      // read directly off initialData so the batch query can use it instead
      // of the editing user's own branch.
      branch_id: delivery.branch?.id ?? delivery.branch_id ?? undefined,
      target_branch_id: delivery.target_branch?.id ?? delivery.target_branch_id ?? 0,
      purchase_order_id:
        delivery.purchase_order?.id ?? delivery.purchase_order_id ?? undefined,
      sales_order_id:
        delivery.sales_order?.id ?? delivery.sales_order_id ?? undefined,
      date: parseDate(delivery.date) ? parseDate(delivery.date.substring(0, 10)) : '',
      // Keep the stored status — a pending delivery stays pending on save.
      status: delivery.status === 'pending' ? 'pending' : 'final',
      description: delivery.description ?? '',
      source_owner_ref: delivery.source_owner_ref ?? 'GENERAL',
      source_stage: delivery.source_stage ?? 'GENERAL',
      source_location_ref: delivery.source_location_ref ?? 'GENERAL',
      details: rawDetails.length
        ? rawDetails.map((d: any) => ({
          id: d.id ?? undefined,
          product_uom_id:
            d.product_uom_id ?? d.product_uom?.id ?? 0,
          product_uom_batch_id:
            d.product_uom_batch_id ?? undefined,
          // The batch already committed to this line — not a form field,
          // but carried through so DeliveryForm can seed the batch
          // dropdown's options with it (mirrors the product-option seeding
          // fix, 5524569). Without this the dropdown only has live-stock
          // options and an already-shipped batch (now possibly out of
          // stock) has nothing to match its stored id against.
          product_uom_batch: d.product_uom_batch ?? undefined,
          purchase_order_detail_id:
            d.purchase_order_detail_id ?? undefined,
          sales_order_detail_id:
            d.sales_order_detail_id ?? undefined,
          qty: d.qty ?? 1,
          price: d.price ?? 0,
          status: d.status ?? 'pending',
          description: d.description ?? '',
        }))
        : [
          {
            product_uom_id: 0,
            purchase_order_detail_id: undefined,
            sales_order_detail_id: undefined,
            qty: 1,
            price: 0,
            status: 'pending',
            description: '',
          },
        ],
    }
    : undefined

  const containerStyle: React.CSSProperties = {
    padding: '28px 24px 48px',
    width: '100%',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  }

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div className="v2-skeleton" style={{ width: 80, height: 28, borderRadius: 6 }} />
        <div className="v2-skeleton" style={{ width: 240, height: 26, borderRadius: 6 }} />
        {[0, 1].map((i) => (
          <div key={i} className="v2-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <div className="v2-skeleton" style={{ width: 120, height: 14, borderRadius: 4 }} />
            </div>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px 20px' }}>
              {[0, 1, 2, 3].map((j) => (
                <div key={j} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="v2-skeleton" style={{ width: 90, height: 12, borderRadius: 4 }} />
                  <div className="v2-skeleton" style={{ width: '100%', height: 38, borderRadius: 8 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (isError || !delivery) {
    return (
      <div style={{ ...containerStyle, alignItems: 'center', padding: '80px 24px', textAlign: 'center' }}>
        <PackageSearch size={36} style={{ color: 'var(--foreground-subtle)' }} />
        <p style={{ fontSize: 13.5, color: 'var(--foreground-muted)', margin: 0 }}>
          Delivery not found
        </p>
        <BackLink href="/transfer/deliveries" label="Deliveries" style={{ alignSelf: 'center' }} />
      </div>
    )
  }

  return <DeliveryForm mode="edit" initialData={initialData} deliveryId={id} />
}
