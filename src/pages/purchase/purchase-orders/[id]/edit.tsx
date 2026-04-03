import React from 'react'
import { useRouter } from 'next/router'
import PurchaseOrderEdit from '@/views/PurchaseOrders/PurchaseOrderEdit'

export default function PurchaseOrderEditPage() {
  const router = useRouter()
  const id = Number(router.query.id)
  return <PurchaseOrderEdit id={id} />
}
