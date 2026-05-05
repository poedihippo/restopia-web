import dynamic from 'next/dynamic'

const StockPositionReport = dynamic(
  () => import('@/views/Reports/StockPosition'),
  { ssr: false },
)

export default function StockPositionPage() {
  return <StockPositionReport />
}
