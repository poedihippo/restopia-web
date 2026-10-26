'use client'

import React, { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { reportsService } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import { chartOfAccountsService } from '@/services/accounting.service'

export default function GeneralLedgerView() {
  const [chartOfAccountId, setChartOfAccountId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data: coaData } = useQuery({
    queryKey: ['chart-of-accounts-all'],
    queryFn: () => chartOfAccountsService.list({ per_page: 1000, sort: 'code' } as any).then(r => r.data),
  })
  const accounts: any[] = (coaData as any)?.data ?? []

  const { mutate: exportExcel, isPending } = useMutation({
    mutationFn: () => reportsService.exportGeneralLedger({
      chart_of_account_id: Number(chartOfAccountId),
      start_date: startDate,
      end_date: endDate,
    }),
    onSuccess: (res) => {
      downloadFileFromResponse(res, `general-ledger.xlsx`)
    },
    onError: () => toast.error('Gagal mengekspor data.')
  })

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>General Ledger</h1>
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Export General Ledger drill-down to Excel</p>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Account *</label>
            <select
              value={chartOfAccountId}
              onChange={(e) => setChartOfAccountId(e.target.value)}
              style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none', fontSize: 14 }}
            >
              <option value="">-- Select Account --</option>
              {accounts.map((a: any) => (
                <option key={a.id} value={a.id}>{a.code} – {a.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Start Date *</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 'var(--radius-md)', background: '#ffffff', color: '#111827', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>End Date *</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 'var(--radius-md)', background: '#ffffff', color: '#111827', outline: 'none' }} />
          </div>
          <button
            onClick={() => {
              if (!chartOfAccountId) return toast.error('Please select an account')
              if (!startDate || !endDate) return toast.error('Start date and end date are required')
              exportExcel()
            }}
            disabled={isPending}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 500, cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1, marginTop: 8 }}
          >
            <Download size={16} /> {isPending ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>
    </div>
  )
}
