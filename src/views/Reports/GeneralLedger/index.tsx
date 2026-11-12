'use client'

import React, { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { reportsService } from '@/services/reports.service'
import type { GeneralLedgerAccount, GeneralLedgerEnvelope } from '@/services/reports.service'
import { chartOfAccountsService } from '@/services/accounting.service'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import { formatCurrency } from '@/utils/price'
import { formatDate, formatDateShort, toInputDate } from '@/utils/date'
import SearchableSelect from '@/components/SearchableSelect'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { FileSpreadsheet, Download, Printer, AlertCircle } from 'lucide-react'

interface CoA {
  id: number
  code: string
  name: string
  is_header?: boolean
}

type AccountMode = 'single' | 'range'

const sectionStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: 24,
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 14,
  color: 'var(--foreground)',
  background: 'var(--surface-raised)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
}

const btnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '9px 16px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--foreground)',
  cursor: 'pointer',
}

const theadCellStyle: React.CSSProperties = {
  padding: '10px 16px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  background: 'var(--background)',
  whiteSpace: 'nowrap',
}

const cellStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 13,
  color: 'var(--foreground)',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top',
}

const amountCellStyle: React.CSSProperties = {
  ...cellStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}

const accountHeaderCellStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderBottom: '1px solid var(--border-strong, var(--border))',
  background: 'var(--accent-light-bg)',
}

const JOURNAL_TYPE_LABELS: Record<string, string> = {
  manual: 'General',
  sales: 'Sales',
  purchase: 'Purchase',
  receipt: 'Receipt',
  payment: 'Payment',
  adjustment: 'Adjustment',
  closing: 'Closing',
}

const firstOfYear = () => `${new Date().getFullYear()}-01-01`
const today = () => new Date().toISOString().split('T')[0]

const modeBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 500,
  background: active ? 'var(--accent)' : 'var(--surface)',
  color: active ? 'white' : 'var(--foreground)',
  border: 'none',
  cursor: 'pointer',
  transition: 'background 150ms',
})

