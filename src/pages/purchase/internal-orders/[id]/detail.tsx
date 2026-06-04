import React from 'react'
import { useRouter } from 'next/router'
import InternalOrderDetail from '@/views/InternalOrders/InternalOrderDetail'

export default function InternalOrderDetailPage() {
  const router = useRouter()
  const id = Number(router.query.id)
  return <InternalOrderDetail id={id} />
}
