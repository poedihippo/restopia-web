'use client'
import { formatCurrency } from '@/utils/price';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usersService } from '@/services/users.service'
import UserSheet from '@/views/User/UserSheet'
import { useAuth } from '@/hooks/useAuth'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  UserCheck,
  CreditCard,
  Building2,
} from 'lucide-react'

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
  roles?: Array<{ id: number; name: string }>
  branch_ids?: number[]
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
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<Employee | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['employees', page, debouncedSearch],
    queryFn: () =>
      usersService
        .list({
          page,
          per_page: 20,
          include: 'branch,roles',
          sort: '-created_at',
          'filter[type]': 'user',
          'filter[search]': debouncedSearch || undefined,
        } as any)
        .then((r) => r.data),
  })

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

  const inputBase: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--foreground)',
    background: 'var(--surface)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        <div style={{ position: 'relative', maxWidth: 280, width: '100%' }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--foreground-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, NIK, or phone..."
            style={{
              ...inputBase,
              width: '100%',
              padding: '8px 12px 8px 32px',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>
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
                <td
                  colSpan={7}
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
                  colSpan={7}
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
              items.map((item) => (
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
      {meta && lastPage > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              color: page === 1 ? 'var(--foreground-subtle)' : 'var(--foreground)',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              fontSize: 13,
            }}
          >
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
            Page {page} of {lastPage}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page === lastPage}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              color:
                page === lastPage ? 'var(--foreground-subtle)' : 'var(--foreground)',
              cursor: page === lastPage ? 'not-allowed' : 'pointer',
              fontSize: 13,
            }}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
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
