import api from '@/hooks/useApi'

/** Override akun COA per cabang untuk satu payment method. */
export interface PaymentMethodBranchAccount {
  branch_id: number
  branch_code?: string
  branch_name?: string
  chart_of_account_id: number
  chart_of_account_code?: string
  chart_of_account_name?: string
}

export const paymentMethodsService = {
  list: (params?: any) =>
    api.get('/payment-methods', { params }),
  findById: (id: number, params?: any) =>
    api.get(`/payment-methods/${id}`, { params }),
  create: (data: any) =>
    api.post('/payment-methods', data),
  update: (id: number, data: any) =>
    api.patch(`/payment-methods/${id}`, data),
  delete: (id: number) =>
    api.delete(`/payment-methods/${id}`),
  listBranchAccounts: (id: number) =>
    api.get(`/payment-methods/${id}/branch-accounts`),
  // Full replace — kirim seluruh daftar; [] menghapus semua override.
  replaceBranchAccounts: (
    id: number,
    accounts: { branch_id: number; chart_of_account_id: number }[],
  ) =>
    api.put(`/payment-methods/${id}/branch-accounts`, { accounts }),
}
