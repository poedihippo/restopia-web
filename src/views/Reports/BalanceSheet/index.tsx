'use client'

import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { reportsService } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import { toast } from 'sonner'
import api from '@/hooks/useApi'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency } from '@/utils/price'
import { formatDate, toInputDate } from '@/utils/date'
import { FileSpreadsheet, Download, Printer, CheckCircle2, AlertCircle } from 'lucide-react'

interface AccountBalance {
  code: string
  name: string
  balance: number
}

interface BalanceSheetSection {
  accounts?: AccountBalance[] | null
  subtotal?: number | null
}

interface BalanceSheet {
  assets?: BalanceSheetSection
  liabilities?: BalanceSheetSection
  equity?: BalanceSheetSection
  total_assets?: number
  total_liabilities_and_equity?: number
  balanced?: boolean
  difference?: number
  as_of_date?: string
}

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
  background: 'var(--surface)',
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

const sectionLabelRowStyle: React.CSSProperties = {
  background: 'var(--background)',
}

const sectionLabelCellStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const accountRowCellStyle: React.CSSProperties = {
  padding: '8px 16px 8px 32px',
  fontSize: 13,
  color: 'var(--foreground)',
  borderBottom: '1px solid var(--border)',
}

const amountCellStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 13,
  color: 'var(--foreground)',
  borderBottom: '1px solid var(--border)',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

const subtotalRowStyle: React.CSSProperties = {
  background: 'var(--background)',
}

const subtotalCellStyle: React.CSSProperties = {
  padding: '8px 16px 8px 32px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--foreground)',
  borderBottom: '1px solid var(--border)',
}

const subtotalAmountCellStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--foreground)',
  borderBottom: '1px solid var(--border)',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

const totalRowStyle: React.CSSProperties = {
  background: 'var(--accent-light-bg)',
}

const totalCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--foreground)',
  borderBottom: '1px solid var(--border)',
}

const totalAmountCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--accent)',
  borderBottom: '1px solid var(--border)',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

const today = () => new Date().toISOString().split('T')[0]

const SECTION_LABELS: Record<string, string> = {
  assets: 'ASET',
  liabilities: 'KEWAJIBAN',
  equity: 'MODAL',
}

