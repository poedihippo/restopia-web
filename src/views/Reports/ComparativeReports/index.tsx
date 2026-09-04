'use client'

import React, { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { reportsService } from '@/services/reports.service'
import { fiscalYearsService } from '@/services/accounting.service'
import { customersService } from '@/services/customers.service'
import { suppliersService } from '@/services/suppliers.service'
import { downloadFileFromResponse } from '@/utils/file'
import { toastMutationApiError } from '@/utils/apiError'
import SearchableSelect from '@/components/SearchableSelect'
import {
  TrendingUp,
  Scale,
  CreditCard,
  Building,
  Download,
  Loader2,
  Calendar,
} from 'lucide-react'

export default function ComparativeReportsView() {
  const currentYear = new Date().getFullYear()
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  // Query Fiscal Years
  const { data: fiscalYearsData } = useQuery({
    queryKey: ['fiscal-years-select'],
    queryFn: () => fiscalYearsService.list({ per_page: 50, sort: '-id' } as any).then((r) => r.data),
  })
  const fiscalYears: any[] = (fiscalYearsData as any)?.data ?? []
  const fiscalYearOptions = fiscalYears.map((fy) => ({
    value: fy.id,
    label: `${fy.name} (${fy.start_date} ~ ${fy.end_date})`,
  }))

  // Query Customers for AR Card
  const { data: customersData } = useQuery({
    queryKey: ['customers-select-ar'],
    queryFn: () => customersService.list({ per_page: 200 } as any).then((r) => r.data),
  })
  const customers: any[] = (customersData as any)?.data ?? []
  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: `${c.name} ${c.phone ? `(${c.phone})` : ''}`,
  }))

  // Query Suppliers for AP Card
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-select-ap'],
    queryFn: () => suppliersService.list({ per_page: 200 } as any).then((r) => r.data),
  })
  const suppliers: any[] = (suppliersData as any)?.data ?? []
  const supplierOptions = suppliers.map((s) => ({
    value: s.name ?? String(s.id),
    label: s.name,
  }))

  // Card 1: Comparative Income Statement
  const [lrFiscalYearId, setLrFiscalYearId] = useState<number | undefined>(undefined)
  const [lrYear, setLrYear] = useState<number>(currentYear)

  // Card 2: Comparative Balance Sheet
  const [bsFiscalYearId, setBsFiscalYearId] = useState<number | undefined>(undefined)
  const [bsYear, setBsYear] = useState<number>(currentYear)

  // Card 3: AR Card
  const [arCustomerId, setArCustomerId] = useState<number | undefined>(undefined)
  const [arStartDate, setArStartDate] = useState(firstDay)
  const [arEndDate, setArEndDate] = useState(todayStr)

  // Card 4: AP Card
  const [apSupplier, setApSupplier] = useState<string>('')
  const [apStartDate, setApStartDate] = useState(firstDay)
  const [apEndDate, setApEndDate] = useState(todayStr)

  // Export Mutations
  const exportLrMutation = useMutation({
    mutationFn: () =>
      reportsService.exportComparativeIncomeStatement({
        fiscal_year_id: lrFiscalYearId,
        year: !lrFiscalYearId ? lrYear : undefined,
      }),
    onSuccess: (res) => {
      downloadFileFromResponse(res, `comparative-income-statement-${lrYear}.xlsx`)
      toast.success('12-month Comparative Income Statement downloaded')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to export comparative income statement'),
  })

  const exportBsMutation = useMutation({
    mutationFn: () =>
      reportsService.exportComparativeBalanceSheet({
        fiscal_year_id: bsFiscalYearId,
        year: !bsFiscalYearId ? bsYear : undefined,
      }),
    onSuccess: (res) => {
      downloadFileFromResponse(res, `comparative-balance-sheet-${bsYear}.xlsx`)
      toast.success('12-month Comparative Balance Sheet downloaded')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to export comparative balance sheet'),
  })

  const exportArMutation = useMutation({
    mutationFn: () => {
      if (!arCustomerId) throw new Error('Please select a customer')
      return reportsService.exportArCard({
        customer_id: arCustomerId,
        start_date: arStartDate || undefined,
        end_date: arEndDate || undefined,
      })
    },
    onSuccess: (res) => {
      downloadFileFromResponse(res, `ar-card-customer-${arCustomerId}.xlsx`)
      toast.success('Customer AR Card downloaded')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to export AR card'),
  })

  const exportApMutation = useMutation({
    mutationFn: () => {
      if (!apSupplier) throw new Error('Please select or enter a supplier')
      return reportsService.exportApCard({
        supplier: apSupplier,
        start_date: apStartDate || undefined,
        end_date: apEndDate || undefined,
      })
    },
    onSuccess: (res) => {
      downloadFileFromResponse(res, `ap-card-${apSupplier}.xlsx`)
      toast.success('Supplier AP Card downloaded')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to export AP card'),
  })

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface-raised, #ffffff)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--foreground-muted)',
    marginBottom: 4,
    display: 'block',
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: 'var(--shadow-sm)',
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            fontWeight: 600,
            color: 'var(--foreground)',
            margin: 0,
          }}
        >
          Comparative Reports & Subledger Cards
        </h1>
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
          Export multi-month financial comparative statements (12 Bulan) and subledger accounts (Kartu Piutang & Hutang)
        </p>
      </div>

      {/* Grid of Report Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
        {/* Card 1: Comparative Income Statement */}
        <div style={cardStyle}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--success-bg, #f0fdf4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--success, #16a34a)',
                }}
              >
                <TrendingUp size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
                  LR 12 Bulan (Comparative Income Statement)
                </h3>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  12-month revenue, cost, and profit comparison
                </span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              View monthly performance side-by-side across all 12 periods of the selected fiscal year or calendar year.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>Fiscal Year (Optional)</label>
                <SearchableSelect
                  value={lrFiscalYearId || ''}
                  onChange={(val) => setLrFiscalYearId(val ? Number(val) : undefined)}
                  options={fiscalYearOptions}
                  placeholder="Select Fiscal Year (or specify Year below)"
                />
              </div>

              <div>
                <label style={labelStyle}>Year</label>
                <input
                  type="number"
                  value={lrYear}
                  onChange={(e) => setLrYear(Number(e.target.value))}
                  style={inputStyle}
                  min={2020}
                  max={2030}
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => exportLrMutation.mutate()}
            disabled={exportLrMutation.isPending}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: exportLrMutation.isPending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: 'var(--shadow-sm)',
              opacity: exportLrMutation.isPending ? 0.75 : 1,
            }}
          >
            {exportLrMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Download LR 12 Bulan XLSX
          </button>
        </div>

        {/* Card 2: Comparative Balance Sheet */}
        <div style={cardStyle}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--info-bg, #eff6ff)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--info, #2563eb)',
                }}
              >
                <Scale size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
                  Neraca 12 Bulan (Comparative Balance Sheet)
                </h3>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  12-month asset, liability, and equity trends
                </span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Compare cumulative balance sheets period-by-period for deep liquidity and capital tracking.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>Fiscal Year (Optional)</label>
                <SearchableSelect
                  value={bsFiscalYearId || ''}
                  onChange={(val) => setBsFiscalYearId(val ? Number(val) : undefined)}
                  options={fiscalYearOptions}
                  placeholder="Select Fiscal Year (or specify Year below)"
                />
              </div>

              <div>
                <label style={labelStyle}>Year</label>
                <input
                  type="number"
                  value={bsYear}
                  onChange={(e) => setBsYear(Number(e.target.value))}
                  style={inputStyle}
                  min={2020}
                  max={2030}
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => exportBsMutation.mutate()}
            disabled={exportBsMutation.isPending}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: exportBsMutation.isPending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: 'var(--shadow-sm)',
              opacity: exportBsMutation.isPending ? 0.75 : 1,
            }}
          >
            {exportBsMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Download Neraca 12 Bulan XLSX
          </button>
        </div>

        {/* Card 3: AR Card */}
        <div style={cardStyle}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-light-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                }}
              >
                <CreditCard size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
                  Kartu Piutang (AR Card per Customer)
                </h3>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  Receivables ledger & transaction history
                </span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Export complete debtor movement: beginning balance, sales invoices, settlements, and running balance.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>
                  Customer
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <SearchableSelect
                  value={arCustomerId || ''}
                  onChange={(val) => setArCustomerId(val ? Number(val) : undefined)}
                  options={customerOptions}
                  placeholder="Select Customer..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input
                    type="date"
                    value={arStartDate}
                    onChange={(e) => setArStartDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>End Date</label>
                  <input
                    type="date"
                    value={arEndDate}
                    onChange={(e) => setArEndDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => exportArMutation.mutate()}
            disabled={exportArMutation.isPending || !arCustomerId}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: exportArMutation.isPending || !arCustomerId ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: 'var(--shadow-sm)',
              opacity: exportArMutation.isPending || !arCustomerId ? 0.6 : 1,
            }}
          >
            {exportArMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Download Kartu Piutang XLSX
          </button>
        </div>

        {/* Card 4: AP Card */}
        <div style={cardStyle}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--warning-bg, #fffbeb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--warning, #d97706)',
                }}
              >
                <Building size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
                  Kartu Hutang (AP Card per Supplier)
                </h3>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  Payables ledger & supplier reconciliation
                </span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Export complete vendor movement: beginning payables, purchase invoices, payments, and ending balances.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>
                  Supplier
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <SearchableSelect
                  value={apSupplier || ''}
                  onChange={(val) => setApSupplier(val ? String(val) : '')}
                  options={supplierOptions}
                  placeholder="Select Supplier..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input
                    type="date"
                    value={apStartDate}
                    onChange={(e) => setApStartDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>End Date</label>
                  <input
                    type="date"
                    value={apEndDate}
                    onChange={(e) => setApEndDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => exportApMutation.mutate()}
            disabled={exportApMutation.isPending || !apSupplier}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: exportApMutation.isPending || !apSupplier ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: 'var(--shadow-sm)',
              opacity: exportApMutation.isPending || !apSupplier ? 0.6 : 1,
            }}
          >
            {exportApMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Download Kartu Hutang XLSX
          </button>
        </div>
      </div>
    </div>
  )
}
