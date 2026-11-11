import dynamic from 'next/dynamic'

const CompanySettingsView = dynamic(() => import('@/views/CompanySettings'), { ssr: false })

export default function CompanySettingsPage() {
  return <CompanySettingsView />
}
