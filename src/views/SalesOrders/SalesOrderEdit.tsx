'use client'

import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import salesOrderService from '@/services/sales-order.service'
import SalesOrderForm from './SalesOrderForm'

export default function SalesOrderEdit() {
  const router = useRouter()
  const id = Number(router.query.id)

  const { data, isLoading } = useQuery({
    queryKey: ['sales-order', id],
    enabled: router.isReady && Number.isFinite(id) && id > 0,
    queryFn: () =>
      salesOrderService
        .findById(id, {
          include:
            'customer,sales_order_details,sales_order_details.product_inventory,sales_order_details.bundle',
        })
        .then((r) => r.data),
  })

  const order = (data as any)?.data

  if (!router.isReady || isLoading) {
    return (
      <div
        style={{
          padding: '32px 40px',
          fontFamily: 'var(--font-sans)',
          color: 'var(--foreground-muted)',
        }}
      >
        Loading order...
      </div>
    )
  }

  if (!order) {
    return (
      <div
        style={{
          padding: '32px 40px',
          fontFamily: 'var(--font-sans)',
          color: 'var(--foreground-muted)',
        }}
      >
        Order not found.
      </div>
    )
  }

  return <SalesOrderForm editingOrder={order} />
}
