'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { periodsService } from '@/services/accounting.service'

export interface FinancePeriod {
  id: number
  name: string
  start_date: string
  end_date: string
  is_closed: boolean
}

/** The company's accounting periods, newest first (shared cache across pages). */
export function useFinancePeriods(): FinancePeriod[] {
  const { data } = useQuery({
    queryKey: ['periods-all', 'finance-filter'],
    staleTime: 60_000,
    queryFn: () => periodsService.list({ per_page: 1000, sort: '-start_date' } as any).then((r) => r.data),
  })
  const items: any[] = (data as any)?.data?.data ?? (data as any)?.data ?? []
  return items
    .filter((p) => p?.id != null && p?.start_date && p?.end_date)
    .map((p) => ({
      id: Number(p.id),
      name: p.name ?? `Periode ${p.id}`,
      start_date: String(p.start_date).slice(0, 10),
      end_date: String(p.end_date).slice(0, 10),
      is_closed: !!p.is_closed,
    }))
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
}

/**
 * Accounting-period shortcut for a report's date filter. It holds no state of
 * its own: the option shown is the period whose dates equal the page's current
 * range (`start` + `end`) or, for as-of reports, whose end date equals `asOf`.
 * Editing the dates by hand therefore falls back to "Rentang tanggal sendiri".
 */
export default function FinancePeriodSelect({
  start,
  end,
  asOf,
  onChange,
  style,
  className,
}: {
  start?: string
  end?: string
  asOf?: string
  onChange: (period: FinancePeriod) => void
  style?: React.CSSProperties
  className?: string
}) {
  const periods = useFinancePeriods()
  const asOfMode = asOf !== undefined

  const matched = periods.find((p) =>
    asOfMode ? p.end_date === (asOf ?? '').slice(0, 10) : p.start_date === (start ?? '').slice(0, 10) && p.end_date === (end ?? '').slice(0, 10)
  )

  return (
    <select
      className={className}
      value={matched ? String(matched.id) : ''}
      onChange={(e) => {
        const period = periods.find((p) => String(p.id) === e.target.value)
        if (period) onChange(period)
      }}
      title="Isi tanggal dari periode akuntansi"
      style={{ cursor: 'pointer', minWidth: 180, ...style }}
    >
      <option value="">{asOfMode ? 'Tanggal sendiri' : 'Rentang tanggal sendiri'}</option>
      {periods.map((p) => (
        <option key={p.id} value={String(p.id)}>
          {p.name}
          {p.is_closed ? ' (ditutup)' : ''}
        </option>
      ))}
    </select>
  )
}
