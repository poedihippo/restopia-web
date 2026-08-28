'use client'

import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { reportsService } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'

export default function JournalEntriesView() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isPosted, setIsPosted] = useState<'' | 'true' | 'false'>('')

  const { mutate: exportExcel, isPending } = useMutation({
    mutationFn: () => reportsService.exportJournalEntries({
      ...(startDate ? { start_date: startDate } : {}),
      ...(endDate ? { end_date: endDate } : {}),
      ...(isPosted !== '' ? { is_posted: isPosted === 'true' } : {}),
    }),
    onSuccess: (res) => {
      downloadFileFromResponse(res, `journal-entries.xlsx`)
    },
    onError: () => toast.error('Gagal mengekspor data.')
  })

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Journal Entries</h1>
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Export Journal Entries report to Excel</p>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Status (Optional)</label>
            <select
              value={isPosted}
              onChange={(e) => setIsPosted(e.target.value as any)}
              style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none', fontSize: 14 }}
            >
              <option value="">All</option>
              <option value="true">Posted</option>
              <option value="false">Draft</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Start Date (Optional)</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 'var(--radius-md)', background: '#ffffff', color: '#111827', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>End Date (Optional)</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 'var(--radius-md)', background: '#ffffff', color: '#111827', outline: 'none' }} />
          </div>
          <button
            onClick={() => exportExcel()}
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
