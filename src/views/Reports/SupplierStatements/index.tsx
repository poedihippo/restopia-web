'use client'

import React, { useState } from 'react'
import { Search } from 'lucide-react'
import { reportsService } from '@/services/reports.service'
import FinancePeriodSelect from '../FinancePeriodSelect'
import StatementReport from '../StatementReport'

export default function SupplierStatementsView() {
  const [supplier, setSupplier] = useState('')
  const [asOfDate, setAsOfDate] = useState('')

  const value = { supplier: supplier.trim(), asOfDate }

  return (
    <StatementReport
      title="Supplier Statements"
      subtitle="Lihat statement hutang per supplier, lalu ekspor ke Excel"
      filename="supplier-statement.xlsx"
      partyLabel="Supplier"
      autoLoad
      queryKey="supplier-statements-preview"
      emptyHint="Kosongkan nama supplier untuk menampilkan semua supplier."
      value={value}
      fetchData={(v) =>
        reportsService
          .getSupplierStatement({
            ...(v.supplier ? { supplier: v.supplier } : {}),
            ...(v.asOfDate ? { as_of_date: v.asOfDate } : {}),
          })
          .then((r) => {
            const d = r.data.data
            return {
              asOf: d.as_of_date,
              buckets: d.buckets,
              total: d.grand_total_outstanding,
              lines: (d.lines ?? []).map((l) => ({
                key: `po-${l.purchase_order_id}`,
                code: l.code,
                date: l.date,
                due_date: l.due_date,
                party: l.supplier_name,
                total: l.total_price,
                paid: l.total_payment,
                outstanding: l.outstanding,
                age_days: l.age_days,
                href: `/purchase/purchase-orders/${l.purchase_order_id}/detail`,
              })),
            }
          })
      }
      fetchExport={(v) =>
        reportsService.exportSupplierStatements({
          ...(v.supplier ? { supplier: v.supplier } : {}),
          ...(v.asOfDate ? { as_of_date: v.asOfDate } : {}),
        })
      }
      filters={
        <>
          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 300 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-subtle)', pointerEvents: 'none' }} />
            <input
              className="v2-input"
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Cari nama supplier (semua)"
              aria-label="Nama supplier"
              style={{ width: '100%', paddingLeft: 30 }}
            />
          </div>
          <FinancePeriodSelect className="v2-select" asOf={asOfDate} onChange={(p) => setAsOfDate(p.end_date)} />
          <input
            className="v2-input"
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            aria-label="Per tanggal"
            title="Per tanggal (kosong = hari ini)"
          />
        </>
      }
    />
  )
}