export default function BalanceSheetView() {
  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = isSuperadmin || hasPermission('journal.read')

  const [asOfDate, setAsOfDate] = useState<string>(today())

  const { data, isLoading, isError } = useQuery({
    queryKey: ['balance-sheet', asOfDate],
    enabled: canRead && !!asOfDate,
    queryFn: () =>
      api
        .get('/reports/balance-sheet', { params: { as_of_date: asOfDate } })
        .then((r) => r.data),
  })

  const bs: BalanceSheet | undefined = (data as any)?.data

  const assets = bs?.assets
  const liabilities = bs?.liabilities
  const equity = bs?.equity
  const totalAssets = Number(bs?.total_assets ?? 0)
  const totalLiabilitiesAndEquity = Number(bs?.total_liabilities_and_equity ?? 0)
  const balanced = bs?.balanced
  const difference = Number(bs?.difference ?? 0)

  const hasStatement = !isLoading && !isError && !!bs

  const renderSection = (key: string, section: BalanceSheetSection | null | undefined) => {
    const accounts = section?.accounts ?? []
    const subtotal = section?.subtotal ?? 0

    return (
      <React.Fragment key={key}>
        <tr style={sectionLabelRowStyle}>
          <td colSpan={2} style={sectionLabelCellStyle}>
            {SECTION_LABELS[key]}
          </td>
        </tr>
        {accounts.length === 0 ? (
          <tr>
            <td style={accountRowCellStyle}>
              <span style={{ color: 'var(--foreground-subtle)' }}>—</span>
            </td>
            <td style={amountCellStyle}>{formatCurrency(0)}</td>
          </tr>
        ) : (
          accounts.map((acc) => (
            <tr key={acc.code}>
              <td style={accountRowCellStyle}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, marginRight: 8, color: 'var(--foreground-muted)' }}>
                  {acc.code}
                </span>
                {acc.name}
              </td>
              <td style={amountCellStyle}>{formatCurrency(acc.balance)}</td>
            </tr>
          ))
        )}
        <tr style={subtotalRowStyle}>
          <td style={subtotalCellStyle}>Subtotal {SECTION_LABELS[key]}</td>
          <td style={subtotalAmountCellStyle}>{formatCurrency(subtotal)}</td>
        </tr>
      </React.Fragment>
    )
  }

  const renderTotalRow = (label: string, amount: number) => (
    <tr style={totalRowStyle}>
      <td style={totalCellStyle}>{label}</td>
      <td style={totalAmountCellStyle}>{formatCurrency(amount)}</td>
    </tr>
  )

  const { mutate: exportExcel, isPending: isExporting } = useMutation({
    mutationFn: () => reportsService.exportBalanceSheet({ as_of_date: asOfDate }),
    onSuccess: (res) => {
      downloadFileFromResponse(res, `balance-sheet-${asOfDate}.xlsx`)
    },
    onError: () => {
      toast.error('Gagal mengekspor data.')
    }
  })

  const handleExport = () => {
    exportExcel()
  }

  const canExport = hasStatement

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 15mm; }
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
            Balance Sheet
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            {hasStatement
              ? `Per tanggal ${formatDate(bs?.as_of_date ?? asOfDate)}`
              : 'Assets, liabilities, and equity as of a selected date (posted journals only)'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => window.print()} style={btnStyle}>
            <Printer size={14} />
            Print
          </button>
          <button type="button" onClick={handleExport} disabled={!canExport || isExporting} style={{ ...btnStyle, opacity: canExport && !isExporting ? 1 : 0.6, cursor: canExport && !isExporting ? 'pointer' : 'not-allowed' }}>
            <Download size={14} />
            {isExporting ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {!canRead ? (
        <div style={{ ...sectionStyle, color: 'var(--warning)', background: 'var(--warning-bg)', borderColor: 'var(--warning)', fontSize: 13 }}>
          You do not have permission to view the balance sheet.
        </div>
      ) : (
        <>
          {/* Balanced indicator */}
          {hasStatement && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 20px',
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                fontWeight: 700,
                background: balanced ? '#1a7f371a' : '#c0362c1a',
                color: balanced ? '#1a7f37' : '#c0362c',
                border: `1px solid ${balanced ? '#1a7f37' : '#c0362c'}`,
              }}
            >
              {balanced ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              {balanced ? 'SEIMBANG ✓' : `TIDAK SEIMBANG — selisih ${formatCurrency(difference)}`}
            </div>
          )}

          {/* Date filter */}
          <div className="no-print" style={sectionStyle}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>As of Date</label>
                <input
                  type="date"
                  value={toInputDate(asOfDate)}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Statement */}
          <div style={sectionStyle}>
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <FileSpreadsheet size={16} color="var(--accent)" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Statement</span>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={2} style={{ ...accountRowCellStyle, paddingLeft: 16, textAlign: 'center', color: 'var(--foreground-muted)' }}>
                        Loading...
                      </td>
                    </tr>
                  ) : isError ? (
                    <tr>
                      <td colSpan={2} style={{ ...accountRowCellStyle, paddingLeft: 16, textAlign: 'center', color: 'var(--destructive)' }}>
                        Failed to load balance sheet
                      </td>
                    </tr>
                  ) : !hasStatement ? (
                    <tr>
                      <td colSpan={2} style={{ ...accountRowCellStyle, paddingLeft: 16, textAlign: 'center', color: 'var(--foreground-muted)' }}>
                        Select a date to generate the balance sheet
                      </td>
                    </tr>
                  ) : (
                    <>
                      {renderSection('assets', assets)}
                      {renderTotalRow('TOTAL ASET', totalAssets)}
                      {renderSection('liabilities', liabilities)}
                      {renderSection('equity', equity)}
                      {renderTotalRow('TOTAL KEWAJIBAN + MODAL', totalLiabilitiesAndEquity)}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
