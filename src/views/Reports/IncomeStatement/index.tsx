'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import api from '@/hooks/useApi'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency } from '@/utils/price'
import { formatDate, toInputDate } from '@/utils/date'
import { FileSpreadsheet, Download, Printer } from 'lucide-react'

interface AccountLine {
  code: string
  name: string
  amount: number
}

interface StatementTier {
  accounts: AccountLine[]
  subtotal: number
}

interface IncomeStatement {
  operating_revenue?: StatementTier
  cost_of_revenue?: StatementTier
  operating_expense?: StatementTier
  other_income?: StatementTier
  other_expense?: StatementTier
  gross_profit?: number
  operating_profit?: number
  net_profit?: number
  start_date?: string
  end_date?: string
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

const accentBtnStyle: React.CSSProperties = {
  ...btnStyle,
  background: 'var(--accent)',
  color: 'white',
  border: 'none',
}

const tierLabelRowStyle: React.CSSProperties = {
  background: 'var(--background)',
}

const tierLabelCellStyle: React.CSSProperties = {
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

const profitRowStyle: React.CSSProperties = {
  background: 'var(--accent-light-bg)',
}

const profitCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--foreground)',
  borderBottom: '1px solid var(--border)',
}

const profitAmountCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--accent)',
  borderBottom: '1px solid var(--border)',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

const firstOfYear = () => `${new Date().getFullYear()}-01-01`
const today = () => new Date().toISOString().split('T')[0]

const TIER_LABELS: Record<string, string> = {
  operating_revenue: 'PENDAPATAN',
  cost_of_revenue: 'HARGA POKOK PENJUALAN',
  operating_expense: 'BEBAN OPERASIONAL',
  other_income: 'PENDAPATAN LAIN',
  other_expense: 'BEBAN LAIN',
}

function emptyTier(): StatementTier {
  return { accounts: [], subtotal: 0 }
}

