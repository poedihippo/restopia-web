'use client'

import React from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { receiptsService } from '@/services/receipts.service'
import ReceiptForm from './ReceiptForm'
import { ReceiptText } from 'lucide-react'
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
          include: 'branch,delivery,receipt_details.product_uom',
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
      status: 'final',
      description: receipt.description ?? '',
      total_price: receipt.total_price ?? 0,
      details: rawDetails.length
        ? rawDetails.map((d: any) => ({
          delivery_detail_id: d.delivery_detail_id ?? undefined,
          product_uom_id:
            d.product_uom_id ?? d.product_uom?.id ?? 0,
          planned_expiry_date: parseDate(d.planned_expiry_date)
            ? parseDate(d.planned_expiry_date.split('T')[0])
            : '',
          qty: d.qty ?? 1,
          price: d.price ?? 0,
          status: d.status ?? 'pending',
          description: d.description ?? '',
          client_ref: d.client_ref ?? '',
        }))
        : [
          {
            delivery_detail_id: undefined,
            product_uom_id: 0,
            planned_expiry_date: '',
            qty: 1,
            price: 0,
            status: 'pending',
            description: '',
            client_ref: '',
          },
        ],
    }
    : undefined

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 99,
              border: '3px solid var(--border)',
              borderTop: '3px solid var(--accent)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)', marginTop: 12 }}>
            Loading receipt...
          </span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (isError || !receipt) {
    return (
      <div
        style={{
          padding: 80,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <ReceiptText size={40} style={{ color: 'var(--foreground-subtle)' }} />
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: 0 }}>
          Receipt not found
        </p>
        <button
          onClick={() => router.back()}
          style={{
            padding: '7px 14px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: 'var(--foreground-muted)',
            cursor: 'pointer',
          }}
        >
          Go back
        </button>
      </div>
    )
  }

  return <ReceiptForm mode="edit" initialData={initialData} receiptId={id} />
}
