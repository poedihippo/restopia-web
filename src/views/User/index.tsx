'use client'
import { formatCurrency } from '@/utils/price';
import { formatDateTime } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usersService } from '@/services/users.service'
import { branchesService } from '@/services/branches.service'
import { departmentsService } from '@/services/departments.service'
import { useAuth } from '@/hooks/useAuth'
import UserSheet from './UserSheet'
import { toastMutationApiError } from '@/utils/apiError';
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Users,
  Eye,
  X,
} from 'lucide-react'
import { FilterBar, FilterSelect, countActive } from '@/components/ListFilters'

interface User {
  id: number
  name: string
  email: string
  nik?: string
  type?: 'superadmin' | 'user'
  phone?: string
  birth?: string
  gender?: 'male' | 'female'
  credit?: number
  created_at?: string
  branch?: { id: number; name: string }
  branches?: Array<{ id: number; name: string }>
  departments?: Array<{ id: number; name: string; code?: string }>
  roles?: Array<{ id: number; name: string }>
  branch_ids?: number[]
  department_ids?: number[]
  role_ids?: number[]
}

const TYPE_META: Record<
  'superadmin' | 'user',
  { label: string; color: string; bg: string }
> = {
  superadmin: { label: 'Superadmin', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  user: { label: 'User', color: 'var(--info)', bg: 'var(--info-bg)' },
}

export default function UsersView() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission("user.read");
  const canCreate = hasPermission('user.create')
  const canEdit = hasPermission('user.update')
  const canDelete = hasPermission('user.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [typeFilter, setTypeFilter] = useState<'' | 'superadmin' | 'user'>('')
  const [branchFilter, setBranchFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const canReadBranches = hasPermission('branch.read')
  const canReadDepartments = hasPermission('department.read')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<User | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<User | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, typeFilter, branchFilter, departmentFilter])

  // Filter lookups (same queryFn as UserSheet for the shared branches key)
  const { data: branchesData } = useQuery({
    queryKey: ['branches-all', 'with-company'],
    queryFn: () => branchesService.list({ per_page: 1000, sort: 'name', include: 'company' } as any).then((r) => r.data),
    enabled: canReadBranches,
  })
  const branchOptions: { id: number; name: string }[] = (branchesData as any)?.data ?? []

  const { data: departmentsData } = useQuery({
    queryKey: ['departments-all'],
    queryFn: () => departmentsService.list({ per_page: 100 } as any).then((r) => r.data),
    enabled: canReadDepartments,
  })
  const departmentOptions: { id: number; name: string }[] = (departmentsData as any)?.data ?? []


  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['users', page, perPage, debouncedSearch, typeFilter, branchFilter, departmentFilter],
    queryFn: () =>
      usersService
        .list({
          page,
          per_page: perPage,
          include: 'branch,branches,roles,departments',
          sort: '-created_at',
          'filter[search]': debouncedSearch || undefined,
          'filter[type]': typeFilter || undefined,
          'filter[branch_id]': branchFilter || undefined,
          'filter[department_id]': departmentFilter || undefined,
        } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const items: User[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete user'),
  })

  const openEdit = (item: User) => {
    const branchIds =
      (item.branches ?? []).map((b) => b.id).filter((id) => typeof id === 'number')
    const fallback = item.branch ? [item.branch.id] : []
    const deptIds = (item.departments ?? []).map((d) => d.id).filter((id) => typeof id === 'number')
    setEditData({
      ...item,
      credit: item.credit ?? 0,
      branch_ids: branchIds.length > 0 ? branchIds : fallback,
      department_ids: deptIds,
      role_ids: (item.roles ?? []).map((r) => r.id),
    })
    setSheetOpen(true)
  }

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

  const badge = (bg: string, color: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 600,
    background: bg,
    color,
  })

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
            Users
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Manage system users and their access
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
          <Plus size={15} />New User
                              </button>)}
      </div>
      {/* Toolbar */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search users..."
        activeCount={countActive(typeFilter, branchFilter, departmentFilter)}
        onClear={() => {
          setTypeFilter('')
          setBranchFilter('')
          setDepartmentFilter('')
          setPage(1)
        }}
        quick={
          <>
            <FilterSelect
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as '' | 'superadmin' | 'user')}
            >
              <option value="">All Types</option>
              <option value="user">User</option>
              <option value="superadmin">Superadmin</option>
            </FilterSelect>
            {canReadBranches && (
              <FilterSelect value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
                <option value="">All Branches</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </FilterSelect>
            )}
            {canReadDepartments && (
              <FilterSelect value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                <option value="">All Departments</option>
                {departmentOptions.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name}
                  </option>
                ))}
              </FilterSelect>
            )}
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
              <th style={thStyle}>Name</th>
              <th style={{ ...thStyle, width: 200 }}>Email</th>
              <th style={{ ...thStyle, width: 110 }}>Type</th>
              <th style={{ ...thStyle, width: 150 }}>Branch</th>
              <th style={{ ...thStyle, width: 170 }}>Departments</th>
              <th style={{ ...thStyle, width: 180 }}>Roles</th>
              <th style={{ ...thStyle, width: 140 }}>Phone</th>
              <th style={{ ...thStyle, width: 120 }}>Credit</th>
              <th style={{ ...thStyle, width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 10 }).map((__, j) => (
                    <td key={j} style={tdStyle}>
                      <div
                        style={{
                          height: 14,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--border)',
                          width: j === 9 ? 60 : '75%',
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td colSpan={10} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                  <span style={{ fontSize: 14, color: 'var(--destructive)' }}>
                    Failed to load users.
                  </span>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    <Users size={32} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: 14 }}>No users found</span>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const typeKey = (item.type ?? 'user') as 'superadmin' | 'user'
                const typeMeta = TYPE_META[typeKey]
                const rolesList = item.roles ?? []
                return (
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: 'var(--foreground)',
                          }}
                        >
                          {item.name}
                        </span>
                        {item.nik && (
                          <span
                            style={{
                              fontSize: 11,
                              fontFamily: 'monospace',
                              color: 'var(--foreground-muted)',
                            }}
                          >
                            {item.nik}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontSize: 13,
                          color: 'var(--foreground-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.email}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {canRead ? typeMeta ? (
                        <span style={badge(typeMeta.bg, typeMeta.color)}>{typeMeta.label}</span>
                      ) : (
                        <span style={badge('var(--background)', 'var(--foreground-muted)')}>—</span>
                      ) : "***"}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        {item.branch?.name ?? '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {canRead ? (item.departments ?? []).length === 0 ? (
                        <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>—</span>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 4,
                            alignItems: 'center',
                          }}
                        >
                          {(item.departments ?? []).slice(0, 2).map((dept) => (
                            <span
                              key={dept.id}
                              style={{
                                padding: '1px 8px',
                                background: 'var(--accent-light-bg)',
                                color: 'var(--accent)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 11,
                                fontWeight: 500,
                              }}
                            >
                              {dept.name}
                            </span>
                          ))}
                          {(item.departments ?? []).length > 2 && (
                            <span
                              style={{ fontSize: 11, color: 'var(--foreground-muted)' }}
                            >
                              +{(item.departments ?? []).length - 2} more
                            </span>
                          )}
                        </div>
                      ) : '***'}
                    </td>
                    <td style={tdStyle}>
                      {canRead ? rolesList.length === 0 ? (
                        <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>—</span>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 4,
                            alignItems: 'center',
                          }}
                        >
                          {rolesList.slice(0, 2).map((role) => (
                            <span
                              key={role.id}
                              style={{
                                padding: '1px 8px',
                                background: 'var(--accent-light-bg)',
                                color: 'var(--accent)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 11,
                                fontWeight: 500,
                              }}
                            >
                              {role.name}
                            </span>
                          ))}
                          {rolesList.length > 2 && (
                            <span
                              style={{ fontSize: 11, color: 'var(--foreground-muted)' }}
                            >
                              +{rolesList.length - 2} more
                            </span>
                          )}
                        </div>
                      ) : "***"}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        {item.phone ?? '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color:
                            item.credit && item.credit > 0
                              ? 'var(--success)'
                              : 'var(--foreground-muted)',
                        }}
                      >
                        {item.credit
                          ? formatCurrency(item.credit)
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
                        {canEdit && (<button onClick={() => openEdit(item)} style={actionBtnStyle} title="Edit">
                          <Pencil size={14} />
                        </button>)}
                        {canDelete && (<button
                          onClick={() => setDeleteConfirmId(item.id)}
                          style={{ ...actionBtnStyle, color: 'var(--destructive)' }}
                          title="Delete">
                          <Trash2 size={14} />
                        </button>)}
                      </div>
                    </td>
                  </tr>
                );
              })
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
              Delete User
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>
              This will permanently remove the user account.
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
                User Detail
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
                { label: 'Name', value: selectedItem.name },
                { label: 'Email', value: selectedItem.email },
                { label: 'NIK', value: selectedItem.nik },
                { label: 'Type', value: selectedItem.type },
                { label: 'Phone', value: selectedItem.phone },
                { label: 'Birth', value: selectedItem.birth },
                { label: 'Gender', value: selectedItem.gender },
                { label: 'Branch', value: selectedItem.branch?.name },
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--foreground-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                  }}
                >
                  Departments
                </span>
                {(selectedItem.departments ?? []).length === 0 ? (
                  <span style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>—</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(selectedItem.departments ?? []).map((d) => (
                      <span
                        key={d.id}
                        style={{
                          padding: '2px 10px',
                          background: 'var(--accent-light-bg)',
                          color: 'var(--accent)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        {d.code ? `[${d.code}] ` : ''}{d.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--foreground-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                  }}
                >
                  Roles
                </span>
                {(selectedItem.roles ?? []).length === 0 ? (
                  <span style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>—</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(selectedItem.roles ?? []).map((r) => (
                      <span
                        key={r.id}
                        style={{
                          padding: '2px 10px',
                          background: 'var(--accent-light-bg)',
                          color: 'var(--accent)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        {r.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--foreground-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                  }}
                >
                  Created At
                </span>
                <span style={{ fontSize: 14, color: 'var(--foreground)' }}>
                  {selectedItem.created_at
                    ? formatDateTime(selectedItem.created_at)
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Sheet */}
      <UserSheet
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
