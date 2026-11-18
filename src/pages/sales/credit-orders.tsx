import dynamic from 'next/dynamic'

const CreditOrdersView = dynamic(() => import('@/views/CreditOrders'), { ssr: false })

export default function CreditOrdersPage() {
  return <CreditOrdersView />
}
