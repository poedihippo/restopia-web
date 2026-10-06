import React from 'react'
import dynamic from 'next/dynamic'

const ConversionForm = dynamic(
  () => import('@/views/Conversions/ConversionForm'),
  { ssr: false },
)

export default function ConversionPage() {
  return <ConversionForm />
}
