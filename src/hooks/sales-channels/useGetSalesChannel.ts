import { useQuery } from '@tanstack/react-query'
import { salesChannelsService } from '@/services/sales-channels.service'

export default function useGetSalesChannel(id: string, params?: any) {
  return useQuery({
    queryKey: ['sales-channels', id, params],
    queryFn: () => salesChannelsService.findById(id, params).then(res => res.data),
    enabled: !!id,
  })
}
