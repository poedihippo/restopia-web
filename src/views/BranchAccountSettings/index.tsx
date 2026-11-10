'use client'
import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { branchAccountSettingsService } from '@/services/branch-account-settings.service'
import { branchesService } from '@/services/branches.service'
import { useAuth } from '@/hooks/useAuth'
import BranchAccountSettingSheet from './BranchAccountSettingSheet'
import { toastMutationApiError } from '@/utils/apiError'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { formatDate } from '@/utils/date'
import { Plus, Search, Pencil, Trash2, Building2, Filter } from 'lucide-react'

export default function BranchAccountSettingsView() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('branch-account-setting.create')
  const canEdit = hasPermission('branch-account-setting.update')
  const canDelete = hasPermission('branch-account-setting.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [branchFilter, setBranchFilter] = useState<number | ''>('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<any | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [debouncedSearch, branchFilter])

  const { data: branchesData } = useQuery({
    queryKey: ['branches-all', 'by-name'],
    queryFn: () => branchesService.list({ per_page: 200, sort: 'name' } as any).then(r => r.data),
  })
  const allBranches: any[] = (branchesData as any)?.data ?? []

  const { data, isLoading, isError } = useQuery({
    queryKey: ['branch-account-settings', page, perPage, debouncedSearch, branchFilter],
    queryFn: () =>
      branchAccountSettingsService
        .list({
          page,
          per_page: perPage,
          sort: '-created_at',
          include: 'branch,chart_of_account,account_setting_key',
          'filter[search]': debouncedSearch || undefined,
          'filter[branch_id]': branchFilter || undefined,
        } as any)
        .then((r) => r.data),
  })

  const items: any[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => branchAccountSettingsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-account-settings'] })
      toast.success('Account setting deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete account setting'),
  })

  const thStyle: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
  const inputBase: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--foreground)', background: 'var(--surface-raised)', outline: 'none', fontFamily: 'var(--font-sans)' }
  const actionBtnStyle: React.CSSProperties = { padding: 6, background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--foreground-muted)', display: 'flex' }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
            Branch Account Settings
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Configure per-branch journal account overrides
          </p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditData(null); setSheetOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <Plus size={15} />New Setting
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', maxWidth: 300, width: '100%' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search settings..." style={{ ...inputBase, width: '100%', padding: '8px 12px 8px 32px', fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <div style={{ position: 'relative', minWidth: 200 }}>
          <Filter size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-muted)', pointerEvents: 'none' }} />
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value ? Number(e.target.value) : '')} style={{ ...inputBase, width: '100%', padding: '8px 12px 8px 32px', fontSize: 13, boxSizing: 'border-box', appearance: 'none' }}>
            <option value="">All Branches</option>
            {allBranches.map((b: any) => (
              <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={thStyle}>Branch</th>
              <th style={thStyle}>Account Key</th>
              <th style={thStyle}>Chart of Account</th>
              <th style={{ ...thStyle, width: 180 }}>COA Code</th>
              <th style={thStyle}>Description</th>
              <th style={{ ...thStyle, width: 120 }}>Created</th>
              <th style={{ ...thStyle, width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} style={tdStyle}>
                      <div style={{ height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--border)', width: j === 7 ? 60 : '75%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}><span style={{ fontSize: 14, color: 'var(--destructive)' }}>Failed to load settings.</span></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--foreground-muted)' }}>
                  <Building2 size={32} style={{ opacity: 0.4 }} />
                  <span style={{ fontSize: 14 }}>No branch account settings found</span>
                </div>
              </td></tr>
            ) : (
              items.map((item: any, idx: number) => {
                const keyInfo = item.account_setting_key_entity
                return (
                  <tr key={item.id} style={{ transition: 'background 120ms' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>{(page - 1) * perPage + idx + 1}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{item.branch?.name || '—'}</span>
                        <span style={{ fontSize: 11, color: 'var(--foreground-muted)', fontFamily: 'monospace' }}>{item.branch?.code || ''}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{keyInfo?.label || item.account_setting_key || `Key #${item.account_setting_key_id}`}</span>
                        <span style={{ fontSize: 11, color: 'var(--foreground-muted)', fontFamily: 'monospace' }}>{keyInfo?.key || item.account_setting_key || ''}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      {item.chart_of_account ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{item.chart_of_account.name}</span>
                          <span style={{ fontSize: 12, color: 'var(--foreground-muted)', fontFamily: 'monospace' }}>{item.chart_of_account.code}</span>
                        </div>
                      ) : <span style={{ fontSize: 13, color: 'var(--foreground-muted)', fontStyle: 'italic' }}>Not set</span>}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--foreground-muted)' }}>{item.chart_of_account?.code || '—'}</span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 13, color: 'var(--foreground-muted)' }}>{item.description || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{item.created_at ? formatDate(item.created_at) : '—'}</span>
                    </td>
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
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

      {deleteConfirmId !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDeleteConfirmId(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
          <div style={{ position: 'relative', zIndex: 70, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', width: 380, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>Delete Setting</h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>This will remove the account mapping for this branch.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ padding: '7px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending} style={{ padding: '7px 16px', background: 'var(--destructive)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', opacity: deleteMutation.isPending ? 0.7 : 1 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <BranchAccountSettingSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setTimeout(() => setEditData(null), 200) }}
        editData={editData}
      />
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}
