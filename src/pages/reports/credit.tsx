import dynamic from 'next/dynamic'

const CreditReport = dynamic(() => import('@/views/Reports/CreditReport'), {
  ssr: false,
})

export default function CreditReportPage() {
  return <CreditReport />
}
