'use client'

import React, { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { reportsService } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import { toast } from 'sonner'
import api from '@/hooks/useApi'
import { periodsService } from '@/services/accounting.service'
import { useAuth } from '@/hooks/useAuth'
import { FileSpreadsheet, Scale, AlertCircle, CheckCircle2, Download } from 'lucide-react'

interface Period {
  id: number
  name: string
  is_active?: boolean
}

interface AccountBalance {
  chart_of_account_id: number
  code: string
  name: string
  normal_balance: 'debit' | 'credit' | string
  total_debit: number
  total_credit: number
  balance: number
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: 24,
}

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
  fontSize: 13,
}

const rp = (n: number | string | null | undefined) =>
  `Rp ${Number(n ?? 0).toLocaleString('id-ID')}`

export default function TrialBalanceView() {
  const { hasPermission } = useAuth()
  const canRead = hasPermission('journal.read')

  const [periodId, setPeriodId] = useState<number>(0)

  const { data: periodsData, isLoading: periodsLoading } = useQuery({
    queryKey: ['periods-all'],
    enabled: canRead,
    queryFn: () => periodsService.list({ per_page: 999, sort: '-id' } as any).then((r) => r.data),
  })
  const periods: Period[] = (periodsData as any)?.data ?? []

  useEffect(() => {
    if (periodId || periods.length === 0) return
    const active = periods.find((p) => p.is_active)
    setPeriodId(active?.id ?? periods[0].id)
  }, [periods, periodId])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['trial-balance', periodId],
    enabled: canRead && !!periodId,
    // Real contract confirmed read-only: GET /journals/trial-balance/:period_id
    // (NOT /reports/trial-balance with start_date/end_date — that endpoint doesn't exist).
    queryFn: () => api.get(`/journals/trial-balance/${periodId}`).then((r) => r.data),
  })

  const trialBalance = (data as any)?.data
  const rows: AccountBalance[] = trialBalance?.account_balances ?? []
  const totalDebit = Number(trialBalance?.total_debit ?? 0)
  const totalCredit = Number(trialBalance?.total_credit ?? 0)
  const isBalanced = totalDebit === totalCredit

  const selectedPeriod = periods.find((p) => p.id === periodId)

  const { mutate: exportExcel, isPending: isExporting } = useMutation({
    mutationFn: () => reportsService.exportTrialBalance({ period_id: periodId }),
    onSuccess: (res) => {
      const periodSlug = (selectedPeriod?.name ?? `period-${periodId}`).replace(/\s+/g, '-').toLowerCase()
      downloadFileFromResponse(res, `trial-balance-${periodSlug}.xlsx`)
    },
    onError: () => {
      toast.error('Gagal mengekspor data.')
    }
  })

  const handleExport = () => {
    exportExcel()
  }

  const canExport = rows.length > 0

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 500,
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            Trial Balance
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            All chart-of-accounts debit/credit balances for a period (posted journals only)
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={!canExport || isExporting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            fontWeight: 500,
            color: (canExport && !isExporting) ? 'var(--foreground)' : 'var(--foreground-subtle)',
            cursor: (canExport && !isExporting) ? 'pointer' : 'not-allowed',
            opacity: (canExport && !isExporting) ? 1 : 0.6,
          }}
        >
          <Download size={14} />
          {isExporting ? 'Exporting...' : 'Export Excel'}
        </button>
      </div>

      {!canRead ? (
        <div style={{ ...sectionStyle, color: 'var(--warning)', background: 'var(--warning-bg)', borderColor: 'var(--warning)', fontSize: 13 }}>
          You do not have permission to view the trial balance.
        </div>
      ) : (
        <>
          {/* Period filter */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 320 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Period</label>
              <select
                value={periodId}
                disabled={periodsLoading}
                onChange={(e) => setPeriodId(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 14,
                  color: 'var(--foreground)',
                  background: 'var(--surface)',
                  outline: 'none',
                  fontFamily: 'var(--font-sans)',
                  cursor: periodsLoading ? 'not-allowed' : 'pointer',
                }}
              >
                <option value={0} disabled>
                  {periodsLoading ? 'Loading periods...' : '-- Select Period --'}
                </option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.is_active ? ' (Active)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSpreadsheet size={16} color="var(--accent)" />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Account Balances</span>
              </div>
              {!isLoading && !isError && rows.length > 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 10px',
                    borderRadius: 99,
                    fontSize: 11,
                    fontWeight: 600,
                    background: isBalanced ? 'var(--success-bg)' : 'var(--warning-bg)',
                    color: isBalanced ? 'var(--success)' : 'var(--warning)',
                  }}
                >
                  {isBalanced ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                  {isBalanced ? 'Balanced' : 'Not Balanced'}
                </span>
              )}
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--background)' }}>
                    <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
                    <th style={thStyle}>Account Code</th>
                    <th style={thStyle}>Account Name</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Debit</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Credit</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)' }}>
                        Loading...
                      </td>
                    </tr>
                  ) : isError ? (
                    <tr>
                      <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--destructive)' }}>
                        Failed to load trial balance
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)' }}>
                        No account balances for this period
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => (
                      <tr key={row.chart_of_account_id}>
                        <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{row.code}</td>
                        <td style={tdStyle}>{row.name}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {Number(row.total_debit) > 0 ? rp(row.total_debit) : ''}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {Number(row.total_credit) > 0 ? rp(row.total_credit) : ''}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {rp(row.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {!isLoading && !isError && rows.length > 0 && (
                  <tfoot>
                    <tr style={{ background: 'var(--background)' }}>
                      <td colSpan={2} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Scale size={13} />
                          Total
                        </div>
                      </td>
                      <td
                        style={{
                          padding: '10px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                          color: isBalanced ? 'var(--foreground)' : 'var(--warning)',
                        }}
                      >
                        {rp(totalDebit)}
                      </td>
                      <td
                        style={{
                          padding: '10px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                          color: isBalanced ? 'var(--foreground)' : 'var(--warning)',
                        }}
                      >
                        {rp(totalCredit)}
                      </td>
                      <td style={{ padding: '10px 16px' }} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
