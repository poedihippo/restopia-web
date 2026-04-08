import dynamic from 'next/dynamic'

const CustomersView = dynamic(() => import('@/views/Customers'), { ssr: false })

export default function CustomersPage() {
  return <CustomersView />
}
