import React from 'react'
import { useRouter } from 'next/router'
import PurchaseOrderDetail from '@/views/PurchaseOrders/PurchaseOrderDetail'

export default function PurchaseOrderDetailPage() {
  const router = useRouter()
  const id = Number(router.query.id)
  return <PurchaseOrderDetail id={id} />
}
