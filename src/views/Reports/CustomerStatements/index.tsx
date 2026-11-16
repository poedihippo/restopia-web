'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/hooks/useApi'
import { reportsService } from '@/services/reports.service'
import SearchableSelect from '@/components/SearchableSelect'
import FinancePeriodSelect from '../FinancePeriodSelect'
import StatementReport from '../StatementReport'

export default function CustomerStatementsView() {
  const [customerId, setCustomerId] = useState(0)
  const [asOfDate, setAsOfDate] = useState('')

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => api.get('/customers', { params: { per_page: 1000, sort: 'name' } }).then(r => r.data),
  })
  const raw = (customersData as any)?.data
  const customers: any[] = Array.isArray(raw) ? raw : raw?.data ?? []
  const customerOptions = [
    { value: 0, label: 'Pilih customer' },
    ...customers.map((c: any) => ({ value: c.id as number, label: c.name as string, sublabel: c.code ?? c.phone })),
  ]

  return (
    <StatementReport
      title="Customer Statements"
      subtitle="Lihat statement piutang per customer, lalu ekspor ke Excel"
      filename="customer-statement.xlsx"
      partyLabel="Customer"
      queryKey="customer-statements-preview"
      emptyHint="Customer wajib dipilih."
      value={{ customerId, asOfDate }}
      validate={(v) => (v.customerId > 0 ? null : 'Pilih customer terlebih dahulu')}
      fetchData={(v) =>
        reportsService
          .getCustomerStatement({
            customer_id: v.customerId,
            ...(v.asOfDate ? { as_of_date: v.asOfDate } : {}),
          })
          .then((r) => {
            const d = r.data.data
            return {
              asOf: d.end_date,
              buckets: d.buckets,
              total: d.grand_total_outstanding,
              lines: (d.lines ?? []).map((l) => ({
                key: `${l.source_type}-${l.source_id}`,
                code: l.code,
                date: l.date,
                due_date: l.due_date,
                party: l.customer_name ?? '',
                total: l.total_price,
                paid: l.total_payment,
                outstanding: l.outstanding,
                age_days: l.age_days,
                href:
                  l.source_type === 'invoice'
                    ? `/transfer/invoices/${l.source_id}`
                    : l.source_type === 'sales_order'
                      ? `/sales/sales-orders/${l.source_id}/detail`
                      : undefined,
              })),
            }
          })
      }
      fetchExport={(v) =>
        reportsService.exportCustomerStatements({
          customer_id: v.customerId,
          ...(v.asOfDate ? { as_of_date: v.asOfDate } : {}),
        })
      }
      filters={
        <>
          <div style={{ flex: '1 1 220px', maxWidth: 300 }}>
            <SearchableSelect
              value={customerId}
              onChange={(v) => setCustomerId(Number(v) || 0)}
              options={customerOptions}
              placeholder="Pilih customer"
              searchPlaceholder="Cari customer..."
              loading={customersLoading}
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
