import api from '@/hooks/useApi'

/** Known CompanySettingKey values (GET /v1/enums → "CompanySettingKey"). */
export const COMPANY_SETTING_KEYS = ['invoice_cross_company_handling_fee_percent'] as const

export interface CompanySetting {
  id: number
  company_id: number
  key: string
  value: string
  description?: string | null
  created_at?: string
  updated_at?: string
  created_by_id?: number | null
  updated_by_id?: number | null
  created_by?: { id: number; name?: string } | null
  updated_by?: { id: number; name?: string } | null
  company?: { id: number; name?: string } | null
}

export interface CreateCompanySettingRequest {
  key: string
  value: string
  description?: string | null
}

export interface UpdateCompanySettingRequest {
  value?: string
  description?: string | null
}

// Scoped to the caller's active company — company_id comes from the token.
export const companySettingsService = {
  list: (params?: any) =>
    api.get('/company-settings', { params }),
  findById: (id: number, params?: any) =>
    api.get(`/company-settings/${id}`, { params }),
  create: (data: CreateCompanySettingRequest) =>
    api.post('/company-settings', data),
  update: (id: number, data: UpdateCompanySettingRequest) =>
    api.patch(`/company-settings/${id}`, data),
  delete: (id: number) =>
    api.delete(`/company-settings/${id}`),
}
