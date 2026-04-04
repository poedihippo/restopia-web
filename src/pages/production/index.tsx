import React from 'react'
import dynamic from 'next/dynamic'

const ProductionsView = dynamic(
  () => import('@/views/Productions'),
  { ssr: false }
)

export default function ProductionPage() {
  return <ProductionsView />
}
