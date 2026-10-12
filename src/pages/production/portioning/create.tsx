import React from 'react'
import dynamic from 'next/dynamic'

const PortioningForm = dynamic(
  () => import('@/views/Portionings/PortioningForm'),
  { ssr: false }
)

export default function PortioningCreatePage() {
  return <PortioningForm />
}
