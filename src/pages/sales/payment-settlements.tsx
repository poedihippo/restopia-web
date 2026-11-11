import dynamic from 'next/dynamic'

const PaymentSettlementsView = dynamic(() => import('@/views/PaymentSettlements'), { ssr: false })

export default function PaymentSettlementsPage() {
  return <PaymentSettlementsView />
}
