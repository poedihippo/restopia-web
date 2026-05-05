'use client'

import React from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import PurchaseOrderForm from './PurchaseOrderForm'
import { PackageSearch } from 'lucide-react'

interface PurchaseOrderEditProps {
  id: number
}

export default function PurchaseOrderEdit({ id }: PurchaseOrderEditProps) {
  const router = useRouter()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['purchase-order-detail', id],
    queryFn: () =>
      purchaseOrdersService
        .findById(id, {
          include: 'branch,supplier,created_by,updated_by,purchase_order_details',
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
        branch_id: order.branch?.id ?? order.branch_id ?? 0,
        date: order.date,
        status: order.status,
        description: order.description ?? '',
        details: rawDetails.length
          ? rawDetails.map((d: any) => ({
              product_uom_id:
                d.product_uom_id ?? d.product_uom?.id ?? 0,
              qty: d.qty ?? 1,
              price: d.price ?? 0,
              description: d.description ?? '',
            }))
          : [{ product_uom_id: 0, qty: 1, price: 0, description: '' }],
      }
    : undefined

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 99,
              border: '3px solid var(--border)',
              borderTop: '3px solid var(--accent)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)', marginTop: 12 }}>
            Loading order...
          </span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div
        style={{
          padding: 80,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <PackageSearch size={40} style={{ color: 'var(--foreground-subtle)' }} />
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: 0 }}>
          Purchase order not found
        </p>
        <button
          onClick={() => router.back()}
          style={{
            padding: '7px 14px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: 'var(--foreground-muted)',
            cursor: 'pointer',
          }}
        >
          Go back
        </button>
      </div>
    )
  }

  return <PurchaseOrderForm mode="edit" initialData={initialData} orderId={id} />
}
