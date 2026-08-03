import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams, PriceList, PriceListRequest, PriceListItem, BulkUpsertPriceListItemRequest } from '@/types/api'

export const priceListsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<PriceList>>>('/price-lists', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<PriceList>>(`/price-lists/${id}`, { params }),

  create: (data: PriceListRequest) =>
    api.post<ApiResponse<PriceList>>('/price-lists', data),

  update: (id: number, data: PriceListRequest) =>
    api.patch<ApiResponse<PriceList>>(`/price-lists/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/price-lists/${id}`),

  // Price List Items
  listItems: (priceListId: number, params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<PriceListItem>>>(`/price-lists/${priceListId}/items`, { params }),

  bulkUpsertItems: (priceListId: number, data: BulkUpsertPriceListItemRequest) =>
    api.put<ApiResponse<unknown>>(`/price-lists/${priceListId}/items/bulk`, data),

  deleteItem: (priceListId: number, itemId: number) =>
    api.delete<ApiResponse<unknown>>(`/price-lists/${priceListId}/items/${itemId}`),
}
