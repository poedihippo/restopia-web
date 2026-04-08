import dynamic from 'next/dynamic'

const SalesOrderDetail = dynamic(
  () => import('@/views/SalesOrders/SalesOrderDetail'),
  { ssr: false }
)

export default function SalesOrderDetailPage() {
  return <SalesOrderDetail />
}
