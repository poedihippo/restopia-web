import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'

interface Meta {
  last_page?: number
  total_pages?: number
  total?: number
}

interface CustomPaginationProps {
  page: number
  setPage: (val: number | ((prev: number) => number)) => void
  perPage: number
  setPerPage: (val: number) => void
  meta?: Meta
}

export function CustomPagination({ page, setPage, perPage, setPerPage, meta }: CustomPaginationProps) {
  if (!meta) return null

  const totalPages = meta.last_page ?? meta.total_pages ?? 1
  if (totalPages <= 1 && meta.total === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Per Page:</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {[50, 100, 300, 1000].map(size => (
              <button
                key={size}
                onClick={() => { setPerPage(size); setPage(1); }}
                style={{ 
                  padding: '4px 10px', 
                  border: '1px solid var(--border)', 
                  borderRadius: 'var(--radius-sm)', 
                  background: perPage === size ? 'var(--accent)' : 'var(--surface)', 
                  color: perPage === size ? 'white' : 'var(--foreground)', 
                  fontSize: 12, 
                  cursor: 'pointer',
                  transition: 'background 150ms'
                }}
              >
                {size}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Custom:</span>
            <input 
              type="number"
              value={perPage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 0) {
                  setPerPage(val);
                } else if (e.target.value === '') {
                  // Allow empty input while typing
                  setPerPage(0 as any);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (perPage > 0) setPage(1);
                }
              }}
              onBlur={() => {
                if (!perPage || perPage <= 0) {
                  setPerPage(100);
                  setPage(1);
                } else {
                  setPage(1);
                }
              }}
              style={{ width: 60, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, background: 'var(--surface)', color: 'var(--foreground)' }}
            />
          </div>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button 
              onClick={() => setPage((p) => Math.max(1, p - 1))} 
              disabled={page === 1} 
              style={{ 
                display: 'flex', alignItems: 'center', padding: '6px 10px', 
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                background: 'var(--surface)', 
                color: page === 1 ? 'var(--foreground-subtle)' : 'var(--foreground)', 
                cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 13 
              }}
            >
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Page {page} of {totalPages}</span>
            <button 
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
              disabled={page === totalPages} 
              style={{ 
                display: 'flex', alignItems: 'center', padding: '6px 10px', 
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', 
                background: 'var(--surface)', 
                color: page === totalPages ? 'var(--foreground-subtle)' : 'var(--foreground)', 
                cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: 13 
              }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
