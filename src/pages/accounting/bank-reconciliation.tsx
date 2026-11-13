import dynamic from 'next/dynamic'

const BankReconciliationView = dynamic(() => import('@/views/Accounting/BankReconciliation'), { ssr: false })

export default function BankReconciliationPage() {
  return <BankReconciliationView />
}
