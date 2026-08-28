'use client'

import React, { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { reportsService } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import { periodsService } from '@/services/accounting.service'

export default function BudgetVsActualView() {
  const [periodId, setPeriodId] = useState('')

  const { data: periodsData } = useQuery({
    queryKey: ['periods-all'],
    queryFn: () => periodsService.list({ per_page: 1000, sort: '-id' }).then(r => r.data),
  })
  const periods: any[] = (periodsData as any)?.data ?? []

  const { mutate: exportExcel, isPending } = useMutation({
    mutationFn: () => reportsService.exportBudgetVsActual({ period_id: Number(periodId) }),
    onSuccess: (res) => {
      downloadFileFromResponse(res, `budget-vs-actual.xlsx`)
    },
    onError: () => toast.error('Gagal mengekspor data.')
  })

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Budget vs Actual</h1>
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Export Budget vs Actual report to Excel</p>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Period *</label>
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none', fontSize: 14 }}
            >
              <option value="">-- Select Period --</option>
              {periods.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              if (!periodId) return toast.error('Please select a period')
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
