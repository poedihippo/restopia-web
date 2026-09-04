import api from '@/hooks/useApi'
import type { ApiResponse, PaginatedData, ListParams } from '@/types/api'

export interface Department {
  id: number
  company_id: number
  parent_id?: number | null
  code: string
  name: string
  description?: string
  is_active: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
  parent?: Department
  children?: Department[]
  created_by?: { id: number; name: string; email?: string }
  updated_by?: { id: number; name: string; email?: string }
}

export interface DepartmentRequest {
  company_id?: number
  parent_id?: number | null
  code: string
  name: string
  description?: string
  is_active?: boolean
  sort_order?: number
}

export const departmentsService = {
  list: (params?: ListParams) =>
    api.get<ApiResponse<PaginatedData<Department>>>('/departments', { params }),

  findById: (id: number, params?: { include?: string }) =>
    api.get<ApiResponse<Department>>(`/departments/${id}`, { params }),

  create: (data: DepartmentRequest) =>
    api.post<ApiResponse<Department>>('/departments', data),

  update: (id: number, data: Partial<DepartmentRequest>) =>
    api.patch<ApiResponse<Department>>(`/departments/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<unknown>>(`/departments/${id}`),
}