export default function IncomeStatementView() {
  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = isSuperadmin || hasPermission('journal.read')

  const [startDate, setStartDate] = useState<string>(firstOfYear())
  const [endDate, setEndDate] = useState<string>(today())

  const { data, isLoading, isError } = useQuery({
    queryKey: ['income-statement', startDate, endDate],
    enabled: canRead && !!startDate && !!endDate,
    queryFn: () =>
      api
        .get('/reports/income-statement', { params: { start_date: startDate, end_date: endDate } })
        .then((r) => r.data),
  })

  const stmt: IncomeStatement | undefined = (data as any)?.data

  const operatingRevenue = stmt?.operating_revenue ?? emptyTier()
  const costOfRevenue = stmt?.cost_of_revenue ?? emptyTier()
  const operatingExpense = stmt?.operating_expense ?? emptyTier()
  const otherIncome = stmt?.other_income ?? emptyTier()
  const otherExpense = stmt?.other_expense ?? emptyTier()
  const grossProfit = Number(stmt?.gross_profit ?? 0)
  const operatingProfit = Number(stmt?.operating_profit ?? 0)
  const netProfit = Number(stmt?.net_profit ?? 0)

  const hasStatement = !isLoading && !isError && !!stmt

  const renderTier = (key: string, tier: StatementTier) => (
    <React.Fragment key={key}>
      <tr style={tierLabelRowStyle}>
        <td colSpan={2} style={tierLabelCellStyle}>
          {TIER_LABELS[key]}
        </td>
      </tr>
      {tier.accounts.length === 0 ? (
        <tr>
          <td style={accountRowCellStyle}>
            <span style={{ color: 'var(--foreground-subtle)' }}>—</span>
          </td>
          <td style={amountCellStyle}>{formatCurrency(0)}</td>
        </tr>
      ) : (
        tier.accounts.map((acc) => (
          <tr key={acc.code}>
            <td style={accountRowCellStyle}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, marginRight: 8, color: 'var(--foreground-muted)' }}>
                {acc.code}
              </span>
              {acc.name}
            </td>
            <td style={amountCellStyle}>{formatCurrency(acc.amount)}</td>
          </tr>
        ))
      )}
      <tr style={subtotalRowStyle}>
        <td style={subtotalCellStyle}>Subtotal {TIER_LABELS[key]}</td>
        <td style={subtotalAmountCellStyle}>{formatCurrency(tier.subtotal)}</td>
      </tr>
    </React.Fragment>
  )

  const renderProfitRow = (label: string, amount: number) => (
    <tr style={profitRowStyle}>
      <td style={profitCellStyle}>{label}</td>
      <td style={profitAmountCellStyle}>{formatCurrency(amount)}</td>
    </tr>
  )

  const handleExport = () => {
    const sheetRows: (string | number)[][] = [['Code', 'Account', 'Amount']]

    const pushTier = (key: string, tier: StatementTier) => {
      sheetRows.push([TIER_LABELS[key], '', ''])
      tier.accounts.forEach((acc) => sheetRows.push([acc.code, acc.name, acc.amount]))
      sheetRows.push(['', `Subtotal ${TIER_LABELS[key]}`, tier.subtotal])
    }

    pushTier('operating_revenue', operatingRevenue)
    pushTier('cost_of_revenue', costOfRevenue)
    sheetRows.push(['', 'LABA KOTOR', grossProfit])
    pushTier('operating_expense', operatingExpense)
    sheetRows.push(['', 'LABA OPERASIONAL', operatingProfit])
    pushTier('other_income', otherIncome)
    pushTier('other_expense', otherExpense)
    sheetRows.push(['', 'LABA BERSIH', netProfit])

    const ws = XLSX.utils.aoa_to_sheet(sheetRows)
    ws['!cols'] = [{ wch: 16 }, { wch: 36 }, { wch: 18 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Income Statement')
    XLSX.writeFile(wb, `income-statement-${startDate}_${endDate}.xlsx`)
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
            Income Statement
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            {hasStatement
              ? `Periode: ${formatDate(stmt?.start_date ?? startDate)} – ${formatDate(stmt?.end_date ?? endDate)}`
              : 'Profit & loss for a selected date range (posted journals only)'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => window.print()} style={btnStyle}>
            <Printer size={14} />
            Print
          </button>
          <button type="button" onClick={handleExport} disabled={!canExport} style={{ ...btnStyle, opacity: canExport ? 1 : 0.6, cursor: canExport ? 'pointer' : 'not-allowed' }}>
            <Download size={14} />
            Export Excel
          </button>
        </div>
      </div>

      {!canRead ? (
        <div style={{ ...sectionStyle, color: 'var(--warning)', background: 'var(--warning-bg)', borderColor: 'var(--warning)', fontSize: 13 }}>
          You do not have permission to view the income statement.
        </div>
      ) : (
        <>
          {/* Date range filter */}
          <div className="no-print" style={sectionStyle}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Start Date</label>
                <input
                  type="date"
                  value={toInputDate(startDate)}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>End Date</label>
                <input
                  type="date"
                  value={toInputDate(endDate)}
                  onChange={(e) => setEndDate(e.target.value)}
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
                        Failed to load income statement
                      </td>
                    </tr>
                  ) : !hasStatement ? (
                    <tr>
                      <td colSpan={2} style={{ ...accountRowCellStyle, paddingLeft: 16, textAlign: 'center', color: 'var(--foreground-muted)' }}>
                        Select a date range to generate the statement
                      </td>
                    </tr>
                  ) : (
                    <>
                      {renderTier('operating_revenue', operatingRevenue)}
                      {renderTier('cost_of_revenue', costOfRevenue)}
                      {renderProfitRow('LABA KOTOR', grossProfit)}
                      {renderTier('operating_expense', operatingExpense)}
                      {renderProfitRow('LABA OPERASIONAL', operatingProfit)}
                      {renderTier('other_income', otherIncome)}
                      {renderTier('other_expense', otherExpense)}
                      {renderProfitRow('LABA BERSIH', netProfit)}
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
