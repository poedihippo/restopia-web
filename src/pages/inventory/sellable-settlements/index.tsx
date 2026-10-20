import React from 'react'
import dynamic from 'next/dynamic'

const SellableSettlementsView = dynamic(() => import('@/views/SellableSettlements'), {
  ssr: false,
})

export default function SellableSettlementsPage() {
  return <SellableSettlementsView />
}
