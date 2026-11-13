import dynamic from 'next/dynamic'

const OpeningBalancesView = dynamic(() => import('@/views/Accounting/OpeningBalances'), { ssr: false })

export default function OpeningBalancesPage() {
  return <OpeningBalancesView />
}
