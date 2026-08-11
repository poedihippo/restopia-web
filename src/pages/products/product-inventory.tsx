import React from 'react'
import { useRouter } from 'next/router'
import ProductInventoriesView from '@/views/ProductInventories'

export default function ProductInventoryPage() {
  const router = useRouter()
  const defaultType = typeof router.query.type === 'string' ? router.query.type : undefined
  return <ProductInventoriesView defaultType={defaultType} />
}
