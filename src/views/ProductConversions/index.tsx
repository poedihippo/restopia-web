'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productConversionsService } from '@/services/product-conversions.service'
import { toastMutationApiError } from '@/utils/apiError'
import ProductConversionSheet from './ProductConversionSheet'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  ArrowRight,
} from 'lucide-react'

interface ProductConversion {
  id: number
  product_id: number
  uom_id: number
  target_uom_id: number
  amount: number
  created_at?: string
  product?: { id: number; name: string }
  uom?: { id: number; name: string; code: string }
  target_uom?: { id: number; name: string; code: string }
}

export default function ProductConversionsView() {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<ProductConversion | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['product-conversions', page, debouncedSearch],
    queryFn: () =>
      productConversionsService
        .list({
          page,
          per_page: 15,
          include: 'product,uom,target_uom',
          'filter[search]': debouncedSearch || undefined,
        })
        .then((r) => r.data),
  })

  const items: ProductConversion[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productConversionsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-conversions'] })
      toast.success('Conversion deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 24,
              fontWeight: 500,
              margin: 0,
              color: 'var(--foreground)',
            }}
          >
            Product Conversions
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--foreground-muted)',
              margin: '4px 0 0 0',
            }}
          >
            Define unit conversion factors between UOMs per product
          </p>
        </div>

        <button
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
          }}
        >
          <Plus size={15} />
          New Conversion
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search
            size={14}
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
            placeholder="Search conversions..."
            style={{
              width: '100%',
              padding: '8px 10px 8px 32px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              color: 'var(--foreground)',
              background: 'var(--surface)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--border)',
                background: 'var(--background)',
              }}
            >
              {(
                [
                  { label: 'Product', width: undefined },
                  { label: 'From', width: 140 },
                  { label: '', width: 40 },
                  { label: 'To', width: 140 },
                  { label: 'Amount', width: 120 },
                  { label: 'Created', width: 140 },
                  { label: '', width: 80 },
                ] as const
              ).map(({ label, width }, i) => (
                <th
                  key={i}
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--foreground-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    width,
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    {[60, 40, 80, 50, 70].map((w, i) => (
                      <div
                        key={i}
                        style={{
                          height: 16,
                          borderRadius: 4,
                          background: 'var(--border)',
                          width: `${w}%`,
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                    ))}
                  </div>
                </td>
              </tr>
            )}

            {isError && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    textAlign: 'center',
                    padding: 48,
                    fontSize: 13,
                    color: 'var(--destructive)',
                  }}
                >
                  Failed to load conversions
                </td>
              </tr>
            )}

            {!isLoading && !isError && items.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div
                    style={{
                      padding: 48,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <ArrowLeftRight size={32} style={{ color: 'var(--foreground-subtle)' }} />
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                      No conversions defined
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              items.map((item) => (
                <tr
                  key={item.id}
                  onMouseEnter={() => setHoveredRow(item.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background:
                      hoveredRow === item.id ? 'var(--background)' : 'transparent',
                  }}
                >
                  {/* Product */}
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--foreground)',
                    }}
                  >
                    {item.product?.name ?? '—'}
                  </td>

                  {/* From */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--foreground)',
                        }}
                      >
                        {item.uom?.name ?? '—'}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: 'var(--foreground-muted)',
                        }}
                      >
                        {item.uom?.code ?? ''}
                      </span>
                    </div>
                  </td>

                  {/* Arrow */}
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <ArrowRight size={13} style={{ color: 'var(--foreground-subtle)' }} />
                  </td>

                  {/* To */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--foreground)',
                        }}
                      >
                        {item.target_uom?.name ?? '—'}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: 'var(--foreground-muted)',
                        }}
                      >
                        {item.target_uom?.code ?? ''}
                      </span>
                    </div>
                  </td>

                  {/* Amount */}
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {(item.amount ?? 0).toLocaleString('id-ID', {
                      maximumFractionDigits: 4,
                    })}
                  </td>

                  {/* Created */}
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: 12,
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString('id-ID')
                      : '—'}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '12px 16px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        justifyContent: 'flex-end',
                      }}
                    >
                      <button
                        onClick={() => {
                          setEditData(item)
                          setSheetOpen(true)
                        }}
                        style={{
                          padding: 6,
                          background: 'none',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          color: 'var(--foreground-muted)',
                          display: 'flex',
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(item.id)}
                        style={{
                          padding: 6,
                          background: 'none',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          color: 'var(--destructive)',
                          display: 'flex',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.last_page > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 12,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
            Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, meta.total)} of{' '}
            {meta.total}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              style={{
                padding: '5px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                color: 'var(--foreground-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                opacity: page === 1 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={13} />
              Prev
            </button>

            <span
              style={{
                fontSize: 12,
                color: 'var(--foreground)',
                padding: '0 8px',
                fontWeight: 500,
              }}
            >
              {page} / {meta.last_page}
            </span>

            <button
              disabled={page === meta.last_page}
              onClick={() => setPage((p) => p + 1)}
              style={{
                padding: '5px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                cursor: page === meta.last_page ? 'not-allowed' : 'pointer',
                color: 'var(--foreground-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                opacity: page === meta.last_page ? 0.5 : 1,
              }}
            >
              Next
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteConfirmId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
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
              background: 'rgba(0,0,0,0.25)',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 51,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              width: 360,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3
              style={{
                fontSize: 15,
                fontWeight: 600,
                margin: '0 0 8px',
                color: 'var(--foreground)',
              }}
            >
              Delete Conversion
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--foreground-muted)',
                margin: '0 0 20px',
              }}
            >
              Removing this conversion may affect recipe calculations that depend on it.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  padding: '8px 16px',
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
                  padding: '8px 16px',
                  background: 'var(--destructive)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
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
      <ProductConversionSheet
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
  )
}
