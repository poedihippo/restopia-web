import { downloadExcel, money, reportHeader, type ExcelRow, type ExcelSheet } from '@/utils/excelExport'
import type { ChartBreakdown, ChartTimeSeries, DashboardChartKey, DashboardChartsResponse } from '@/types/api'

/*
 * Dashboard → Excel: one Summary sheet with the KPI band, one sheet per chart
 * the API returned, then the watch-lists and recent activity — the same numbers
 * the page shows for the selected period/branch.
 */

const CHART_TITLES: Record<DashboardChartKey, string> = {
  sales_trend: 'Sales Trend',
  sales_by_channel: 'Sales by Channel',
  payment_methods: 'Payment Methods',
  top_products: 'Top Products',
  sales_by_hour: 'Sales by Hour',
  production_trend: 'Production Trend',
  top_produced_products: 'Top Produced Products',
  purchase_trend: 'Purchase Trend',
  top_suppliers: 'Top Suppliers',
  stock_flow: 'Stock Flow',
  stock_health: 'Stock Health',
  branch_comparison: 'Branch Comparison',
}

// Breakdowns whose value is money; the rest are quantities or counts.
const MONEY_BREAKDOWNS = new Set<DashboardChartKey>(['sales_by_channel', 'payment_methods', 'top_suppliers', 'branch_comparison'])
const MONEY_SERIES = new Set(['revenue', 'spending'])

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0)

function timeSeriesRows(key: DashboardChartKey, chart: ChartTimeSeries): ExcelRow[] {
  const hourly = key === 'sales_by_hour'
  const cell = (v: number, seriesKey: string) => (MONEY_SERIES.has(seriesKey) ? money(v) : v)
  return [
    [hourly ? 'Hour' : 'Period', ...chart.series.map((s) => s.label)],
    ...chart.labels.map((label, i) => [
      hourly ? `${label}:00` : label,
      ...chart.series.map((s) => cell(s.data[i] ?? 0, s.key)),
    ]),
    [],
    ['Total', ...chart.series.map((s) => cell(s.total, s.key))],
    ...(hourly
      ? []
      : [
          ['Previous period', ...chart.series.map((s) => (s.previous_total == null ? '' : cell(s.previous_total, s.key)))],
          ['Change %', ...chart.series.map((s) => (s.change_pct == null ? '' : s.change_pct))],
        ]),
  ]
}

function breakdownRows(key: DashboardChartKey, chart: ChartBreakdown): ExcelRow[] {
  const isMoney = MONEY_BREAKDOWNS.has(key)
  const valueHead = isMoney ? 'Amount' : key === 'stock_health' ? 'Items' : 'Quantity'
  const countHead = key === 'stock_health' ? null : key.startsWith('top_') && !isMoney ? 'Orders' : 'Transactions'
  const total = chart.total || chart.items.reduce((a, i) => a + i.value, 0)
  return [
    ['#', 'Name', valueHead, ...(countHead ? [countHead] : []), 'Share %'],
    ...chart.items.map((it, i) => [
      i + 1,
      it.label,
      isMoney ? money(it.value) : it.value,
      ...(countHead ? [it.count] : []),
      pct(it.value, total),
    ]),
    [],
    ['', 'Total', isMoney ? money(total) : total],
  ]
}

export function exportDashboardExcel(input: {
  branch: string
  period: string
  kpis: [string, ExcelRow[number]][]
  charts?: DashboardChartsResponse
  lists: { name: string; head: string[]; rows: ExcelRow[] }[]
}) {
  const header = (title: string) => reportHeader({ title, branch: input.branch, period: input.period })

  const sheets: ExcelSheet[] = [
    {
      name: 'Summary',
      rows: [...header('Dashboard Summary'), ['Metric', 'Value'], ...input.kpis.map(([k, v]) => [k, v])],
      cols: [28, 22],
    },
  ]

  for (const key of input.charts?.available_charts ?? []) {
    const chart = input.charts?.[key]
    if (!chart) continue
    const title = CHART_TITLES[key] ?? key
    const rows = 'series' in chart ? timeSeriesRows(key, chart) : breakdownRows(key, chart)
    sheets.push({ name: title, rows: [...header(title), ...rows], cols: [22, 28, 18, 16, 12] })
  }

  for (const list of input.lists) {
    sheets.push({
      name: list.name,
      rows: [...header(list.name), list.head, ...(list.rows.length ? list.rows : [['No data']])],
      cols: list.head.map((h) => Math.max(12, h.length + 4, h === 'Name' || h === 'Customer' ? 30 : 0)),
    })
  }

  const stamp = new Date().toLocaleDateString('en-CA')
  downloadExcel(`dashboard-${input.branch.replace(/\s+/g, '-').toLowerCase()}-${stamp}.xlsx`, sheets)
}
