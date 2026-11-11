'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import PurchaseOrderForm from './PurchaseOrderForm'
import { PackageSearch } from 'lucide-react'
import BackLink from '@/components/BackLink'
import { parseDate } from '@/helper/parseDate'

interface PurchaseOrderEditProps {
  id: number
}

export default function PurchaseOrderEdit({ id }: PurchaseOrderEditProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['purchase-order-detail', id],
    queryFn: () =>
      purchaseOrdersService
        .findById(id, {
          include:
            'branch,supplier,supplier_branch,buyer,created_by,updated_by,' +
            'purchase_order_details,additional_charges'
        })
        .then((r) => r.data),
    enabled: !!id && !isNaN(id),
  })

  const order = (data as any)?.data

  const rawDetails =
    order?.purchase_order_details ?? order?.details ?? []

  const initialData = order
    ? {
      code: order.code,
      supplier_id: order.supplier?.id ?? order.supplier_id ?? 0,
      supplier_branch_id:
        order.supplier_branch?.id ?? order.supplier_branch_id ?? undefined,
      supplier_branch: order.supplier_branch ?? undefined,
      buyer_id: order.buyer?.id ?? order.buyer_id ?? 0,
      buyer: order.buyer ?? undefined,
      branch_id: order.branch?.id ?? order.branch_id ?? 0,
      date: parseDate(order.date),
      fulfillment_date: order.fulfillment_date ? parseDate(order.fulfillment_date) : undefined,
      type: order.type ?? '',
      status: order.status,
      description: order.description ?? '',
      tax_id: order.tax_id ?? undefined,
      details: rawDetails.length
        ? rawDetails.map((d: any) => ({
          id: d.id ?? undefined,
          product_uom_id:
            d.product_uom_id ?? d.product_uom?.id ?? 0,
          qty: d.qty ?? 1,
          price: d.price || d.product_uom?.base_price || 0,
          description: d.description ?? '',
          is_taxable: Boolean(d.is_taxable),
          discount_type: d.discount_type || undefined,
          discount_value: d.discount_value ?? undefined,
          // Delivered/received so far — locks the row's qty in the form.
          delivered_qty: Math.max(Number(d.delivered_qty ?? 0), Number(d.received_qty ?? 0)),
        }))
        : [{ product_uom_id: 0, qty: 1, price: 0, description: '' }],
      additional_charges: (order.additional_charges ?? []).map((c: any) => ({
        name: c.name ?? '',
        chart_of_account_id: Number(c.chart_of_account_id ?? 0),
        amount: Number(c.amount ?? 0),
        description: c.description ?? '',
      })),
    }
    : undefined

  if (isLoading) {
    return (
      <div
        style={{
          padding: '28px 24px 48px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div className="v2-skeleton" style={{ width: 72, height: 28 }} />
        <div className="v2-skeleton" style={{ width: 240, height: 24 }} />
        <div className="v2-skeleton" style={{ width: 320, height: 14 }} />
        {[0, 1].map((card) => (
          <div key={card} className="v2-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <div className="v2-skeleton" style={{ width: 110, height: 14 }} />
            </div>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px 20px' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="v2-skeleton" style={{ width: '35%', height: 12 }} />
                  <div className="v2-skeleton" style={{ width: '100%', height: 38 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div
        style={{
          padding: '80px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <PackageSearch size={36} style={{ color: 'var(--foreground-subtle)' }} />
        <p style={{ fontSize: 13.5, color: 'var(--foreground-muted)', margin: 0 }}>
          Purchase order not found
        </p>
        <BackLink href="/purchase/purchase-orders" label="Purchase Orders" style={{ alignSelf: 'center', marginTop: 4 }} />
      </div>
    )
  }

  return <PurchaseOrderForm mode="edit" initialData={initialData} orderId={id} />
}
