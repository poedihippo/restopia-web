import dynamic from 'next/dynamic'

const SalesChannelsView = dynamic(() => import('@/views/SalesChannels'), { ssr: false })

export default function SalesChannelsPage() {
  return <SalesChannelsView />
}
