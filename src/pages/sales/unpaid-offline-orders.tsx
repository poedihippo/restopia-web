import dynamic from 'next/dynamic'

const UnpaidOfflineOrdersView = dynamic(() => import('@/views/UnpaidOfflineOrders'), { ssr: false })

export default function UnpaidOfflineOrdersPage() {
  return <UnpaidOfflineOrdersView />
}
