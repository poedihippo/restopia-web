'use client'

import React from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { receiptsService } from '@/services/receipts.service'
import ReceiptForm from './ReceiptForm'
import { ReceiptText } from 'lucide-react'

interface ReceiptEditProps {
  id: number
}

export default function ReceiptEdit({ id }: ReceiptEditProps) {
  const router = useRouter()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['receipt-detail', id],
    queryFn: () =>
      receiptsService
        .findById(id, { include: 'branch,delivery,receipt_details' })
        .then((r) => r.data),
    enabled: !!id && !isNaN(id),
  })

  const receipt = (data as any)?.data

  const initialData = receipt
    ? {
        code: receipt.code,
        delivery_id: receipt.delivery?.id ?? 0,
        date: receipt.date,
        status: receipt.status,
        description: receipt.description ?? '',
        details: receipt.receipt_details?.map((d: any) => ({
          product_inventory_id:
            d.product_inventory?.id ?? d.product_inventory_id ?? 0,
          delivery_detail_id: d.delivery_detail_id ?? undefined,
          qty: d.qty,
          price: d.price,
          status: d.status,
          description: d.description ?? '',
          client_ref: d.client_ref ?? '',
        })) ?? [
          {
            product_inventory_id: 0,
            delivery_detail_id: undefined,
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
