import React from 'react'
import { useRouter } from 'next/router'
import InternalOrderEdit from '@/views/InternalOrders/InternalOrderEdit'

export default function InternalOrderEditPage() {
  const router = useRouter()
  const id = Number(router.query.id)
  return <InternalOrderEdit id={id} />
}
