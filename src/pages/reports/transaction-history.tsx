import dynamic from 'next/dynamic'

const TransactionHistoryReport = dynamic(
  () => import('@/views/Reports/TransactionHistory'),
  { ssr: false },
)

export default function TransactionHistoryPage() {
  return <TransactionHistoryReport />
}
