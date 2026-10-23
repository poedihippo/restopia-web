import React from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'

const PortioningForm = dynamic(
  () => import('@/views/Portionings/PortioningForm'),
  { ssr: false }
)

export default function PortioningEditPage() {
  const router = useRouter()
  // Wait for the dynamic route param so the form never flashes create mode.
  if (!router.isReady) return null
  const editId = router.query.id ? Number(router.query.id) : undefined
  return <PortioningForm editId={editId} />
}
