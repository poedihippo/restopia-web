'use client'

import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SlidersHorizontal } from 'lucide-react'
import { FilterBar } from '@/components/ListFilters'
import { useAuth } from '@/hooks/useAuth'
import { formatDateTime } from '@/utils/date'
import { companySettingsService, type CompanySetting } from '@/services/company-settings.service'
import CompanySettingSheet, { companySettingLabel } from './CompanySettingSheet'

const PER_PAGE = 20

export default function CompanySettingsView() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('company-setting.create')
  const canEdit = hasPermission('company-setting.update')
  const canDelete = hasPermission('company-setting.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<CompanySetting | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CompanySetting | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['company-settings', page, debouncedSearch],
    queryFn: () =>
      companySettingsService
        .list({
          page,
          per_page: PER_PAGE,
          sort: 'key',
          include: 'updated_by',
          'filter[search]': debouncedSearch || undefined,
        })
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching
  // The list envelope is either { data: [], meta } or { data: { data: [], meta } }.
  const d = data as any
  const items: CompanySetting[] = Array.isArray(d?.data) ? d.data : d?.data?.data ?? []
  const meta = d?.meta ?? d?.data?.meta
  const lastPage: number = meta?.last_page ?? meta?.total_pages ?? 1
  const existingKeys = items.map((i) => i.key)

  const { mutate: doDelete, isPending: deleting } = useMutation({
    mutationFn: (id: number) => companySettingsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-settings'] })
      toast.success('Setting deleted')
      setDeleteTarget(null)
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to delete setting'),
  })

  const openCreate = () => {
    setEditData(null)
    setSheetOpen(true)
  }

  const thStyle: React.CSSProperties = {
    padding: '14px 20px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  }
  const tdStyle: React.CSSProperties = {
    padding: '16px 20px',
    fontSize: 14,
    color: 'var(--foreground)',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
  }
  const smallBtn: React.CSSProperties = {
    height: 32,
    fontSize: 12,
    padding: '0 14px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface)',
    color: 'var(--foreground)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
  const pageBtn = (disabled: boolean): React.CSSProperties => ({
    height: 32,
    padding: '0 12px',
    fontSize: 13,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface)',
    color: 'var(--foreground)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  })

  return (
    <div style={{ padding: '32px 40px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
            Company Settings
          </h1>
          <p style={{ color: 'var(--foreground-muted)', fontSize: 14, marginTop: 4 }}>
            Company-wide options for the active company
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={openCreate}
            style={{
              height: 40,
              padding: '0 20px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            + Add Setting
          </button>
        )}
      </div>

      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search settings..." />

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '30%' }}>Setting</th>
              <th style={{ ...thStyle, width: '12%' }}>Value</th>
              <th style={thStyle}>Description</th>
              <th style={{ ...thStyle, width: '16%' }}>Updated</th>
              {(canEdit || canDelete) && <th style={{ ...thStyle, width: 170 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: canEdit || canDelete ? 5 : 4 }).map((__, j) => (
                    <td key={j} style={tdStyle}>
                      <div style={{ height: 16, background: 'var(--border)', borderRadius: 4, opacity: 0.5 }} />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading && isError && (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: 40, color: 'var(--destructive)' }}>
                  Failed to load company settings.
                </td>
              </tr>
            )}
            {!isLoading && !isError && items.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: 48 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <SlidersHorizontal size={32} style={{ color: 'var(--border-strong)' }} />
                    <div style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>
                      {debouncedSearch ? 'No settings match your search.' : 'No company settings yet. Defaults apply until you add one.'}
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {!isLoading &&
              items.map((item) => {
                const label = companySettingLabel(item.key)
                return (
                  <tr key={item.id}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontWeight: 600 }}>{label ?? item.key}</span>
                        {label && (
                          <span style={{ fontSize: 12, color: 'var(--foreground-muted)', fontFamily: 'monospace' }}>{item.key}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 13 }}>{item.value || '—'}</td>
                    <td style={{ ...tdStyle, fontSize: 13, color: 'var(--foreground-muted)' }}>{item.description || '—'}</td>
                    <td style={{ ...tdStyle, fontSize: 13, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
                      <div>{item.updated_at ? formatDateTime(item.updated_at) : '—'}</div>
                      {item.updated_by?.name && <div style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>{item.updated_by.name}</div>}
                    </td>
                    {(canEdit || canDelete) && (
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditData(item)
                                setSheetOpen(true)
                              }}
                              style={smallBtn}
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              style={{ ...smallBtn, border: '1px solid var(--destructive)', background: 'transparent', color: 'var(--destructive)' }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {lastPage > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={pageBtn(page <= 1)}>
            Prev
          </button>
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
            Page {page} of {lastPage}
          </span>
          <button type="button" aria-label="Next page" disabled={page >= lastPage} onClick={() => setPage((p) => Math.min(lastPage, p + 1))} style={pageBtn(page >= lastPage)}>
            Next
          </button>
        </div>
      )}

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="presentation" onClick={() => !deleting && setDeleteTarget(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 420,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              padding: 24,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--foreground)' }}>Delete setting?</h3>
            <p style={{ margin: '8px 0 20px', fontSize: 14, color: 'var(--foreground-muted)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--foreground)' }}>{companySettingLabel(deleteTarget.key) ?? deleteTarget.key}</strong> will be removed and
              its default behaviour applies again.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} style={{ ...smallBtn, height: 36 }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => doDelete(deleteTarget.id)}
                disabled={deleting}
                style={{
                  ...smallBtn,
                  height: 36,
                  border: 'none',
                  background: 'var(--destructive)',
                  color: 'white',
                  opacity: deleting ? 0.7 : 1,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CompanySettingSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setTimeout(() => setEditData(null), 200)
        }}
        editData={editData}
        existingKeys={existingKeys}
      />
    </div>
  )
}
