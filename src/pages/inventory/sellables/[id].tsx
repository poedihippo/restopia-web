import React from 'react'
import { useRouter } from 'next/router'
import SellableDetail from '@/views/Sellables/SellableDetail'

export default function SellableDetailPage() {
  const router = useRouter()
  const id = Number(router.query.id)
  return <SellableDetail id={id} />
}
