'use client'
import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { buyersService } from '@/services/buyers.service'
import { useAuth } from '@/hooks/useAuth'
import BuyerSheet from './BuyerSheet'
import { toastMutationApiError } from '@/utils/apiError'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { formatDate } from '@/utils/date'
import { Plus, Search, Pencil, Trash2, UserRound } from 'lucide-react'

export default function BuyersView() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('buyer.create')
  const canEdit = hasPermission('buyer.update')
  const canDelete = hasPermission('buyer.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<any | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [debouncedSearch])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['buyers', page, perPage, debouncedSearch],
    queryFn: () =>
      buyersService
        .list({
          page,
          per_page: perPage,
          sort: '-created_at',
          'filter[search]': debouncedSearch || undefined,
        } as any)
        .then((r) => r.data),
  })

  const items: any[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => buyersService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['buyers'] })
      qc.invalidateQueries({ queryKey: ['buyers-all'] })
      toast.success('Buyer deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete buyer'),
  })

  const thStyle: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle', fontSize: 13, color: 'var(--foreground)' }
  const inputBase: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--foreground)', background: 'var(--surface-raised)', outline: 'none', fontFamily: 'var(--font-sans)' }
  const actionBtnStyle: React.CSSProperties = { padding: 6, background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--foreground-muted)', display: 'flex' }
  const COLS = 8

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
            Buyers
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Kelola buyer (pembeli) yang dipakai pada purchase order external
          </p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditData(null); setSheetOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <Plus size={15} />New Buyer
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', maxWidth: 300, width: '100%' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search buyers..." style={{ ...inputBase, width: '100%', padding: '8px 12px 8px 32px', fontSize: 13, boxSizing: 'border-box' }} />
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={thStyle}>Code</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>PIC</th>
              <th style={thStyle}>Phone</th>
              <th style={thStyle}>Email</th>
              <th style={{ ...thStyle, width: 120 }}>Created</th>
              <th style={{ ...thStyle, width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: COLS }).map((__, j) => (
                    <td key={j} style={tdStyle}>
                      <div style={{ height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--border)', width: j === COLS - 1 ? 60 : '75%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr><td colSpan={COLS} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}><span style={{ fontSize: 14, color: 'var(--destructive)' }}>Failed to load buyers.</span></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={COLS} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--foreground-muted)' }}>
                  <UserRound size={32} style={{ opacity: 0.4 }} />
                  <span style={{ fontSize: 14 }}>No buyers found</span>
                </div>
              </td></tr>
            ) : (
              items.map((item: any, idx: number) => (
                <tr key={item.id} style={{ transition: 'background 120ms' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)' }}>{(page - 1) * perPage + idx + 1}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{item.code || '—'}</td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{item.name || '—'}</td>
                  <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>{item.pic || '—'}</td>
                  <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>{item.phone || '—'}</td>
                  <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>{item.email || '—'}</td>
                  <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>{item.created_at ? formatDate(item.created_at) : '—'}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      {canEdit && (
                        <button onClick={() => { setEditData(item); setSheetOpen(true) }} style={actionBtnStyle} title="Edit">
                          <Pencil size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeleteConfirmId(item.id)} style={{ ...actionBtnStyle, color: 'var(--destructive)' }} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

      {deleteConfirmId !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDeleteConfirmId(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
          <div style={{ position: 'relative', zIndex: 70, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', width: 380, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>Delete Buyer</h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>This buyer will be removed. This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ padding: '7px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending} style={{ padding: '7px 16px', background: 'var(--destructive)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', opacity: deleteMutation.isPending ? 0.7 : 1 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <BuyerSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setTimeout(() => setEditData(null), 200) }}
        editData={editData}
      />
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}
