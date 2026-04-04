import React from 'react'
import dynamic from 'next/dynamic'

const ProductionForm = dynamic(
  () => import('@/views/Productions/ProductionForm'),
  { ssr: false }
)

export default function ProductionCreatePage() {
  return <ProductionForm mode="create" />
}
