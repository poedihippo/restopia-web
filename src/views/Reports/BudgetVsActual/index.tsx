'use client'

import React, { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Target } from 'lucide-react'
import { reportsService, type BudgetVsActualResponse } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import { periodsService } from '@/services/accounting.service'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency } from '@/utils/price'
import { toInputDate } from '@/utils/date'
import FinanceBranchSelect, { financeBranchParam, useFinanceBranchLabel, type FinanceBranchScope } from '../FinanceBranchSelect'
import {
  FilterField,
  MessageRow,
  SkeletonRows,
  cents,
  filterInputStyle,
  numTd,
  pageStyle,
  subtitleStyle,
  titleStyle,
  totalRowStyle,
} from '../reportUi'

interface Period {
  id: number
  name: string
  start_date?: string
  end_date?: string
  is_active?: boolean
  is_closed?: boolean
}

/** Variance is signed by the API: positive = favourable (under budget on expense, over on revenue). */
const varianceColor = (v: number) => {
  const c = cents(v)
  return c > 0 ? 'var(--success)' : c < 0 ? 'var(--destructive)' : 'var(--foreground-muted)'
}

function Variance({ value, pct }: { value: number; pct?: number }) {
  const c = cents(value)
  return (
    <span style={{ color: varianceColor(value), fontWeight: 600 }}>
      {c > 0 ? '+' : ''}
      {formatCurrency(value)}
      {pct !== undefined && (
        <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500 }}>
          ({c > 0 ? '+' : ''}
          {Number(pct ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%)
        </span>
      )}
    </span>
  )
}

export default function BudgetVsActualView() {
  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = isSuperadmin || hasPermission('report.read')

  const [periodId, setPeriodId] = useState('')
  const [branchScope, setBranchScope] = useState<FinanceBranchScope>('')
  const branchLabel = useFinanceBranchLabel(branchScope)

  const { data: periodsData, isLoading: periodsLoading } = useQuery({
    queryKey: ['periods-all'],
    enabled: canRead,
    queryFn: () => periodsService.list({ per_page: 1000, sort: '-id' } as any).then((r) => r.data),
  })
  const periods: Period[] = (periodsData as any)?.data ?? []

  // Default to the period containing today (falls back to the active one).
  useEffect(() => {
    if (periodId || periods.length === 0) return
    const now = new Date()
    const t = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const current = periods.find((p) => {
      const s = toInputDate(p.start_date)
      const e = toInputDate(p.end_date)
      return !!s && !!e && s <= t && t <= e
    })
    const active = periods.find((p) => p.is_active && !p.is_closed)
    setPeriodId(String(current?.id ?? active?.id ?? periods[0].id))
  }, [periods, periodId])

  const params = { period_id: Number(periodId), ...financeBranchParam(branchScope) }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['budget-vs-actual', periodId, branchScope],
    enabled: canRead && !!periodId,
    queryFn: () => reportsService.getBudgetVsActual(params).then((r) => r.data),
  })
  const report: BudgetVsActualResponse | undefined = data?.data
  const lines = report?.lines ?? []
  const totalPct = report && cents(report.total_budget) !== 0 ? (report.total_variance / report.total_budget) * 100 : undefined

  const { mutate: exportExcel, isPending } = useMutation({
    mutationFn: () => reportsService.exportBudgetVsActual(params),
    onSuccess: (res) => {
      const slug = (report?.period_name ?? `period-${periodId}`).replace(/\s+/g, '-').toLowerCase()
      downloadFileFromResponse(res, `budget-vs-actual-${slug}.xlsx`)
    },
    onError: () => toast.error('Gagal mengekspor data.'),
  })

  const COLS = 5

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={titleStyle}>Budget vs Actual</h1>
          <p style={subtitleStyle}>
            {report ? `${report.period_name} · ${branchLabel}` : 'Budgeted vs posted amounts per account for a period'}
          </p>
        </div>
        <button
          type="button"
          className="v2-btn v2-btn-outline"
          onClick={() => exportExcel()}
          disabled={!canRead || !periodId || isPending}
          title={!periodId ? 'Select a period first' : undefined}
        >
          <Download size={14} /> {isPending ? 'Exporting...' : 'Export Excel'}
        </button>
      </div>

      {!canRead ? (
        <div className="v2-card" style={{ padding: 20, color: 'var(--warning)', background: 'var(--warning-bg)', fontSize: 13 }}>
          You do not have permission to view this report.
        </div>
      ) : (
        <>
          <div className="v2-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <FilterField label="Period *">
                <select
                  value={periodId}
                  disabled={periodsLoading}
                  onChange={(e) => setPeriodId(e.target.value)}
                  style={{ ...filterInputStyle, minWidth: 240, cursor: 'pointer' }}
                >
                  <option value="" disabled>
                    {periodsLoading ? 'Loading periods...' : '-- Select Period --'}
                  </option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.is_closed ? ' (Closed)' : p.is_active ? ' (Active)' : ''}
                    </option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Branch">
                <FinanceBranchSelect value={branchScope} onChange={setBranchScope} style={filterInputStyle} />
              </FilterField>
            </div>
            <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '12px 0 0' }}>
              Variance: <span style={{ color: 'var(--success)', fontWeight: 600 }}>positive = favourable</span> (spent under
              budget on expense, earned over budget on revenue);{' '}
              <span style={{ color: 'var(--destructive)', fontWeight: 600 }}>negative = unfavourable</span>.
            </p>
          </div>

          <div className="v2-card" style={{ overflow: 'hidden' }}>
            <table className="v2-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account</th>
                  <th style={{ textAlign: 'right' }}>Budget</th>
                  <th style={{ textAlign: 'right' }}>Actual</th>
                  <th style={{ textAlign: 'right' }}>Variance</th>
                </tr>
              </thead>
              <tbody>
                {!periodId ? (
                  <MessageRow cols={COLS} icon={<Target size={22} />}>Select a period to generate the report</MessageRow>
                ) : isLoading ? (
                  <SkeletonRows cols={COLS} />
                ) : isError ? (
                  <MessageRow cols={COLS} tone="error">
                    {(error as any)?.response?.data?.message ?? 'Failed to load budget vs actual'}
                  </MessageRow>
                ) : lines.length === 0 ? (
                  <MessageRow cols={COLS} icon={<Target size={22} />}>No budgets set for this period</MessageRow>
                ) : (
                  lines.map((ln, i) => (
                    <tr key={`${ln.code}-${i}`} data-row>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{ln.code || '—'}</td>
                      <td>{ln.name || '—'}</td>
                      <td style={numTd}>{formatCurrency(ln.budget)}</td>
                      <td style={numTd}>{formatCurrency(ln.actual)}</td>
                      <td style={numTd}>
                        <Variance value={ln.variance} pct={ln.variance_pct} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {periodId && !isLoading && !isError && report && lines.length > 0 && (
                <tfoot>
                  <tr style={totalRowStyle}>
                    <td colSpan={2} style={{ padding: '10px 12px', fontSize: 12.5 }}>Total</td>
                    <td style={{ ...numTd, padding: '10px 12px', fontSize: 12.5 }}>{formatCurrency(report.total_budget)}</td>
                    <td style={{ ...numTd, padding: '10px 12px', fontSize: 12.5 }}>{formatCurrency(report.total_actual)}</td>
                    <td style={{ ...numTd, padding: '10px 12px', fontSize: 12.5 }}>
                      <Variance value={report.total_variance} pct={totalPct} />
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  )
}
