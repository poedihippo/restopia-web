'use client'
import { formatDate, formatDateTime } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { branchesService } from '@/services/branches.service'
import { companiesService } from '@/services/companies.service'
import { useAuth } from '@/hooks/useAuth'
import BranchSheet from './BranchSheet'
import { toastMutationApiError } from '@/utils/apiError';
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Building2,
  Check,
  Eye,
  X,
} from 'lucide-react'
import { FilterBar, FilterSelect, countActive } from '@/components/ListFilters'

interface Branch {
  id: number
  code: string
  name: string
  is_default?: boolean
  format?: 'premiere' | 'pickup_point'
  parent_id?: number | null
  address?: string | null
  type?: 'warehouse' | 'production' | 'outlet' | 'other'
  timezone?: string
  stock_display_mode?: 'base' | 'purchase' | null
  created_at?: string
}

export default function BranchesView() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission("branch.read");
  const canCreate = hasPermission('branch.create')
  const canEdit = hasPermission('branch.update')
  const canDelete = hasPermission('branch.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<Branch | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<Branch | null>(null)
  const [companyFilter, setCompanyFilter] = useState('')
  const [formatFilter, setFormatFilter] = useState('')
  const [parentFilter, setParentFilter] = useState('')
  const canReadCompanies = hasPermission('company.read')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, companyFilter, formatFilter, parentFilter])

  // Filter lookups
  const { data: companiesData } = useQuery({
    queryKey: ['companies-all'],
    queryFn: () => companiesService.list({ per_page: 100 } as any).then((r) => r.data),
    enabled: canReadCompanies,
  })
  const companyOptions: { id: number; name: string }[] = (companiesData as any)?.data ?? []

  const { data: parentBranchesData } = useQuery({
    queryKey: ['branches-all', 'by-name'],
    queryFn: () => branchesService.list({ per_page: 200, sort: 'name' } as any).then((r) => r.data),
    enabled: canRead,
  })
  const parentBranchOptions: { id: number; name: string }[] = (parentBranchesData as any)?.data ?? []


  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['branches', page, perPage, debouncedSearch, companyFilter, formatFilter, parentFilter],
    queryFn: () =>
      branchesService
        .list({
          page,
          per_page: perPage,
          sort: '-created_at',
          'filter[search]': debouncedSearch || undefined,
          'filter[company_id]': companyFilter || undefined,
          'filter[format]': formatFilter || undefined,
          'filter[parent_id]': parentFilter || undefined,
        } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const items: Branch[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => branchesService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] })
      qc.invalidateQueries({ queryKey: ['branches-all'] })
      toast.success('Branch deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete branch'),
  })

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
  }


  const actionBtnStyle: React.CSSProperties = {
    padding: 6,
    background: 'none',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    color: 'var(--foreground-muted)',
    display: 'flex',
  }

  const lastPage = meta?.last_page ?? meta?.total_pages ?? 1

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 600,
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            Branches
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Manage company branches and locations
          </p>
        </div>
        {canCreate && (<button
          onClick={() => {
            setEditData(null)
            setSheetOpen(true)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}>
          <Plus size={15} />New Branch
                              </button>)}
      </div>
      {/* Toolbar */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search branches..."
        activeCount={countActive(companyFilter, formatFilter, parentFilter)}
        onClear={() => {
          setCompanyFilter('')
          setFormatFilter('')
          setParentFilter('')
          setPage(1)
        }}
        quick={
          <>
            {canReadCompanies && (
              <FilterSelect
                value={companyFilter}
                onChange={(e) => {
                  setCompanyFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All Companies</option>
                {companyOptions.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </FilterSelect>
            )}
            <FilterSelect
              value={formatFilter}
              onChange={(e) => {
                setFormatFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All Formats</option>
              <option value="premiere">Premiere</option>
              <option value="pickup_point">Pickup Point</option>
            </FilterSelect>
            <FilterSelect
              value={parentFilter}
              onChange={(e) => {
                setParentFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All Parent Branches</option>
              {parentBranchOptions.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </FilterSelect>
          </>
        }
      />
      {/* Table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={{ ...thStyle, width: 120 }}>Code</th>
              <th style={thStyle}>Name</th>
              <th style={{ ...thStyle, width: 120 }}>Format</th>
              <th style={{ ...thStyle, width: 100 }}>Default</th>
              <th style={{ ...thStyle, width: 140 }}>Created</th>
              <th style={{ ...thStyle, width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} style={tdStyle}>
                      <div
                        style={{
                          height: 14,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--border)',
                          width: j === 6 ? 60 : '75%',
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                  <span style={{ fontSize: 14, color: 'var(--destructive)' }}>
                    Failed to load branches.
                  </span>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    <Building2 size={32} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: 14 }}>No branches found</span>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr
                  key={item.id}
                  style={{ transition: 'background 120ms' }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'var(--background)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'transparent')
                  }
                >
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13, width: 50 }}>
                    {(page - 1) * perPage + idx + 1}
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-light-bg)',
                        color: 'var(--accent)',
                        fontFamily: 'monospace',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {item.code}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--foreground)',
                      }}
                    >
                      {item.name}
                    </span>
                    {item.address && (
                      <div
                        title={item.address}
                        style={{
                          fontSize: 12,
                          color: 'var(--foreground-muted)',
                          marginTop: 2,
                          maxWidth: 360,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.address}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 11,
                        fontWeight: 600,
                        background: item.format === 'pickup_point' ? 'var(--info-bg)' : 'var(--accent-light-bg)',
                        color: item.format === 'pickup_point' ? 'var(--info)' : 'var(--accent)',
                      }}
                    >
                      {item.format === 'pickup_point' ? 'Pickup Point' : 'Premiere'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {canRead ? item.is_default ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 10px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 600,
                          background: 'var(--success-bg)',
                          color: 'var(--success)',
                        }}
                      >
                        <Check size={10} />
                        Default
                      </span>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--foreground-subtle)' }}>—</span>
                    ) : "***"}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                      {item.created_at
                        ? formatDate(item.created_at)
                        : '—'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        justifyContent: 'flex-end',
                      }}
                    >
                      <button
                        onClick={() => setSelectedItem(item)}
                        style={actionBtnStyle}
                        title="View"
                      >
                        <Eye size={14} />
                      </button>
                      {canEdit && (<button
                        onClick={() => {
                          setEditData(item)
                          setSheetOpen(true)
                        }}
                        style={actionBtnStyle}
                        title="Edit">
                        <Pencil size={14} />
                      </button>)}
                      {canDelete && (<button
                        onClick={() =>
                          !item.is_default && setDeleteConfirmId(item.id)
                        }
                        disabled={item.is_default}
                        style={{
                          ...actionBtnStyle,
                          color: item.is_default
                            ? 'var(--foreground-subtle)'
                            : 'var(--destructive)',
                          cursor: item.is_default ? 'not-allowed' : 'pointer',
                          opacity: item.is_default ? 0.5 : 1,
                        }}
                        title={
                          item.is_default
                            ? 'Cannot delete the default branch'
                            : 'Delete'
                        }>
                        <Trash2 size={14} />
                      </button>)}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
      {/* Delete confirm */}
      {deleteConfirmId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={() => setDeleteConfirmId(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 70,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px 28px 24px',
              width: 380,
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 17,
                fontWeight: 600,
                margin: '0 0 8px',
                color: 'var(--foreground)',
              }}
            >
              Delete Branch
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>
              Removing this branch may affect users and inventory assigned to it.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  padding: '7px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                style={{
                  padding: '7px 16px',
                  background: 'var(--destructive)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'white',
                  cursor: 'pointer',
                  opacity: deleteMutation.isPending ? 0.7 : 1,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Detail panel */}
      {selectedItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={() => setSelectedItem(null)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.18)',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 50,
              width: 420,
              height: '100%',
              background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 18,
                  fontWeight: 500,
                  margin: 0,
                  color: 'var(--foreground)',
                }}
              >
                Branch Detail
              </h2>
              <button
                onClick={() => setSelectedItem(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                }}
              >
                <X size={18} color="var(--foreground-muted)" />
              </button>
            </div>
            <div
              style={{
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {[
                { label: 'ID', value: selectedItem.id },
                { label: 'Code', value: selectedItem.code },
                { label: 'Name', value: selectedItem.name },
                { label: 'Address', value: selectedItem.address || '—' },
                { label: 'Type', value: selectedItem.type ?? '—' },
                { label: 'Format', value: selectedItem.format === 'pickup_point' ? 'Pickup Point' : 'Premiere' },
                { label: 'Timezone', value: selectedItem.timezone ?? '—' },
                { label: 'Stock Display', value: selectedItem.stock_display_mode === 'purchase' ? 'Purchase unit' : 'Base unit' },
                { label: 'Is Default', value: selectedItem.is_default ? 'Yes' : 'No' },
                {
                  label: 'Created At',
                  value: selectedItem.created_at
                    ? formatDateTime(selectedItem.created_at)
                    : '—',
                },
              ].map((f) => (
                <div
                  key={f.label}
                  style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--foreground-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                    }}
                  >
                    {f.label}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--foreground)' }}>
                    {f.value ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Sheet */}
      <BranchSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setEditData(null)
        }}
        editData={editData}
      />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
