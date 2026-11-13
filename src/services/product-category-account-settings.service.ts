import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export interface ProductCategoryAccountSettingRequest {
  branch_id: number
  product_category_id: number
  chart_of_account_id: number
  description?: string
}

export interface ProductCategoryAccountSettingUpdateRequest {
  branch_id?: number
  product_category_id?: number
  chart_of_account_id?: number
  description?: string
}

export const productCategoryAccountSettingsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<any>>>('/product-category-account-settings', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<any>>(`/product-category-account-settings/${id}`, { params }),

  create: (data: ProductCategoryAccountSettingRequest) =>
    api.post<ApiResponse<any>>('/product-category-account-settings', data),

  update: (id: number, data: ProductCategoryAccountSettingUpdateRequest) =>
    api.patch<ApiResponse<any>>(`/product-category-account-settings/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<any>>(`/product-category-account-settings/${id}`),
}
