'use client'

import React from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { productionsService } from '@/services/productions.service'
import { getProductUomName } from '@/utils/productUomName'

interface Props {
  id: number
}

const INCLUDE = 'branch,created_by,updated_by,production_details,production_details.production_detail_materials'

const DETAIL_STATUS_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  pending: { label: 'Pending', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  final: { label: 'Final', color: 'var(--success)', bg: 'var(--success-bg)' },
}

export default function ProductionDetail({ id }: Props) {
  const router = useRouter()
  const { data, isLoading } = useQuery({
    queryKey: ['production-detail', id],
    enabled: !!id && !isNaN(id),
    queryFn: () =>
      productionsService.findById(id, { include: INCLUDE }).then((r) => r.data),
  })
  const production = (data as any)?.data

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
                {production?.code ?? '—'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Date</span>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--foreground)' }}>
                {production?.date}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Branch</span>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--foreground)' }}>
                {production?.branch?.name ?? '—'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Status</span>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--foreground)' }}>
                {(() => {
                  const st = production?.status as string | undefined
                  const meta = st ? DETAIL_STATUS_META[st] : undefined
                  return meta?.label ?? st ?? '—'
                })()}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Created</span>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--foreground-muted)' }}>
                {production?.created_by?.name
                  ? `${production.created_by.name} - ${production?.created_at}`
                  : production?.created_at}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Updated</span>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--foreground-muted)' }}>
                {production?.updated_by?.name
                  ? `${production.updated_by.name} - ${production?.updated_at}`
                  : production?.updated_at}
              </p>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Description</span>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--foreground-muted)' }}>
              {production?.description ?? '—'}
            </p>
          </div>

          {/* Dimension fields */}
          <div
            style={{
              marginTop: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
              padding: 12,
              background: 'var(--background)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
            }}
          >
            <div>
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Source Owner</span>
              <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 500 }}>
                {production?.source_owner_ref ?? '—'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Source Stage</span>
              <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 500 }}>
                {production?.source_stage ?? '—'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Source Location</span>
              <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 500 }}>
                {production?.source_location_ref ?? '—'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Output Owner</span>
              <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 500 }}>
                {production?.output_owner_ref ?? '—'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Output Stage</span>
              <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 500 }}>
                {production?.output_stage ?? '—'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Output Location</span>
              <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 500 }}>
                {production?.output_location_ref ?? '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {!isLoading &&
        production?.production_details &&
        production.production_details.length > 0 && (
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
              {production.production_details.map((detail: any, index: number) => {
                const product = detail.product_uom?.product
                const productUomName = getProductUomName(detail.product_uom, product?.name)
                const uom = detail.product_uom?.uom
                const batch = detail.product_uom_batch
                let batchLine: string | null = null
                if (batch?.batch_code) {
                  batchLine = `Batch: ${batch.batch_code} — ${batch.expiry_date ? `Exp: ${batch.expiry_date}` : 'No expiry'
                    }`
                } else if (detail.planned_batch_code) {
                  batchLine = `Planned: ${detail.planned_batch_code} — ${detail.planned_expiry_date
                    ? `Exp: ${detail.planned_expiry_date}`
                    : 'No expiry'
                    }`
                }
                const statusMeta = detail.status
                  ? DETAIL_STATUS_META[detail.status] ?? {
                    label: detail.status,
                    color: 'var(--foreground-muted)',
                    bg: 'var(--background)',
                  }
                  : null
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
                        <p style={{ margin: '2px 0 0', fontWeight: 600, fontSize: 13 }}>
                          {productUomName || '—'}
                        </p>
                        {batchLine && (
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--foreground-muted)' }}>
                            {batchLine}
                          </p>
                        )}
                        {detail.description && (
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--foreground-muted)' }}>
                            {detail.description}
                          </p>
                        )}
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Batch Code</span>
                        <p style={{ margin: '2px 0 0', fontSize: 13 }}>{detail.planned_batch_code ?? '—'}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Code</span>
                        <p style={{ margin: '2px 0 0', fontSize: 13 }}>{detail.product_uom?.code ?? '—'}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Qty</span>
                        <p style={{ margin: '2px 0 0', fontSize: 13 }}>
                          {detail.qty ?? '—'} <span style={{ color: 'var(--foreground-muted)' }}>{uom?.name ?? ''}</span>
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Status</span>
                        <p style={{ margin: '2px 0 0', fontSize: 13 }}>
                          {statusMeta ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                padding: '2px 10px',
                                borderRadius: 99,
                                fontSize: 11,
                                fontWeight: 600,
                                background: statusMeta.bg,
                                color: statusMeta.color,
                              }}
                            >
                              {statusMeta.label}
                            </span>
                          ) : (
                            '—'
                          )}
                        </p>
                      </div>
                      {/* Per-detail effective dimensions */}
                      {(detail.owner_ref || detail.stage || detail.location_ref) && (
                        <>
                          <div>
                            <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Output Owner</span>
                            <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 500 }}>
                              {detail.owner_ref ?? '—'}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Output Stage</span>
                            <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 500 }}>
                              {detail.stage ?? '—'}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Output Location</span>
                            <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 500 }}>
                              {detail.location_ref ?? '—'}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                    {detail.production_detail_materials && detail.production_detail_materials.length > 0 ? (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--foreground-muted)', fontSize: 11, textTransform: 'uppercase' }}>#</th>
                              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--foreground-muted)', fontSize: 11, textTransform: 'uppercase' }}>Material</th>
                              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--foreground-muted)', fontSize: 11, textTransform: 'uppercase' }}>Code</th>
                              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--foreground-muted)', fontSize: 11, textTransform: 'uppercase' }}>Qty</th>
                              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--foreground-muted)', fontSize: 11, textTransform: 'uppercase' }}>UoM</th>
                              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--foreground-muted)', fontSize: 11, textTransform: 'uppercase' }}>Owner</th>
                              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--foreground-muted)', fontSize: 11, textTransform: 'uppercase' }}>Stage</th>
                              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--foreground-muted)', fontSize: 11, textTransform: 'uppercase' }}>Location</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.production_detail_materials.map((mat: any, mi: number) => {
                              const matProductUom = mat.product_inventory?.product_uom_batch?.product_uom
                              const mp = matProductUom?.product
                              const mu = matProductUom?.uom
                              const matName = getProductUomName(matProductUom, mp?.name)
                              return (
                                <tr key={mat.id ?? mi} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '10px 12px', color: 'var(--foreground-muted)' }}>{mi + 1}</td>
                                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{matName || '—'}</td>
                                  <td style={{ padding: '10px 12px', color: 'var(--foreground-muted)' }}>{mat.product_inventory?.product_uom_batch?.product_uom?.code ?? '—'}</td>
                                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{mat.qty ?? '—'}</td>
                                  <td style={{ padding: '10px 12px', color: 'var(--foreground-muted)' }}>{mu?.name ?? '—'}</td>
                                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--foreground-muted)' }}>{mat.owner_ref ?? '—'}</td>
                                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--foreground-muted)' }}>{mat.stage ?? '—'}</td>
                                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--foreground-muted)' }}>{mat.location_ref ?? '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-subtle)', margin: 0 }}>
                        No materials recorded
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

      {!isLoading && production?.media && production.media.length > 0 && (
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
            {production.media.map((item: any, idx: number) => (
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
