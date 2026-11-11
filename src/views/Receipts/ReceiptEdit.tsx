'use client'

import React from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { receiptsService } from '@/services/receipts.service'
import ReceiptForm from './ReceiptForm'
import { ReceiptText } from 'lucide-react'
import BackLink from '@/components/BackLink'
import { parseDate } from '@/helper/parseDate'

interface ReceiptEditProps {
  id: number
}

export default function ReceiptEdit({ id }: ReceiptEditProps) {
  const router = useRouter()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['receipt-detail', id],
    queryFn: () =>
      receiptsService
        .findById(id, {
          include: 'branch,delivery,receipt_details',
        })
        .then((r) => r.data),
    enabled: !!id && !isNaN(id),
  })

  const receipt = (data as any)?.data

  const rawDetails =
    receipt?.receipt_details ?? receipt?.details ?? []

  const initialData = receipt
    ? {
      code: receipt.code,
      delivery_id: receipt.delivery?.id ?? receipt.delivery_id ?? 0,
      date: parseDate(receipt.date),
      // A final delivery auto-creates its receipt as pending; editing it is
      // the act of receiving, so the status selector starts on final. The
      // user can still switch it back to pending before saving.
      status: 'final',
      description: receipt.description ?? '',
      total_price: receipt.total_price ?? 0,
      details: rawDetails.length
        ? rawDetails.map((d: any) => ({
          id: d.id ?? undefined,
          delivery_detail_id: d.delivery_detail_id ?? undefined,
          product_uom_batch_id: d.product_uom_batch_id ?? d.product_uom_batch?.id ?? undefined,
          product_uom_id:
            d.product_uom_id ?? d.product_uom?.id ?? 0,
          planned_batch_code: d.planned_batch_code ?? d.product_uom_batch?.batch_code ?? d.product_uom_batch?.code ?? '',
          planned_expiry_date: d.planned_expiry_date
            ? parseDate(d.planned_expiry_date.split('T')[0])
            : d.product_uom_batch?.expiry_date
              ? parseDate(d.product_uom_batch.expiry_date.split('T')[0])
              : '',
          qty: d.qty ?? 1,
          price: d.price ?? 0,
          // Same as the header: receiving starts every pending line on
          // success. A line already marked failed keeps its status.
          status: d.status === 'failed' ? 'failed' : 'success',
          description: d.description ?? '',
          client_ref: d.client_ref ?? '',
        }))
        : [
          {
            id: undefined,
            delivery_detail_id: undefined,
            product_uom_batch_id: undefined,
            product_uom_id: 0,
            planned_batch_code: '',
            planned_expiry_date: '',
            qty: 1,
            price: 0,
            status: 'success',
            description: '',
            client_ref: '',
          },
        ],
    }
    : undefined

  const containerStyle: React.CSSProperties = {
    padding: '28px 24px 48px',
    width: '100%',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
  }

  const messageStyle: React.CSSProperties = {
    ...containerStyle,
    paddingTop: 80,
    alignItems: 'center',
    textAlign: 'center',
    gap: 12,
  }

  if (isLoading) {
    return (
      <div style={containerStyle} aria-busy="true">
        <div className="v2-skeleton" style={{ width: 64, height: 28 }} />
        <div className="v2-skeleton" style={{ width: 180, height: 26, marginTop: 14 }} />
        <div className="v2-skeleton" style={{ width: 240, height: 13, marginTop: 8 }} />
        <div className="v2-card" style={{ marginTop: 20, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <div className="v2-skeleton" style={{ width: 100, height: 14 }} />
          </div>
          <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px 20px' }}>
            {[0, 1].map((i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="v2-skeleton" style={{ width: 90, height: 12 }} />
                <div className="v2-skeleton" style={{ height: 38 }} />
              </div>
            ))}
            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="v2-skeleton" style={{ width: 110, height: 12 }} />
              <div className="v2-skeleton" style={{ height: 38 }} />
            </div>
          </div>
        </div>
        <div className="v2-card" style={{ marginTop: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <div className="v2-skeleton" style={{ width: 120, height: 14 }} />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 20px', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <div className="v2-skeleton" style={{ flex: 1, height: 34 }} />
              <div className="v2-skeleton" style={{ width: 100, height: 34 }} />
              <div className="v2-skeleton" style={{ width: 80, height: 34 }} />
              <div className="v2-skeleton" style={{ width: 120, height: 34 }} />
            </div>
          ))}
        </div>
        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          Loading receipt...
        </span>
      </div>
    )
  }

  if (isError || !receipt) {
    return (
      <div style={messageStyle}>
        <ReceiptText size={36} style={{ color: 'var(--foreground-subtle)' }} />
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: 0 }}>
          Receipt not found
        </p>
        <BackLink href="/transfer/receipts" label="Receipts" style={{ alignSelf: 'center', marginTop: 4 }} />
      </div>
    )
  }

  if (receipt.status === 'final') {
    return (
      <div style={messageStyle}>
        <ReceiptText size={36} style={{ color: 'var(--foreground-subtle)' }} />
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: 0 }}>
          Final receipt cannot be edited.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/transfer/receipts/${id}/detail`)}
          className="v2-btn v2-btn-outline v2-btn-sm"
          style={{ marginTop: 4 }}
        >
          Go to detail
        </button>
      </div>
    )
  }

  return <ReceiptForm mode="edit" initialData={initialData} receiptId={id} />
}
