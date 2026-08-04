'use client'
import { formatDate } from '@/utils/date'

import React from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { invoicesService } from '@/services/invoices.service'
import { useAuth } from '@/hooks/useAuth'
import {
  ArrowLeft,
  Calendar,
  Building2,
  Truck,
  FileText,
  Printer,
  PackageSearch,
} from 'lucide-react'

interface InvoiceDetailProps {
  id: number
}

interface InvoiceDetailLine {
  id: number
  qty: number
  price: number
  description?: string
  product_uom?: {
    id: number
    code?: string
    product?: { id: number; name: string }
    uom?: { id: number; name: string; code: string }
  }
}

interface InvoiceFull {
  id: number
  code: string
  date: string
  total_price: number
  status: 'issued' | 'paid' | 'void'
  description?: string
  created_at?: string
  branch?: { id: number; name: string }
  billed_branch?: { id: number; name: string }
  delivery?: { id: number; code: string }
  invoice_details?: InvoiceDetailLine[]
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  issued: { label: 'Issued', color: 'var(--info)', bg: 'var(--info-bg)' },
  paid: { label: 'Paid', color: 'var(--success)', bg: 'var(--success-bg)' },
  void: { label: 'Void', color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
}

const rp = (n: number | string | null | undefined) =>
  `Rp ${Number(n ?? 0).toLocaleString('id-ID')}`

export default function InvoiceDetail({ id }: InvoiceDetailProps) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canRead = hasPermission('invoice.read')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['invoice-detail', id],
    queryFn: () =>
      invoicesService
        .get(id, {
          include: 'invoice_details,invoice_details.product_uom,billed_branch,branch,delivery',
        })
        .then((r) => r.data),
    enabled: canRead && !!id && !isNaN(id),
  })

  const invoice = (data as any)?.data as InvoiceFull | undefined
  const details = invoice?.invoice_details ?? []
  const statusMeta = STATUS_META[invoice?.status as keyof typeof STATUS_META] ?? STATUS_META.issued

  const backBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground-muted)',
    cursor: 'pointer',
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  }

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  }

  if (!canRead) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--warning)' }}>
          You do not have permission to view invoices.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
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
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Loading invoice...</span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (isError || !invoice) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <PackageSearch size={40} style={{ color: 'var(--foreground-subtle)', margin: '0 auto' }} />
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', marginTop: 12 }}>Invoice not found</p>
        <button onClick={() => router.back()} style={{ ...backBtnStyle, margin: '16px auto 0' }}>
          <ArrowLeft size={14} />
          Go back
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '32px 32px 64px',
        maxWidth: 960,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 20,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={() => router.push('/transfer/invoices')} style={backBtnStyle}>
            <ArrowLeft size={14} />
            Back
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontWeight: 500,
                  margin: 0,
                  color: 'var(--foreground)',
                }}
              >
                {invoice.code}
              </h1>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 10px',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 600,
                  background: statusMeta.bg,
                  color: statusMeta.color,
                }}
              >
                {statusMeta.label}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Invoice</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            background: 'var(--accent)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            fontWeight: 500,
            color: 'white',
            cursor: 'pointer',
          }}
        >
          <Printer size={13} />
          Print Invoice
        </button>
      </div>

      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {/* Billed Branch */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: 'var(--accent-light-bg)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Billed Branch</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', fontFamily: 'var(--font-display)' }}>
            {invoice.billed_branch?.name ?? '—'}
          </div>
        </div>

        {/* Seller Branch */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: 'var(--accent-light-bg)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Seller Branch</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', fontFamily: 'var(--font-display)' }}>
            {invoice.branch?.name ?? '—'}
          </div>
        </div>

        {/* Delivery */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: 'var(--accent-light-bg)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Truck size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Delivery</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', fontFamily: 'var(--font-display)' }}>
            {invoice.delivery?.code ?? '—'}
          </div>
        </div>

        {/* Date */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: 'var(--accent-light-bg)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Calendar size={15} style={{ color: 'var(--accent-light)' }} />
            </div>
            <span style={sectionLabelStyle}>Invoice Date</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', fontFamily: 'var(--font-display)' }}>
            {invoice.date ? formatDate(invoice.date) : '—'}
          </div>
        </div>
      </div>

      {/* Description block */}
      {invoice.description && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
          }}
        >
          <span style={{ ...sectionLabelStyle, display: 'block', marginBottom: 8 }}>Notes</span>
          <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0, lineHeight: 1.6 }}>
            {invoice.description}
          </p>
        </div>
      )}

      {/* Line items table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--background)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={sectionLabelStyle}>Line Items</span>
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{details.length} item(s)</span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ ...thStyle, width: 50 }}>#</th>
              <th style={thStyle}>Product</th>
              <th style={{ ...thStyle, width: 100 }}>UOM</th>
              <th style={{ ...thStyle, width: 80 }}>Qty</th>
              <th style={{ ...thStyle, width: 140 }}>Price</th>
              <th style={{ ...thStyle, width: 160 }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {details.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>
                  No line items
                </td>
              </tr>
            ) : (
              details.map((line, index) => (
                <tr key={line.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>{index + 1}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                    {line.product_uom?.product?.name ?? `Item #${line.id}`}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      {line.product_uom?.uom?.name ?? line.product_uom?.uom?.code ?? '—'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                    {line.qty.toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--foreground-muted)' }}>{rp(line.price)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                    {rp(line.qty * line.price)}
                  </td>
                </tr>
              ))
            )}

            {/* Total row */}
            <tr style={{ background: 'var(--background)', borderTop: '2px solid var(--border)' }}>
              <td colSpan={5} style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--foreground-muted)' }}>
                Total
              </td>
              <td style={{ padding: '14px 16px' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                  {rp(invoice.total_price)}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 🖨️ Printable A4 invoice (hidden on screen, shown only in print) */}
      <div className="invoice-print">
        {/* Header */}
        <div
          style={{
            textAlign: 'center',
            backgroundColor: '#5c3a21',
            color: '#fff',
            padding: '10mm 0',
            marginBottom: '6mm',
            borderRadius: '8px 8px 0 0',
          }}
        >
          <div style={{ fontSize: '24pt', fontWeight: 800, letterSpacing: '2px' }}>DAPUR COKLAT</div>
          <div style={{ fontSize: '14pt', fontWeight: 600, marginTop: '2mm', letterSpacing: '1px', opacity: 0.9 }}>
            INVOICE
          </div>
        </div>

        {/* Invoice info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8mm', padding: '0 4mm' }}>
          <div>
            <div style={{ fontSize: '10pt', fontWeight: 700, color: '#5c3a21', textTransform: 'uppercase' }}>
              Billed To
            </div>
            <div style={{ fontSize: '12pt', fontWeight: 600, marginTop: '2mm', color: '#333' }}>
              {invoice.billed_branch?.name || '-'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10pt', color: '#333' }}>
              <strong style={{ color: '#5c3a21' }}>Invoice No:</strong> {invoice.code || '-'}
            </div>
            <div style={{ fontSize: '10pt', marginTop: '1.5mm', color: '#333' }}>
              <strong style={{ color: '#5c3a21' }}>Date:</strong> {invoice.date ? formatDate(invoice.date) : '-'}
            </div>
            <div style={{ fontSize: '10pt', marginTop: '1.5mm', color: '#333' }}>
              <strong style={{ color: '#5c3a21' }}>From:</strong> {invoice.branch?.name || '-'}
            </div>
            {invoice.delivery?.code && (
              <div style={{ fontSize: '10pt', marginTop: '1.5mm', color: '#333' }}>
                <strong style={{ color: '#5c3a21' }}>Delivery:</strong> {invoice.delivery.code}
              </div>
            )}
          </div>
        </div>

        {/* Status label */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6mm', padding: '0 4mm' }}>
          <div
            style={{
              padding: '6px 16px',
              border: `2px solid ${statusMeta.color}`,
              backgroundColor: statusMeta.color + '15',
              color: statusMeta.color,
              fontWeight: 800,
              fontSize: '12pt',
              borderRadius: '6px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            {statusMeta.label}
          </div>
        </div>

        {/* Line items */}
        <div style={{ padding: '0 4mm', marginBottom: '8mm' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: '8px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0e6d2', color: '#5c3a21' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>
                  No
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>
                  Product Name
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>
                  Qty
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>
                  Unit Price
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10pt', fontWeight: 700, borderBottom: '2px solid #5c3a21' }}>
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {details.map((line, i) => (
                <tr key={line.id} style={{ borderBottom: '1px solid #e5e5e5', backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '10px 12px', fontSize: '10pt', color: '#444' }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', fontSize: '10pt', color: '#222', fontWeight: 500 }}>
                    {line.product_uom?.product?.name ?? `Item #${line.id}`}
                    {line.product_uom?.uom?.name ? ` (${line.product_uom.uom.name})` : ''}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '10pt', color: '#444' }}>{line.qty}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10pt', color: '#444' }}>{rp(line.price)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10pt', color: '#222', fontWeight: 600 }}>
                    {rp(line.qty * line.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 4mm' }}>
          <div style={{ width: '50%', backgroundColor: '#fdfbf7', padding: '16px', borderRadius: '8px', border: '1px solid #f0e6d2' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td
                    style={{
                      padding: '8px 0',
                      fontSize: '11pt',
                      fontWeight: 700,
                      color: '#5c3a21',
                      borderTop: '2px dashed #d4c4a8',
                    }}
                  >
                    Grand Total
                  </td>
                  <td
                    style={{
                      padding: '8px 0',
                      textAlign: 'right',
                      fontSize: '12pt',
                      fontWeight: 800,
                      color: '#5c3a21',
                      borderTop: '2px dashed #d4c4a8',
                    }}
                  >
                    {rp(invoice.total_price)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        .invoice-print { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          /* Enforce background colors in print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Defeat the global pos-print.css rule that otherwise collapses #__next and blanks this page. */
          body > * { display: block !important; }
          #pos-receipt { display: none !important; }
          /* Isolate: hide the on-screen detail UI, show only the invoice. */
          body * { visibility: hidden !important; }
          .invoice-print, .invoice-print * { visibility: visible !important; }
          .invoice-print {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #fff;
            font-family: 'Inter', Arial, Helvetica, sans-serif;
          }
          .invoice-print thead { display: table-header-group; }
        }
      `}</style>
    </div>
  )
}
