'use client'
import { formatCurrency } from '@/utils/price';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usersService } from '@/services/users.service'
import { branchesService } from '@/services/branches.service'
import { departmentsService } from '@/services/departments.service'
import UserSheet from '@/views/User/UserSheet'
import { useAuth } from '@/hooks/useAuth'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  UserCheck,
  CreditCard,
  Building2,
} from 'lucide-react'
import { FilterBar, FilterSelect, countActive } from '@/components/ListFilters'

interface Employee {
  id: number
  name: string
  email: string
  nik?: string
  phone?: string
  credit?: number
  created_at?: string
  branch?: { id: number; name: string }
  branches?: Array<{ id: number; name: string }>
  departments?: Array<{ id: number; name: string }>
  roles?: Array<{ id: number; name: string }>
  branch_ids?: number[]
  department_ids?: number[]
  role_ids?: number[]
}

export default function EmployeesView() {
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
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<Employee | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [branchFilter, setBranchFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const canReadBranches = hasPermission('branch.read')
  const canReadDepartments = hasPermission('department.read')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, branchFilter, departmentFilter])

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
    queryKey: ['employees', page, perPage, debouncedSearch, branchFilter, departmentFilter],
    queryFn: () =>
      usersService
        .list({
          page,
          per_page: perPage,
          // branches + departments are needed so editing doesn't wipe them (PATCH replaces both lists).
          include: 'branch,branches,roles,departments',
          sort: '-created_at',
          'filter[type]': 'user',
          'filter[search]': debouncedSearch || undefined,
          'filter[branch_id]': branchFilter || undefined,
          'filter[department_id]': departmentFilter || undefined,
        } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const items: Employee[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employee removed')
      setDeleteConfirmId(null)
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? 'Failed to delete'),
  })

  const totalEmployees = meta?.total ?? items.length
  const withCredit = items.filter((e) => (e.credit ?? 0) > 0).length
  const totalCreditPool = items.reduce(
    (s, e) => s + (e.credit ?? 0),
    0,
  )

  const lastPage = meta?.last_page ?? meta?.total_pages ?? 1

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

  const statCardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  }

  const statIconBox: React.CSSProperties = {
    width: 36,
    height: 36,
    background: 'var(--accent-light-bg)',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }

  const openEdit = (item: Employee) => {
    const fallbackBranchIds =
      item.branches && item.branches.length > 0
        ? item.branches.map((b) => b.id)
        : item.branch
        ? [item.branch.id]
        : []
    setEditData({
      ...item,
      branch_ids: fallbackBranchIds,
      department_ids: (item.departments ?? []).map((d) => d.id).filter((id) => typeof id === 'number'),
      role_ids: (item.roles ?? []).map((r) => r.id),
    })
    setSheetOpen(true)
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          paddingBottom: 20,
          borderBottom: '1px solid var(--border)',
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 500,
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            Employees
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Manage employee accounts and credit limits
          </p>
        </div>
        {canCreate && (<button
          type="button"
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
          <Plus size={15} />New Employee
                              </button>)}
      </div>
      {/* Toolbar */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, email, NIK, or phone..."
        activeCount={countActive(branchFilter, departmentFilter)}
        onClear={() => {
          setBranchFilter('')
          setDepartmentFilter('')
          setPage(1)
        }}
        quick={
          <>
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
      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={statCardStyle}>
          <div style={statIconBox}>
            <UserCheck size={16} color="var(--accent-light)" />
          </div>
          <div>
            <span
              style={{
                fontSize: 22,
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: 'var(--foreground)',
                display: 'block',
                lineHeight: 1.1,
              }}
            >
              {totalEmployees}
            </span>
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
              Total Employees
            </span>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={statIconBox}>
            <CreditCard size={16} color="var(--accent-light)" />
          </div>
          <div>
            <span
              style={{
                fontSize: 22,
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: 'var(--foreground)',
                display: 'block',
                lineHeight: 1.1,
              }}
            >
              {withCredit}
            </span>
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
              Have Credit Limit
            </span>
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={statIconBox}>
            <CreditCard size={16} color="var(--accent-light)" />
          </div>
          <div>
            <span
              style={{
                fontSize: 22,
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: 'var(--success)',
                display: 'block',
                lineHeight: 1.1,
              }}
            >
              {formatCurrency(totalCreditPool)}
            </span>
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
              Total Credit Pool
            </span>
          </div>
        </div>
      </div>
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
          <thead style={{ background: 'var(--background)' }}>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={thStyle}>Employee</th>
              <th style={{ ...thStyle, width: 140 }}>NIK</th>
              <th style={{ ...thStyle, width: 160 }}>Branch</th>
              <th style={{ ...thStyle, width: 180 }}>Role(s)</th>
              <th style={{ ...thStyle, width: 140 }}>Phone</th>
              <th style={{ ...thStyle, width: 140 }}>Credit Limit</th>
              <th style={{ ...thStyle, width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} style={tdStyle}>
                      <div
                        style={{
                          height: 14,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--border)',
                          width: j === 7 ? 60 : '75%',
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td
                  colSpan={8}
                  style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}
                >
                  <span style={{ fontSize: 14, color: 'var(--destructive)' }}>
                    Failed to load employees.
                  </span>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    <UserCheck size={32} color="var(--border)" />
                    <span style={{ fontSize: 14 }}>No employees found</span>
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
                      <span
                        style={{ fontSize: 12, color: 'var(--foreground-muted)' }}
                      >
                        {item.email}
                      </span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontSize: 12,
                        fontFamily: 'monospace',
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      {item.nik ?? '—'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 size={12} color="var(--foreground-subtle)" />
                      <span
                        style={{ fontSize: 13, color: 'var(--foreground-muted)' }}
                      >
                        {item.branch?.name ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {canRead ? (item.roles?.length ?? 0) === 0 ? (
                      <span
                        style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}
                      >
                        —
                      </span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(item.roles ?? []).slice(0, 2).map((r) => (
                          <span
                            key={r.id}
                            style={{
                              padding: '2px 8px',
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
                        {(item.roles?.length ?? 0) > 2 && (
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--foreground-muted)',
                            }}
                          >
                            +{(item.roles?.length ?? 0) - 2}
                          </span>
                        )}
                      </div>
                    ) : "***"}
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{ fontSize: 13, color: 'var(--foreground-muted)' }}
                    >
                      {item.phone ?? '—'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {canRead ? (item.credit ?? 0) > 0 ? (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--success)',
                          }}
                        >
                          {formatCurrency((item.credit ?? 0))}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--foreground-muted)',
                          }}
                        >
                          credit limit
                        </span>
                      </div>
                    ) : (
                      <span
                        style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}
                      >
                        No limit
                      </span>
                    ) : "***"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        justifyContent: 'flex-end',
                      }}
                    >
                      {canEdit && (<button
                        type="button"
                        onClick={() => openEdit(item)}
                        style={actionBtnStyle}
                        title="Edit">
                        <Pencil size={14} />
                      </button>)}
                      {canDelete && (<button
                        type="button"
                        onClick={() => setDeleteConfirmId(item.id)}
                        style={{ ...actionBtnStyle, color: 'var(--destructive)' }}
                        title="Remove">
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
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.22)',
            }}
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
              Remove Employee
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--foreground-muted)',
                margin: '0 0 24px',
                lineHeight: 1.6,
              }}
            >
              This will permanently delete the employee account. Any credit
              history on sales orders will remain.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
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
                type="button"
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
                Remove
              </button>
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
          qc.invalidateQueries({ queryKey: ['employees'] })
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
