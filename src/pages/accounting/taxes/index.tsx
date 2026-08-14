import dynamic from 'next/dynamic'

const TaxesView = dynamic(() => import('@/views/Taxes'), { ssr: false })

export default function TaxesPage() {
  return <TaxesView />
}
