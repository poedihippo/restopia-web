import dynamic from 'next/dynamic'

const SalesOrdersView = dynamic(() => import('@/views/SalesOrders'), { ssr: false })

export default function SalesOrdersPage() {
  return <SalesOrdersView />
}
