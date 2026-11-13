import api from '@/hooks/useApi'
import type { ApiResponse } from '@/types/api'

export type AccountingTaskGroup = 'setup' | 'daily' | 'month_end' | 'year_end' | 'ar_ap'
export type AccountingTaskSeverity = 'critical' | 'warning' | 'info' | 'done'

export interface AccountingTask {
  key: string
  group: AccountingTaskGroup
  severity: AccountingTaskSeverity
  count: number
  amount: number | null
  oldest_date: string | null
}

export interface AccountingPeriodInfo {
  id: number
  name: string
  start_date: string
  end_date: string
  is_closed: boolean
}

export interface AccountingTasksResponse {
  generated_at: string
  kpis: {
    cash_bank_balance: number
    receivables_open: number
    payables_open: number
    current_period: AccountingPeriodInfo | null
  }
  tasks: AccountingTask[]
}

export const accountingDashboardService = {
  tasks: () => api.get<ApiResponse<AccountingTasksResponse>>('/dashboard/accounting-tasks'),
}
