import { useMutation, useQueryClient } from '@tanstack/react-query'
import { salesChannelsService } from '@/services/sales-channels.service'

export default function useSalesChannelDeleteMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => salesChannelsService.delete(id).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-channels'] })
    },
  })
}
