import dynamic from 'next/dynamic'

const SalesOrderForm = dynamic(() => import('@/views/SalesOrders/SalesOrderForm'), { ssr: false })

export default function SalesOrderCreatePage() {
  return <SalesOrderForm />
}
