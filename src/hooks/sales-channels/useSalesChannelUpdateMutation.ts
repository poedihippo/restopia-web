import { useMutation, useQueryClient } from '@tanstack/react-query'
import { salesChannelsService } from '@/services/sales-channels.service'

export default function useSalesChannelUpdateMutation(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => salesChannelsService.update(id, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-channels'] })
    },
  })
}