export default function GeneralLedgerView() {
  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = isSuperadmin || hasPermission('report.read')

  const [mode, setMode] = useState<AccountMode>('single')
  const [chartOfAccountId, setChartOfAccountId] = useState<string>('')
  const [startCoaCode, setStartCoaCode] = useState<string>('')
  const [endCoaCode, setEndCoaCode] = useState<string>('')
  const [startDate, setStartDate] = useState<string>(firstOfYear())
  const [endDate, setEndDate] = useState<string>(today())
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [isExporting, setIsExporting] = useState(false)

  // Each picker searches CoA on the server with its own term; SearchableSelect
  // keeps the picked label cached when it drops out of the results.
  const [accountSearch, setAccountSearch] = useState('')
  const [startCodeSearch, setStartCodeSearch] = useState('')
  const [endCodeSearch, setEndCodeSearch] = useState('')
  const accountSearchDebounced = useDebounce(accountSearch, 400)
  const startCodeSearchDebounced = useDebounce(startCodeSearch, 400)
  const endCodeSearchDebounced = useDebounce(endCodeSearch, 400)

  const useCoaOptions = (term: string, enabled: boolean) =>
    useInfiniteOptions<CoA>({
      queryKey: ['chart-of-accounts-options', 'gl', term],
      enabled: canRead && enabled,
      staleTime: 60_000,
      // Next page loads when the list is scrolled to the bottom; typing searches code + name on the server.
      fetchPage: (page) =>
        chartOfAccountsService
          .list({ page, per_page: 50, sort: 'code', 'filter[search]': term || undefined } as any)
          .then((r) => r.data),
    })
  const accountCoa = useCoaOptions(accountSearchDebounced, mode === 'single')
  const startCoa = useCoaOptions(startCodeSearchDebounced, mode !== 'single')
  const endCoa = useCoaOptions(endCodeSearchDebounced, mode !== 'single')

  const accountOptions = accountCoa.items.map((a) => ({
    value: String(a.id),
    label: a.name,
    sublabel: a.code,
  }))
  const codeOptionsOf = (accounts: CoA[]) =>
    accounts.map((a) => ({
      value: a.code,
      label: a.code,
      sublabel: a.name,
    }))

  // Client-side validation mirroring the backend 400 rules.
  const validationError: string | null = (() => {
    if (!startDate || !endDate) return 'Start date and end date are required'
    if (startDate > endDate) return 'Start date must be on or before end date'
    if (mode === 'single') {
      if (!chartOfAccountId) return 'Please select an account'
      return null
    }
    if (!startCoaCode || !endCoaCode) return 'Start and end account code are both required'
    if (startCoaCode > endCoaCode) return 'Start code must be less than or equal to end code'
    return null
  })()

  useEffect(() => {
    setPage(1)
  }, [mode, chartOfAccountId, startCoaCode, endCoaCode, startDate, endDate])

  const queryParams = {
    start_date: startDate,
    end_date: endDate,
    ...(mode === 'single'
      ? chartOfAccountId
        ? { chart_of_account_id: Number(chartOfAccountId) }
        : {}
      : startCoaCode && endCoaCode
        ? { start_coa_code: startCoaCode, end_coa_code: endCoaCode }
        : {}),
  }

  const { data, isLoading, isError } = useQuery<GeneralLedgerEnvelope>({
    queryKey: ['general-ledger', mode, chartOfAccountId, startCoaCode, endCoaCode, startDate, endDate, page, perPage],
    enabled: canRead && !validationError,
    queryFn: () =>
      reportsService
        .getGeneralLedger({ ...queryParams, page, per_page: perPage })
        .then((r) => r.data),
  })

  const gl = data?.data
  const ledgerAccounts: GeneralLedgerAccount[] = gl?.accounts ?? []
  const meta = data?.meta
  const hasData = !isLoading && !isError && !!gl

  const pageTotalDebit = ledgerAccounts.reduce((s, a) => s + Number(a.total_debit ?? 0), 0)
  const pageTotalCredit = ledgerAccounts.reduce((s, a) => s + Number(a.total_credit ?? 0), 0)
  // Row numbers for ledger entry lines, continuous across account groups on this page.
  const lineNoOffsets = ledgerAccounts.reduce<number[]>((acc, a, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + (ledgerAccounts[i - 1].lines?.length ?? 0))
    return acc
  }, [])

  // Backend removed GET /reports/general-ledger/exports — generate the workbook
  // client-side from every page of the JSON endpoint (per_page capped at 1000).
  const exportExcel = async () => {
    if (validationError) return toast.error(validationError)
    setIsExporting(true)
    try {
      const allAccounts: GeneralLedgerAccount[] = []
      let current = 1
      let totalPages = 1
      do {
        const res = await reportsService.getGeneralLedger({
          ...queryParams,
          page: current,
          per_page: 1000,
        })
        const body: GeneralLedgerEnvelope = res.data
        allAccounts.push(...(body?.data?.accounts ?? []))
        totalPages = Number(body?.meta?.total_pages ?? 1)
        current += 1
      } while (current <= totalPages && current <= 500)

      const header = [
        'Account Code',
        'Account Name',
        'Date',
        'Journal No',
        'Type',
        'Description',
        'Reference',
        'Debit',
        'Credit',
        'Balance',
      ]
      const rows: (string | number)[][] = [header]
      for (const acc of allAccounts) {
        if (acc.lines.length === 0) {
          rows.push([
            acc.chart_of_account_code,
            acc.chart_of_account_name,
            '',
            '',
            '',
            'No transactions in this period',
            '',
            0,
            0,
            0,
          ])
        } else {
          for (const ln of acc.lines) {
            rows.push([
              acc.chart_of_account_code,
              acc.chart_of_account_name,
              ln.date,
              ln.journal_number,
              JOURNAL_TYPE_LABELS[ln.type] ?? ln.type,
              ln.description ?? '',
              ln.reference_type ?? '',
              Number(ln.debit ?? 0),
              Number(ln.credit ?? 0),
              Number(ln.balance ?? 0),
            ])
          }
        }
        rows.push([
          acc.chart_of_account_code,
          acc.chart_of_account_name,
          '',
          '',
          '',
          `Total — ${acc.chart_of_account_code}`,
          '',
          Number(acc.total_debit ?? 0),
          Number(acc.total_credit ?? 0),
          Number(acc.ending_balance ?? 0),
        ])
      }

      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [
        { wch: 14 },
        { wch: 30 },
        { wch: 12 },
        { wch: 22 },
        { wch: 12 },
        { wch: 40 },
        { wch: 14 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'General Ledger')
      XLSX.writeFile(wb, `general-ledger-${startDate}_${endDate}.xlsx`)
      toast.success('Export downloaded successfully')
    } catch {
      toast.error('Gagal mengekspor data.')
    } finally {
      setIsExporting(false)
    }
  }

  const { mutate: handleExport, isPending: exportPending } = useMutation({
    mutationFn: exportExcel,
    onError: () => toast.error('Gagal mengekspor data.'),
  })

  const canExport = canRead && !validationError

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4 landscape; margin: 12mm; }
          body { font-size: 11px; margin: 0; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #000; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
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
            General Ledger
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            {hasData
              ? `Periode: ${formatDate(gl.start_date ?? startDate)} – ${formatDate(gl.end_date ?? endDate)}`
              : 'Journal lines per account for a date range (posted, non-reversed journals only)'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => window.print()} style={btnStyle}>
            <Printer size={14} />
            Print
          </button>
          <button
            type="button"
            onClick={() => handleExport()}
            disabled={!canExport || isExporting || exportPending}
            style={{
              ...btnStyle,
              opacity: canExport && !isExporting && !exportPending ? 1 : 0.6,
              cursor: canExport && !isExporting && !exportPending ? 'pointer' : 'not-allowed',
            }}
          >
            <Download size={14} />
            {isExporting || exportPending ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {!canRead ? (
        <div style={{ ...sectionStyle, color: 'var(--warning)', background: 'var(--warning-bg)', borderColor: 'var(--warning)', fontSize: 13 }}>
          You do not have permission to view the general ledger.
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="no-print" style={sectionStyle}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Account Selection</label>
                <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <button type="button" onClick={() => setMode('single')} style={modeBtnStyle(mode === 'single')}>
                    Single Account
                  </button>
                  <button type="button" onClick={() => setMode('range')} style={modeBtnStyle(mode === 'range')}>
                    Code Range
                  </button>
                </div>
              </div>

              {mode === 'single' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 280, flex: '1 1 280px' }}>
                  <label style={labelStyle}>Account *</label>
                  <SearchableSelect
                    value={chartOfAccountId}
                    onChange={(v: string | number) => setChartOfAccountId(v ? String(v) : '')}
                    options={accountOptions}
                    loading={accountCoa.loading}
                    {...accountCoa.selectProps}
                    onSearchChange={setAccountSearch}
                    placeholder="-- Select Account --"
                    searchPlaceholder="Cari kode / nama akun..."
                  />
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220, flex: '1 1 220px' }}>
                    <label style={labelStyle}>Start Code *</label>
                    <SearchableSelect
                      value={startCoaCode}
                      onChange={(v: string | number) => setStartCoaCode(v ? String(v) : '')}
                      options={codeOptionsOf(startCoa.items)}
                      loading={startCoa.loading}
                      {...startCoa.selectProps}
                      onSearchChange={setStartCodeSearch}
                      placeholder="-- Start Code --"
                      searchPlaceholder="Cari kode / nama akun..."
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220, flex: '1 1 220px' }}>
                    <label style={labelStyle}>End Code *</label>
                    <SearchableSelect
                      value={endCoaCode}
                      onChange={(v: string | number) => setEndCoaCode(v ? String(v) : '')}
                      options={codeOptionsOf(endCoa.items)}
                      loading={endCoa.loading}
                      {...endCoa.selectProps}
                      onSearchChange={setEndCodeSearch}
                      placeholder="-- End Code --"
                      searchPlaceholder="Cari kode / nama akun..."
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Start Date *</label>
                <input type="date" value={toInputDate(startDate)} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>End Date *</label>
                <input type="date" value={toInputDate(endDate)} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
              </div>
            </div>

            {mode === 'range' && (
              <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '12px 0 0' }}>
                Range is inclusive and compared lexicographically; header accounts are excluded from range results.
              </p>
            )}
            {validationError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: 'var(--warning)' }}>
                <AlertCircle size={13} />
                {validationError}
              </div>
            )}
          </div>

          {/* Ledger */}
          <div style={sectionStyle}>
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSpreadsheet size={16} color="var(--accent)" />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                  Ledger Entries{hasData ? ` — ${ledgerAccounts.length} account${ledgerAccounts.length === 1 ? '' : 's'}` : ''}
                </span>
              </div>
              {hasData && ledgerAccounts.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  Total debit {formatCurrency(pageTotalDebit)} · credit {formatCurrency(pageTotalCredit)} (this page)
                </span>
              )}
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...theadCellStyle, width: 50, textAlign: 'center' }}>No.</th>
                    <th style={theadCellStyle}>Date</th>
                    <th style={theadCellStyle}>Journal No</th>
                    <th style={theadCellStyle}>Type</th>
                    <th style={theadCellStyle}>Description</th>
                    <th style={theadCellStyle}>Ref</th>
                    <th style={{ ...theadCellStyle, textAlign: 'right' }}>Debit</th>
                    <th style={{ ...theadCellStyle, textAlign: 'right' }}>Credit</th>
                    <th style={{ ...theadCellStyle, textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} style={{ ...cellStyle, textAlign: 'center', padding: '48px 16px', color: 'var(--foreground-muted)' }}>
                        Loading...
                      </td>
                    </tr>
                  ) : isError ? (
                    <tr>
                      <td colSpan={9} style={{ ...cellStyle, textAlign: 'center', padding: '48px 16px', color: 'var(--destructive)' }}>
                        Failed to load general ledger
                      </td>
                    </tr>
                  ) : validationError ? (
                    <tr>
                      <td colSpan={9} style={{ ...cellStyle, textAlign: 'center', padding: '48px 16px', color: 'var(--foreground-muted)' }}>
                        Set the filters above to generate the ledger
                      </td>
                    </tr>
                  ) : ledgerAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ ...cellStyle, textAlign: 'center', padding: '48px 16px', color: 'var(--foreground-muted)' }}>
                        No accounts match the selected criteria
                      </td>
                    </tr>
                  ) : (
                    ledgerAccounts.map((acc, accIdx) => (
                      <React.Fragment key={acc.chart_of_account_id}>
                        <tr>
                          <td style={accountHeaderCellStyle} />
                          <td colSpan={8} style={accountHeaderCellStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                                  {acc.chart_of_account_code}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                                  {acc.chart_of_account_name}
                                </span>
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: 99,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    background: acc.normal_balance === 'credit' ? 'var(--info-bg)' : 'var(--success-bg)',
                                    color: acc.normal_balance === 'credit' ? 'var(--info)' : 'var(--success)',
                                  }}
                                >
                                  {acc.normal_balance}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: 20, fontSize: 12, flexWrap: 'wrap' }}>
                                <span style={{ color: 'var(--foreground-muted)' }}>
                                  Debit <b style={{ color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(acc.total_debit)}</b>
                                </span>
                                <span style={{ color: 'var(--foreground-muted)' }}>
                                  Credit <b style={{ color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(acc.total_credit)}</b>
                                </span>
                                <span style={{ color: 'var(--foreground-muted)' }}>
                                  Balance <b style={{ color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(acc.ending_balance)}</b>
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {acc.lines.length === 0 ? (
                          <tr>
                            <td style={cellStyle} />
                            <td colSpan={8} style={{ ...cellStyle, color: 'var(--foreground-subtle)', fontStyle: 'italic' }}>
                              No transactions in this period
                            </td>
                          </tr>
                        ) : (
                          acc.lines.map((ln, idx) => (
                            <tr key={`${acc.chart_of_account_id}-${ln.journal_id}-${idx}`}>
                              <td style={{ ...cellStyle, textAlign: 'center', color: 'var(--foreground-muted)', width: 50 }}>{lineNoOffsets[accIdx] + idx + 1}</td>
                              <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>{formatDateShort(ln.date)}</td>
                              <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{ln.journal_number}</td>
                              <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>{JOURNAL_TYPE_LABELS[ln.type] ?? ln.type}</td>
                              <td style={cellStyle}>{ln.description || '—'}</td>
                              <td style={{ ...cellStyle, fontSize: 12, color: 'var(--foreground-muted)' }}>{ln.reference_type || '—'}</td>
                              <td style={amountCellStyle}>{Number(ln.debit) > 0 ? formatCurrency(ln.debit) : ''}</td>
                              <td style={amountCellStyle}>{Number(ln.credit) > 0 ? formatCurrency(ln.credit) : ''}</td>
                              <td style={{ ...amountCellStyle, fontWeight: 600 }}>{formatCurrency(ln.balance)}</td>
                            </tr>
                          ))
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="no-print">
              <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
