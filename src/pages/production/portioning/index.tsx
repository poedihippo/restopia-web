import React from 'react'
import dynamic from 'next/dynamic'

const PortioningsView = dynamic(
  () => import('@/views/Portionings'),
  { ssr: false }
)

export default function PortioningListPage() {
  return <PortioningsView />
}
