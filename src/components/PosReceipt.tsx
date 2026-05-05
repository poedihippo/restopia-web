'use client'

import React from 'react'

export interface ReceiptData {
  companyName: string
  branchName: string
  branchAddress?: string
  branchPhone?: string

  invoiceNo: string
  date: string
  time: string
  cashierName: string
  customerName?: string
  orderType: string

  items: Array<{
    name: string
    qty: number
    price: number
    subtotal: number
  }>

  grossAmount: number
  discountAmount: number
  totalAmount: number

  payments: Array<{
    method: string
    amount: number
  }>
  changeAmount?: number

  isPrinted?: boolean
  reprintBy?: string
  reprintAt?: string
}

interface Props {
  data: ReceiptData
}

const divider = '----------------------------------------'
const thinDivider = '- - - - - - - - - - - - - - - - - -'

export default function PosReceipt({ data }: Props) {
  const fmt = (n: number) => n.toLocaleString('id-ID')
  const paymentTotal = data.payments.reduce((s, p) => s + p.amount, 0)

  return (
    <div
      style={{
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: '12px',
        width: '300px',
        padding: '8px',
        color: '#000',
        background: '#fff',
        lineHeight: '1.4',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11 }}>PT. Sumber Cemerlang Mandiri</div>
        <div style={{ fontSize: 11 }}>
          Ruko Golden Boulevard, J, 9, Lengkong Karya, Serpong Utara, Kota
          Tangerang Selatan, Banten, 15331
        </div>
        <div style={{ fontSize: 11 }}>NPWP: 71.008.539.0-411.000</div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 'bold', fontSize: 13 }}>DAPUR COKELAT</div>
        <div style={{ fontWeight: 'bold' }}>
          {data.branchName.toUpperCase()}
        </div>
        {data.branchAddress && (
          <div style={{ fontSize: 11 }}>{data.branchAddress}</div>
        )}
        {data.branchPhone && <div>{data.branchPhone}</div>}
      </div>

      <div>{divider}</div>

      <div style={{ margin: '4px 0' }}>
        <div>
          {data.date} {data.time}
        </div>
        <div>{data.invoiceNo}</div>
        <div>{data.cashierName}</div>
        {data.customerName && <div>{data.customerName}</div>}
      </div>

      <div>{divider}</div>

      {data.isPrinted && data.reprintBy && (
        <>
          <div style={{ margin: '4px 0' }}>
            <div>Reprint by {data.reprintBy} on</div>
            <div>{data.reprintAt}</div>
          </div>
          <div>{divider}</div>
        </>
      )}

      <div style={{ margin: '4px 0' }}>
        {data.items.map((item, idx) => (
          <div key={idx} style={{ marginBottom: 4 }}>
            <div>{item.name}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>
                {item.qty} x {fmt(item.price)}
              </span>
              <span>{fmt(item.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>

      <div>{thinDivider}</div>

      <div style={{ margin: '4px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>GROSS</span>
          <span>{fmt(data.grossAmount)}</span>
        </div>
        {data.discountAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>DISCOUNT</span>
            <span>{fmt(data.discountAmount)}</span>
          </div>
        )}
      </div>

      <div>{thinDivider}</div>

      <div style={{ margin: '4px 0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 'bold',
          }}
        >
          <span>TOTAL</span>
          <span>{fmt(data.totalAmount)}</span>
        </div>

        {data.payments.map((p, idx) => (
          <div
            key={idx}
            style={{ display: 'flex', justifyContent: 'space-between' }}
          >
            <span>{p.method.toUpperCase()}</span>
            <span>{fmt(p.amount)}</span>
          </div>
        ))}

        {data.changeAmount !== undefined && data.changeAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>KEMBALI</span>
            <span>{fmt(data.changeAmount)}</span>
          </div>
        )}
      </div>

      <div>{thinDivider}</div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          margin: '4px 0',
          fontWeight: 'bold',
        }}
      >
        <span>PAYMENT</span>
        <span>{fmt(paymentTotal)}</span>
      </div>

      <div style={{ margin: '4px 0' }}>
        {data.branchName.toUpperCase()} – {data.orderType.toUpperCase()}
      </div>

      <div>{divider}</div>

      <div style={{ textAlign: 'center', margin: '8px 0', fontSize: 11 }}>
        <div>ChocoCall : 0811-1920-9900</div>
        <div>ALL ABOUT CHOCOLATES &amp; CAKES</div>
      </div>

      <div>{divider}</div>

      <div style={{ textAlign: 'center', margin: '4px 0', fontSize: 11 }}>
        Harga sudah termasuk pajak
      </div>

      <div>{divider}</div>

      <div style={{ textAlign: 'center', margin: '4px 0', fontSize: 11 }}>
        Keluhan mengenai produk dapat diterima maksimal 1x24 jam sejak tanggal
        pembelian
      </div>
    </div>
  )
}
