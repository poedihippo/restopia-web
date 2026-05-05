import dynamic from 'next/dynamic'

const DiscountVoucherReport = dynamic(
  () => import('@/views/Reports/DiscountVoucher'),
  { ssr: false },
)

export default function DiscountVoucherPage() {
  return <DiscountVoucherReport />
}
