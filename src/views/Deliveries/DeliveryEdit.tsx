'use client'

import React from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { deliveriesService } from '@/services/deliveries.service'
import DeliveryForm from './DeliveryForm'
import { PackageSearch } from 'lucide-react'

interface DeliveryEditProps {
  id: number
}

export default function DeliveryEdit({ id }: DeliveryEditProps) {
  const router = useRouter()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['delivery-detail', id],
    queryFn: () =>
      deliveriesService
        .findById(id, {
          include: 'branch,target_branch,purchase_order,delivery_details',
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
        target_branch_id: delivery.target_branch?.id ?? delivery.target_branch_id ?? 0,
        purchase_order_id:
          delivery.purchase_order?.id ?? delivery.purchase_order_id ?? undefined,
        date: delivery.date,
        status: delivery.status,
        description: delivery.description ?? '',
        details: rawDetails.length
          ? rawDetails.map((d: any) => ({
              product_inventory_id:
                d.product_inventory?.id ?? d.product_inventory_id ?? 0,
              purchase_order_detail_id:
                d.purchase_order_detail?.id ?? d.purchase_order_detail_id ?? undefined,
              qty: d.qty,
              price: d.price,
              status: d.status,
              description: d.description ?? '',
            }))
          : [
              {
                product_inventory_id: 0,
                purchase_order_detail_id: undefined,
                qty: 1,
                price: 0,
                status: 'pending',
                description: '',
              },
            ],
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
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
            Loading delivery...
          </span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (isError || !delivery) {
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
          Delivery not found
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

  return <DeliveryForm mode="edit" initialData={initialData} deliveryId={id} />
}
