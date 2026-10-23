import React from 'react'
import dynamic from 'next/dynamic'

const SellablesView = dynamic(() => import('@/views/Sellables'), {
  ssr: false,
})

export default function SellablesPage() {
  return <SellablesView />
}
