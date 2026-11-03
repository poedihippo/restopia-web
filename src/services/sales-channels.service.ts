import api from '@/hooks/useApi'

/** Receivable / fee COA per branch for an ONLINE sales channel. */
export interface SalesChannelBranchAccount {
  branch_id: number
  branch_code?: string
  branch_name?: string
  receivable_chart_of_account_id: number | null
  receivable_chart_of_account_code?: string | null
  receivable_chart_of_account_name?: string | null
  fee_chart_of_account_id: number | null
  fee_chart_of_account_code?: string | null
  fee_chart_of_account_name?: string | null
}

export const salesChannelsService = {
  list: (params?: any) =>
    api.get('/sales-channels', { params }),
  findById: (id: string, params?: any) =>
    api.get(`/sales-channels/${id}`, { params }),
  create: (data: any) =>
    api.post('/sales-channels', data),
  update: (id: string, data: any) =>
    api.patch(`/sales-channels/${id}`, data),
  delete: (id: string) =>
    api.delete(`/sales-channels/${id}`),
  listBranchAccounts: (id: number) =>
    api.get(`/sales-channels/${id}/branch-accounts`),
  // Full replace — [] clears every row. Pickup points may only set a fee account.
  replaceBranchAccounts: (
    id: number,
    accounts: {
      branch_id: number
      receivable_chart_of_account_id?: number
      fee_chart_of_account_id?: number
    }[],
  ) =>
    api.put(`/sales-channels/${id}/branch-accounts`, { accounts }),
}
