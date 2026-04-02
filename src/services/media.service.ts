import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export const mediaService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<unknown>>>('/media', { params }),

  upload: (formData: FormData) =>
    api.post<ApiResponse<unknown>>('/media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/media/${id}`),
}
