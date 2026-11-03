import dynamic from 'next/dynamic'

const SettlePayoutView = dynamic(() => import('@/views/SettlePayout'), { ssr: false })

export default function SettlePayoutPage() {
  return <SettlePayoutView />
}
