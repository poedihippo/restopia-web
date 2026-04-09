import dynamic from 'next/dynamic'

const PaymentMethodsView = dynamic(() => import('@/views/PaymentMethods'), { ssr: false })

export default function PaymentMethodsPage() {
  return <PaymentMethodsView />
}
