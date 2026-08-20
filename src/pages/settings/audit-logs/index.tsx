import dynamic from 'next/dynamic'

const AuditLogsView = dynamic(() => import('@/views/AuditLogs'), { ssr: false })

export default function AuditLogsPage() {
  return <AuditLogsView />
}
