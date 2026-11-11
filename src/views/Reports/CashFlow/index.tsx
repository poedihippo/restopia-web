'use client'

import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { reportsService } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import FinanceBranchSelect, { financeBranchParam, type FinanceBranchScope } from '../FinanceBranchSelect'

export default function CashFlowView() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [branchScope, setBranchScope] = useState<FinanceBranchScope>('')

  const { mutate: exportExcel, isPending } = useMutation({
    mutationFn: () => reportsService.exportCashFlow({ start_date: startDate, end_date: endDate, ...financeBranchParam(branchScope) }),
    onSuccess: (res) => {
      downloadFileFromResponse(res, `cash-flow.xlsx`)
    },
    onError: () => toast.error('Gagal mengekspor data.')
  })

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Cash Flow</h1>
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Export Cash Flow report to Excel</p>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Start Date *</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 'var(--radius-md)', background: '#ffffff', color: '#111827', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>End Date *</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 'var(--radius-md)', background: '#ffffff', color: '#111827', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Branch</label>
            <FinanceBranchSelect value={branchScope} onChange={setBranchScope} style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', color: 'var(--foreground)', outline: 'none' }} />
          </div>
          <button 
            onClick={() => {
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
