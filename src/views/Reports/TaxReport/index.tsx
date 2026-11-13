'use client'

import React, { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Receipt, AlertCircle } from 'lucide-react'
import { reportsService, type TaxReportResponse } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency } from '@/utils/price'
import { formatDate, formatDateShort } from '@/utils/date'
import FinanceBranchSelect, { financeBranchParam, useFinanceBranchLabel, type FinanceBranchScope } from '../FinanceBranchSelect'
import FinancePeriodSelect from '../FinancePeriodSelect'
import {
  FilterField,
  MessageRow,
  SkeletonRows,
  filterInputStyle,
  numTd,
  pageStyle,
  subtitleStyle,
  titleStyle,
  totalRowStyle,
} from '../reportUi'

const firstOfMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const today = () => new Date().toLocaleDateString('en-CA')

export default function TaxReportView() {
  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = isSuperadmin || hasPermission('report.read')

  const [startDate, setStartDate] = useState(firstOfMonth())
  const [endDate, setEndDate] = useState(today())
  const [branchScope, setBranchScope] = useState<FinanceBranchScope>('')
  const [typeFilter, setTypeFilter] = useState<'' | 'output' | 'input'>('')
  const branchLabel = useFinanceBranchLabel(branchScope)

  const rangeError =
    !startDate || !endDate
      ? 'Start date and end date are required'
      : startDate > endDate
        ? 'Start date must be on or before end date'
        : null

  const params = { start_date: startDate, end_date: endDate, ...financeBranchParam(branchScope) }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tax-report', startDate, endDate, branchScope],
    enabled: canRead && !rangeError,
    queryFn: () => reportsService.getTaxReport(params).then((r) => r.data),
  })
  const report: TaxReportResponse | undefined = data?.data
  const allLines = report?.lines ?? []
  const lines = typeFilter ? allLines.filter((l) => l.type === typeFilter) : allLines

  const { mutate: exportExcel, isPending } = useMutation({
    mutationFn: () => reportsService.exportTaxReport(params),
    onSuccess: (res) => downloadFileFromResponse(res, `tax-report-${startDate}_${endDate}.xlsx`),
    onError: () => toast.error('Gagal mengekspor data.'),
  })

  const COLS = 6
  const payable = Number(report?.total_payable ?? 0)

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={titleStyle}>Tax Report</h1>
          <p style={subtitleStyle}>
            {report
              ? `Periode: ${formatDate(report.start_date)} – ${formatDate(report.end_date)} · ${branchLabel}`
              : 'VAT output (sales, incl. POS/online) and input (purchases) from the ledger'}
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
              <FilterField label="Type">
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} style={{ ...filterInputStyle, cursor: 'pointer' }}>
                  <option value="">All</option>
                  <option value="output">Output VAT</option>
                  <option value="input">Input VAT</option>
                </select>
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
                  <th>Date</th>
                  <th>Journal No</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Taxable Base</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th style={{ textAlign: 'right' }}>Tax Amount</th>
                </tr>
              </thead>
              <tbody>
                {rangeError ? (
                  <MessageRow cols={COLS} icon={<Receipt size={22} />}>Set the date range above to generate the report</MessageRow>
                ) : isLoading ? (
                  <SkeletonRows cols={COLS} />
                ) : isError ? (
                  <MessageRow cols={COLS} tone="error">
                    {(error as any)?.response?.data?.message ?? 'Failed to load tax report'}
                  </MessageRow>
                ) : lines.length === 0 ? (
                  <MessageRow cols={COLS} icon={<Receipt size={22} />}>No taxable transactions in this period</MessageRow>
                ) : (
                  lines.map((ln, i) => (
                    <tr key={`${ln.type}-${ln.reference}-${i}`} data-row>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDateShort(ln.date)}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{ln.reference || '—'}</td>
                      <td>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 99,
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: ln.type === 'output' ? 'var(--info-bg)' : 'var(--success-bg)',
                            color: ln.type === 'output' ? 'var(--info)' : 'var(--success)',
                          }}
                        >
                          {ln.type === 'output' ? 'Output' : ln.type === 'input' ? 'Input' : ln.type}
                        </span>
                      </td>
                      <td style={numTd}>{formatCurrency(ln.taxable_base)}</td>
                      <td style={numTd}>{Number(ln.tax_rate ?? 0).toLocaleString('id-ID')}%</td>
                      <td style={{ ...numTd, fontWeight: 600 }}>{formatCurrency(ln.tax_amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {!rangeError && !isLoading && !isError && report && (
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ padding: '10px 12px', fontSize: 12.5 }}>Total output VAT</td>
                    <td style={{ ...numTd, padding: '10px 12px', fontSize: 12.5 }}>{formatCurrency(report.total_output)}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} style={{ padding: '10px 12px', fontSize: 12.5 }}>Total input VAT</td>
                    <td style={{ ...numTd, padding: '10px 12px', fontSize: 12.5 }}>{formatCurrency(report.total_input)}</td>
                  </tr>
                  <tr style={totalRowStyle}>
                    <td colSpan={5} style={{ padding: '10px 12px', fontSize: 12.5 }}>
                      {payable < 0 ? 'VAT overpaid (carried forward)' : 'VAT payable'}
                    </td>
                    <td style={{ ...numTd, padding: '10px 12px', fontSize: 12.5 }}>{formatCurrency(payable)}</td>
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
