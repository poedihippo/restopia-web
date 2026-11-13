'use client'

import React, { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { reportsService } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import api from '@/hooks/useApi'
import FinancePeriodSelect from '../FinancePeriodSelect'

export default function CustomerStatementsView() {
  const [customerId, setCustomerId] = useState('')
  const [asOfDate, setAsOfDate] = useState('')

  const { data: customersData } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => api.get('/customers', { params: { per_page: 1000, sort: 'name' } }).then(r => r.data),
  })
  const customers: any[] = (customersData as any)?.data ?? []

  const { mutate: exportExcel, isPending } = useMutation({
    mutationFn: () => reportsService.exportCustomerStatements({
      customer_id: Number(customerId),
      ...(asOfDate ? { as_of_date: asOfDate } : {}),
    }),
    onSuccess: (res) => {
      downloadFileFromResponse(res, `customer-statement.xlsx`)
    },
    onError: () => toast.error('Gagal mengekspor data.')
  })

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Customer Statements</h1>
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Export Customer Statement report to Excel</p>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Customer *</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none', fontSize: 14 }}
            >
              <option value="">-- Select Customer --</option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Period end (Optional)</label>
            <FinancePeriodSelect asOf={asOfDate} onChange={(p) => setAsOfDate(p.end_date)} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 'var(--radius-md)', background: '#ffffff', color: '#111827', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>As Of Date (Optional)</label>
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 'var(--radius-md)', background: '#ffffff', color: '#111827', outline: 'none' }} />
          </div>
          <button
            onClick={() => {
              if (!customerId) return toast.error('Please select a customer')
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
