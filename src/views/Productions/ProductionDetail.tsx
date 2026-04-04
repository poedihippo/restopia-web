'use client'

import React from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft } from 'lucide-react'
import useGetProduction from '@/hooks/productions/useGetProduction'

interface Props {
  id: number
}

const INCLUDE =
  'created_by,updated_by,branch,media,production_details.product_inventory.product_uom.product,production_details.product_inventory.product_uom.uom,production_details.product_detail_materials.product_inventory.product_uom.product,production_details.product_detail_materials.product_inventory.product_uom.uom'

export default function ProductionDetail({ id }: Props) {
  const router = useRouter()
  const { data, isLoading } = useGetProduction(id, {
    include: INCLUDE,
  })

  const formatDate = (v: string | Date | undefined) => {
    if (!v) return '—'
    const d = typeof v === 'string' ? new Date(v) : v
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            cursor: 'pointer',
            color: 'var(--foreground-muted)',
          }}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 500,
            margin: 0,
            color: 'var(--foreground)',
          }}
        >
          Production Detail
        </h1>
      </div>

      {isLoading ? (
        <div
          style={{
            height: 120,
            borderRadius: 'var(--radius-lg)',
            background: 'var(--border)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ) : (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 16,
            }}
          >
            <div>
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Code</span>
              <p style={{ margin: '4px 0 0', fontWeight: 600, fontFamily: 'monospace', color: 'var(--accent)' }}>
                {data?.code ?? '—'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Branch</span>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--foreground)' }}>
                {data?.branch?.name ?? '—'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Status</span>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--foreground)' }}>
                {data?.status === 'final' ? 'Final' : data?.status === 'pending' ? 'Pending' : '—'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Created</span>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--foreground-muted)' }}>
                {formatDate(data?.created_at)}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Updated</span>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--foreground-muted)' }}>
                {formatDate(data?.updated_at)}
              </p>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Description</span>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--foreground-muted)' }}>
              {data?.description ?? '—'}
            </p>
          </div>
        </div>
      )}

      {!isLoading &&
        data?.production_details &&
        data.production_details.length > 0 && (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 500,
                margin: '0 0 16px',
                color: 'var(--foreground)',
              }}
            >
              Production items
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {data.production_details.map((detail: any, index: number) => {
                const product = detail.product_inventory?.product_uom?.product
                const uom = detail.product_inventory?.product_uom?.uom
                return (
                  <div
                    key={detail.id ?? index}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 16,
                        padding: '12px 16px',
                        background: 'var(--background)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Product</span>
                        <p style={{ margin: '2px 0 0', fontWeight: 600, fontSize: 13 }}>{product?.name ?? '—'}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>SKU</span>
                        <p style={{ margin: '2px 0 0', fontSize: 13 }}>{detail.product_inventory?.sku ?? '—'}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Qty</span>
                        <p style={{ margin: '2px 0 0', fontSize: 13 }}>
                          {detail.qty ?? '—'} <span style={{ color: 'var(--foreground-muted)' }}>{uom?.name ?? ''}</span>
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Status</span>
                        <p style={{ margin: '2px 0 0', fontSize: 13 }}>{detail.status ?? '—'}</p>
                      </div>
                    </div>
                    {detail.product_detail_materials && detail.product_detail_materials.length > 0 ? (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--foreground-muted)', fontSize: 11, textTransform: 'uppercase' }}>#</th>
                              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--foreground-muted)', fontSize: 11, textTransform: 'uppercase' }}>Material</th>
                              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--foreground-muted)', fontSize: 11, textTransform: 'uppercase' }}>SKU</th>
                              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--foreground-muted)', fontSize: 11, textTransform: 'uppercase' }}>Qty</th>
                              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--foreground-muted)', fontSize: 11, textTransform: 'uppercase' }}>UoM</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.product_detail_materials.map((mat: any, mi: number) => {
                              const mp = mat.product_inventory?.product_uom?.product
                              const mu = mat.product_inventory?.product_uom?.uom
                              return (
                                <tr key={mat.id ?? mi} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '10px 12px', color: 'var(--foreground-muted)' }}>{mi + 1}</td>
                                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{mp?.name ?? '—'}</td>
                                  <td style={{ padding: '10px 12px', color: 'var(--foreground-muted)' }}>{mat.product_inventory?.sku ?? '—'}</td>
                                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{mat.qty ?? '—'}</td>
                                  <td style={{ padding: '10px 12px', color: 'var(--foreground-muted)' }}>{mu?.name ?? '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-subtle)', margin: 0 }}>
                        No materials.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

      {!isLoading && data?.media && data.media.length > 0 && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 500,
              margin: '0 0 12px',
              color: 'var(--foreground)',
            }}
          >
            Images
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
            {data.media.map((item: any, idx: number) => (
              <button
                key={item.id ?? idx}
                type="button"
                onClick={() => item.url && window.open(item.url)}
                style={{
                  padding: 0,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: 'var(--background)',
                }}
              >
                {item.url && (
                  <img
                    src={item.url}
                    alt={item.file_name ?? ''}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
