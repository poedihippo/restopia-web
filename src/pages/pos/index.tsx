import dynamic from 'next/dynamic'

const PosView = dynamic(() => import('@/views/Pos'), { ssr: false })

export default function PosPage() {
  return <PosView />
}
