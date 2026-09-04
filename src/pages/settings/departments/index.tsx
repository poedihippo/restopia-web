import dynamic from 'next/dynamic'

const DepartmentsView = dynamic(() => import('@/views/Settings/Departments'), { ssr: false })

export default function DepartmentsPage() {
  return <DepartmentsView />
}
