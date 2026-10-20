import React from 'react'
import { useRouter } from 'next/router'
import SellableSettlementDetail from '@/views/SellableSettlements/SellableSettlementDetail'

export default function SellableSettlementDetailPage() {
  const router = useRouter()
  const id = Number(router.query.id)
  return <SellableSettlementDetail id={id} />
}
