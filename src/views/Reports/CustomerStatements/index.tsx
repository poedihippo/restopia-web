'use client'

import React, { useEffect, useState } from 'react'
import api from '@/hooks/useApi'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import { reportsService } from '@/services/reports.service'
import SearchableSelect from '@/components/SearchableSelect'
import FinancePeriodSelect from '../FinancePeriodSelect'
import StatementReport from '../StatementReport'

export default function CustomerStatementsView() {
  const [customerId, setCustomerId] = useState(0)
  const [asOfDate, setAsOfDate] = useState('')

  const [customerSearch, setCustomerSearch] = useState('')
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCustomerSearch(customerSearch), 400)
    return () => clearTimeout(t)
  }, [customerSearch])

  const customerOpts = useInfiniteOptions<any>({
    queryKey: ['customers-all', 'statement', debouncedCustomerSearch],
    fetchPage: (page) =>
      api
        .get('/customers', {
          params: { page, per_page: 20, sort: 'name,id', 'filter[search]': debouncedCustomerSearch || undefined },
        })
        .then(r => r.data),
  })
  const customers: any[] = customerOpts.items
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
              loading={customerOpts.loading}
              onSearchChange={setCustomerSearch}
              {...customerOpts.selectProps}
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
