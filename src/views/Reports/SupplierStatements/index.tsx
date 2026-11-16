'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsService } from '@/services/reports.service'
import SearchableSelect from '@/components/SearchableSelect'
import FinancePeriodSelect from '../FinancePeriodSelect'
import StatementReport from '../StatementReport'

export default function SupplierStatementsView() {
  const [supplier, setSupplier] = useState('')
  const [asOfDate, setAsOfDate] = useState('')

  const value = { supplier: supplier.trim(), asOfDate }

  // The API matches the supplier name exactly (case-insensitive), so offer the
  // parties that actually appear on the unfiltered statement — this also covers
  // inter-branch POs, whose "supplier" is the supplying branch.
  const { data: partyNames = [], isLoading: partiesLoading } = useQuery({
    queryKey: ['supplier-statement-parties', asOfDate],
    queryFn: () =>
      reportsService
        .getSupplierStatement(asOfDate ? { as_of_date: asOfDate } : {})
        .then((r) => Array.from(new Set((r.data.data.lines ?? []).map((l) => l.supplier_name).filter(Boolean))).sort()),
  })
  const partyOptions = useMemo(
    () => [{ value: '', label: 'Semua supplier' }, ...partyNames.map((n) => ({ value: n, label: n }))],
    [partyNames],
  )

  return (
    <StatementReport
      title="Supplier Statements"
      subtitle="Lihat statement hutang per supplier, lalu ekspor ke Excel"
      filename="supplier-statement.xlsx"
      partyLabel="Supplier"
      autoLoad
      queryKey="supplier-statements-preview"
      emptyHint="Pilih Semua supplier untuk menampilkan semua supplier."
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
          <div style={{ flex: '1 1 220px', maxWidth: 300 }}>
            <SearchableSelect
              value={supplier}
              onChange={(v) => setSupplier(String(v ?? ''))}
              options={partyOptions}
              placeholder="Semua supplier"
              searchPlaceholder="Cari nama supplier..."
              loading={partiesLoading}
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
