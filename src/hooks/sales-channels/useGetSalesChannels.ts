import { useQuery } from '@tanstack/react-query'
import { salesChannelsService } from '@/services/sales-channels.service'
import { ListParams } from '@/types/api'

export default function useGetSalesChannels(params?: ListParams) {
  return useQuery({
    queryKey: ['sales-channels', params],
    queryFn: () => salesChannelsService.list(params).then(res => res.data),
  })
}
