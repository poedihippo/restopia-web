import { useMutation, useQueryClient } from '@tanstack/react-query'
import { salesChannelsService } from '@/services/sales-channels.service'

export default function useSalesChannelMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => salesChannelsService.create(data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-channels'] })
    },
  })
}
