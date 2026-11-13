'use client'

import React, { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Wallet, AlertCircle } from 'lucide-react'
import { reportsService, type CashFlowResponse, type CashFlowSection } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency } from '@/utils/price'
import { formatDate } from '@/utils/date'
import FinanceBranchSelect, { financeBranchParam, useFinanceBranchLabel, type FinanceBranchScope } from '../FinanceBranchSelect'
import FinancePeriodSelect from '../FinancePeriodSelect'
import {
  FilterField,
  MessageRow,
  SkeletonRows,
  filterInputStyle,
  humanize,
  numTd,
  pageStyle,
  sectionRowStyle,
  subtitleStyle,
  titleStyle,
  totalRowStyle,
} from '../reportUi'

const firstOfMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const today = () => new Date().toLocaleDateString('en-CA')

const SECTIONS: { key: 'operating' | 'investing' | 'financing'; label: string }[] = [
  { key: 'operating', label: 'Operating activities' },
  { key: 'investing', label: 'Investing activities' },
  { key: 'financing', label: 'Financing activities' },
]

export default function CashFlowView() {
  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = isSuperadmin || hasPermission('report.read')

  const [startDate, setStartDate] = useState(firstOfMonth())
  const [endDate, setEndDate] = useState(today())
  const [branchScope, setBranchScope] = useState<FinanceBranchScope>('')
  const branchLabel = useFinanceBranchLabel(branchScope)

  const rangeError =
    !startDate || !endDate
      ? 'Start date and end date are required'
      : startDate > endDate
        ? 'Start date must be on or before end date'
        : null

  const params = { start_date: startDate, end_date: endDate, ...financeBranchParam(branchScope) }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['cash-flow', startDate, endDate, branchScope],
    enabled: canRead && !rangeError,
    queryFn: () => reportsService.getCashFlow(params).then((r) => r.data),
  })
  const report: CashFlowResponse | undefined = data?.data

  const { mutate: exportExcel, isPending } = useMutation({
    mutationFn: () => reportsService.exportCashFlow(params),
    onSuccess: (res) => downloadFileFromResponse(res, `cash-flow-${startDate}_${endDate}.xlsx`),
    onError: () => toast.error('Gagal mengekspor data.'),
  })

  const COLS = 2
  const renderSection = (label: string, section: CashFlowSection | undefined) => {
    const lines = section?.lines ?? []
    return (
      <React.Fragment key={label}>
        <tr>
          <td colSpan={COLS} style={sectionRowStyle}>{label}</td>
        </tr>
        {lines.length === 0 ? (
          <tr>
            <td style={{ paddingLeft: 28, color: 'var(--foreground-subtle)', fontStyle: 'italic' }}>No cash movement</td>
            <td style={numTd}>{formatCurrency(0)}</td>
          </tr>
        ) : (
          lines.map((ln) => (
            <tr key={`${label}-${ln.activity}`} data-row>
              <td style={{ paddingLeft: 28 }}>{humanize(ln.activity)}</td>
              <td style={{ ...numTd, color: ln.net < 0 ? 'var(--destructive)' : undefined }}>{formatCurrency(ln.net)}</td>
            </tr>
          ))
        )}
        <tr>
          <td style={{ fontWeight: 600 }}>Net cash from {label.toLowerCase()}</td>
          <td style={{ ...numTd, fontWeight: 600 }}>{formatCurrency(section?.subtotal ?? 0)}</td>
        </tr>
      </React.Fragment>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={titleStyle}>Cash Flow</h1>
          <p style={subtitleStyle}>
            {report
              ? `Periode: ${formatDate(report.start_date)} – ${formatDate(report.end_date)} · ${branchLabel}`
              : 'Cash in and out of the cash accounts, by activity'}
          </p>
        </div>
        <button
          type="button"
          className="v2-btn v2-btn-outline"
          onClick={() => exportExcel()}
          disabled={!canRead || !!rangeError || isPending}
          title={rangeError ?? undefined}
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
              <FilterField label="Period">
                <FinancePeriodSelect
                  start={startDate}
                  end={endDate}
                  onChange={(p) => { setStartDate(p.start_date); setEndDate(p.end_date) }}
                  style={filterInputStyle}
                />
              </FilterField>
              <FilterField label="Start Date *">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={filterInputStyle} />
              </FilterField>
              <FilterField label="End Date *">
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={filterInputStyle} />
              </FilterField>
              <FilterField label="Branch">
                <FinanceBranchSelect value={branchScope} onChange={setBranchScope} style={filterInputStyle} />
              </FilterField>
            </div>
            {rangeError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: 'var(--warning)' }}>
                <AlertCircle size={13} /> {rangeError}
              </div>
            )}
          </div>

          <div className="v2-card" style={{ overflow: 'hidden' }}>
            <table className="v2-table">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th style={{ textAlign: 'right' }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {rangeError ? (
                  <MessageRow cols={COLS} icon={<Wallet size={22} />}>Set the date range above to generate the report</MessageRow>
                ) : isLoading ? (
                  <SkeletonRows cols={COLS} />
                ) : isError ? (
                  <MessageRow cols={COLS} tone="error">
                    {(error as any)?.response?.data?.message ?? 'Failed to load cash flow'}
                  </MessageRow>
                ) : !report ? (
                  <MessageRow cols={COLS} icon={<Wallet size={22} />}>No data</MessageRow>
                ) : (
                  <>
                    {SECTIONS.map((s) => renderSection(s.label, report[s.key]))}
                    <tr style={totalRowStyle}>
                      <td>Net increase (decrease) in cash</td>
                      <td style={numTd}>{formatCurrency(report.net_increase)}</td>
                    </tr>
                    <tr>
                      <td>Cash at beginning of period</td>
                      <td style={numTd}>{formatCurrency(report.begin_balance)}</td>
                    </tr>
                    <tr style={totalRowStyle}>
                      <td>Cash at end of period</td>
                      <td style={numTd}>{formatCurrency(report.end_balance)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
