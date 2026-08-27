'use client'
import { formatCurrency } from '@/utils/price';
import { formatDate } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { vouchersService } from '@/services/vouchers.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import VoucherSheet from './VoucherSheet'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
  Tag,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

interface Voucher {
  id: number
  code: string
  name: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_subtotal_price?: number
  max_discount_price?: number
  scope: 'company' | 'branch'
  valid_from: string
  valid_until: string
  quota?: number
  status: 'active' | 'inactive'
  description?: string
  created_at?: string
  voucher_branches?: any[]
  voucher_product_uoms?: any[]
}

export default function VouchersView() {
  const router = useRouter()
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission("voucher.read");
  const canCreate = hasPermission('voucher.create')
  const canEdit = hasPermission('voucher.update')
  const canDelete = hasPermission('voucher.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(1000)
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
  const [discountTypeFilter, setDiscountTypeFilter] = useState<'' | 'percent' | 'fixed'>('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<Voucher | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, discountTypeFilter])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['vouchers', page, perPage, debouncedSearch, statusFilter, discountTypeFilter],
    queryFn: () =>
      vouchersService
        .list({
          page,
          per_page: perPage,
          sort: '-created_at',
          include: 'voucher_branches,voucher_product_uoms',
          'filter[search]': debouncedSearch || undefined,
          'filter[status]': statusFilter || undefined,
          'filter[discount_type]': discountTypeFilter || undefined,
        } as any)
        .then((r) => r.data),
  })

  const items: Voucher[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => vouchersService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vouchers'] })
      toast.success('Voucher deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'active' | 'inactive' }) =>
      vouchersService.updateStatus(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vouchers'] })
      toast.success('Status updated')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update status'),
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
            Vouchers
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Manage discount vouchers
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
          <Plus size={15} />New Voucher
                            </button>)}
      </div>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div style={{ position: 'relative', maxWidth: 260 }}>
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
            placeholder="Search vouchers..."
            style={{
              ...inputBase,
              width: 260,
              padding: '8px 12px 8px 32px',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as '' | 'active' | 'inactive')
            setPage(1)
          }}
          style={{ ...inputBase, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <select
          value={discountTypeFilter}
          onChange={(e) => {
            setDiscountTypeFilter(e.target.value as '' | 'percent' | 'fixed')
            setPage(1)
          }}
          style={{ ...inputBase, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}
        >
          <option value="">All Types</option>
          <option value="percent">Percent</option>
          <option value="fixed">Fixed Amount</option>
        </select>
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
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 140 }}>Code</th>
              <th style={thStyle}>Name</th>
              <th style={{ ...thStyle, width: 90 }}>Type</th>
              <th style={{ ...thStyle, width: 110 }}>Value</th>
              <th style={{ ...thStyle, width: 100 }}>Scope</th>
              <th style={{ ...thStyle, width: 110 }}>Valid From</th>
              <th style={{ ...thStyle, width: 110 }}>Valid Until</th>
              <th style={{ ...thStyle, width: 100 }}>Status</th>
              <th style={{ ...thStyle, width: 120 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <td key={j} style={tdStyle}>
                      <div
                        style={{
                          height: 14,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--border)',
                          width: j === 8 ? 80 : j === 7 ? 60 : '75%',
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                  <span style={{ fontSize: 14, color: 'var(--destructive)' }}>
                    Failed to load vouchers.
                  </span>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    <Tag size={32} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: 14 }}>No vouchers found</span>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isActive = item.status === 'active'
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
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--accent)',
                        }}
                      >
                        {item.code}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                        {item.name}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {canRead ? item.discount_type === 'percent' ? (
                        <span style={badge('var(--info-bg)', 'var(--info)')}>%</span>
                      ) : (
                        <span style={badge('var(--accent-light-bg)', 'var(--accent)')}>Rp</span>
                      ) : "***"}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                        {item.discount_type === 'percent'
                          ? `${item.discount_value}%`
                          : formatCurrency((item.discount_value ?? 0))}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {canRead ? item.scope === 'company' ? (
                        <span style={badge('var(--accent-light-bg)', 'var(--accent)')}>
                          Company
                        </span>
                      ) : (
                        <span style={badge('var(--warning-bg)', 'var(--warning)')}>Branch</span>
                      ) : "***"}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        {item.valid_from
                          ? formatDate(item.valid_from)
                          : '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        {item.valid_until
                          ? formatDate(item.valid_until)
                          : '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {canRead ? isActive ? (
                        <span style={badge('var(--success-bg)', 'var(--success)')}>Active</span>
                      ) : (
                        <span style={badge('var(--background)', 'var(--foreground-muted)')}>
                          Inactive
                        </span>
                      ) : "***"}
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
                        {canEdit && (<button
                          onClick={() =>
                            toggleStatusMutation.mutate({
                              id: item.id,
                              status: isActive ? 'inactive' : 'active',
                            })
                          }
                          disabled={toggleStatusMutation.isPending}
                          title={isActive ? 'Deactivate' : 'Activate'}
                          style={{
                            padding: 6,
                            background: 'none',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            color: isActive ? 'var(--success)' : 'var(--foreground-muted)',
                            display: 'flex',
                          }}>
                          {isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>)}
                        <button
                          onClick={() => router.push(`/sales/vouchers/${item.id}/detail`)}
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
              Delete Voucher
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>
              This will permanently remove the voucher and it cannot be recovered.
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
      {/* Sheet */}
      <VoucherSheet
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
