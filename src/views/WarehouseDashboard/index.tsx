'use client'

import { useState } from 'react'
import { useQuery, useQueryClient, useIsFetching } from '@tanstack/react-query'
import { AlertOctagon, FileText, Inbox, Layers, Send, ShoppingCart, Truck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes } from '@/hooks/useProductTypes'
import { useCentralCompanyScope } from '@/hooks/useCentralCompanyScope'
import { invoicesService } from '@/services/invoices.service'
import { productUomsService } from '@/services/product-uoms.service'
import { formatCurrency } from '@/utils/price'
import { formatDate } from '@/utils/date'
import { downloadExcel, money, reportHeader, type ExcelSheet } from '@/utils/excelExport'
import { toast } from 'sonner'
import {
  DashHeader,
  DataPanel,
  Hero,
  KpiTile,
  OPS_STYLES,
  PeriodFilter,
  QuickMenu,
  StatusPill,
  formatQty,
  PO_STATUS,
  getToday,
  getYesterday,
  listOf,
  periodLabel,
  pickTab,
  usePeriod,
  type PanelTab,
  type QuickLink,
} from '@/views/OpsDashboard/kit'
import { PO_EXPORT_HEAD, fetchPoForExport, mergePo, poColumns, poExportRows, poRows, usePoSet } from '@/views/OpsDashboard/poWatch'

const QUICK_LINKS: QuickLink[] = [
  { label: 'Incoming PO Requests', href: '/purchase/requested-orders', icon: Inbox, permission: 'purchase-order.menu' },
  { label: 'Purchase Orders', href: '/purchase/purchase-orders', icon: ShoppingCart, permission: 'purchase-order.menu' },
  { label: 'Internal Orders', href: '/purchase/internal-orders', icon: Send, permission: 'internal-purchase-order.menu' },
  { label: 'Kartu Stok', href: '/products/stock-card', icon: Layers, permission: 'stock-movement.menu' },
  { label: 'Invoices', href: '/transfer/invoices', icon: FileText, permission: 'invoice.menu' },
  { label: 'Deliveries', href: '/transfer/deliveries', icon: Truck, permission: 'delivery.menu' },
]

interface CardStockItem {
  id: number
  name?: string
  stock?: number
  product?: { name: string }
  uom?: { name: string; code?: string }
  card_stock?: { in?: { total?: number }; out?: { total?: number } }
}

export default function WarehouseDashboardView() {
  const { user, hasPermission } = useAuth()
  const branchId = Number((user as any)?.branch?.id) || 0
  const productTypes = useActiveBranchProductTypes()
  // Warehouse / production read the whole company's invoices (production branches' too).
  const { scopeParams } = useCentralCompanyScope()
  const queryClient = useQueryClient()
  const refreshing = useIsFetching({ queryKey: ['ops-dashboard'] }) + useIsFetching({ queryKey: ['ops-dashboard-po'] }) > 0
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['ops-dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['ops-dashboard-po'] })
  }

  const canPo = hasPermission('purchase-order.menu') || hasPermission('purchase-order.read')
  const canInternal = hasPermission('internal-purchase-order.menu') || hasPermission('internal-purchase-order.read') || canPo
  const canStock = hasPermission('stock-movement.read') || hasPermission('product-inventory.read')
  const canInvoice = hasPermission('invoice.read')

  const [incomingTab, setIncomingTab] = useState<string | null>(null)
  const [outgoingTab, setOutgoingTab] = useState<string | null>(null)
  const [stockTab, setStockTab] = useState<string | null>(null)
  const [invoiceTab, setInvoiceTab] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const { period, setFrom, setTo } = usePeriod()

  const incoming = usePoSet('incoming', branchId, canPo, period)
  const internal = usePoSet('internal', branchId, canInternal, period)
  const supplier = usePoSet('supplier', branchId, canPo, period)
  const incomingNew = mergePo(incoming.pending)
  const incomingToSend = mergePo(incoming.accepted, incoming.partial)
  const incomingLatest = mergePo(incoming.latest)
  const internalOpen = mergePo(internal.pending, internal.accepted, internal.partial)
  const supplierOpen = mergePo(supplier.pending, supplier.accepted, supplier.partial)
  const supplierLatest = mergePo(supplier.latest)

  // Card stock for the period: current stock + in/out totals per product UOM.
  const cardStock = useQuery({
    queryKey: ['ops-dashboard', 'card-stock', productTypes, period.from, period.to],
    enabled: canStock,
    queryFn: () =>
      productUomsService
        .cardStock({
          page: 1,
          per_page: 100,
          sort: 'name:product_uoms.name',
          include: 'product,uom',
          'filter[start_date]': period.from,
          'filter[end_date]': period.to,
          'filter[product_types]': productTypes,
        } as any)
        .then((r) => r.data),
  })

  const invoiceQuery = (key: string, extra: Record<string, unknown>) => ({
    queryKey: ['ops-dashboard', 'invoices', key, scopeParams.scope, extra],
    enabled: canInvoice,
    queryFn: () =>
      invoicesService
        .list({ page: 1, per_page: 8, sort: '-created_at', include: 'billed_branch', ...scopeParams, ...extra } as any)
        .then((r) => r.data),
  })
  const invoicesOverdue = useQuery(invoiceQuery('overdue', { 'filter[status]': 'issued', 'filter[due_date_lte]': getYesterday() }))
  const invoicesOpen = useQuery(invoiceQuery('open', { 'filter[status]': 'issued' }))
  const invoicesLatest = useQuery(invoiceQuery('period', { 'filter[date_gte]': period.from, 'filter[date_lte]': period.to }))

  const stockItems = listOf<CardStockItem>(cardStock.data).items.map((it) => ({
    it,
    stock: Number(it.stock) || 0,
    in: Number(it.card_stock?.in?.total) || 0,
    out: Number(it.card_stock?.out?.total) || 0,
  }))
  const emptyStock = stockItems.filter((r) => r.stock <= 0)
  const topOut = stockItems.filter((r) => r.out > 0).sort((a, b) => b.out - a.out)
  const moved = stockItems.filter((r) => r.in > 0 || r.out > 0)
  const overdue = listOf(invoicesOverdue.data)
  const openInv = listOf(invoicesOpen.data)

  const incomingTabs: PanelTab[] = [
    { key: 'new', label: 'Baru', count: incomingNew.total },
    { key: 'send', label: 'Siap kirim', count: incomingToSend.total },
    { key: 'latest', label: 'Periode ini', count: incomingLatest.total, quiet: true },
  ]
  const incomingActive = pickTab(incomingTab, incomingTabs.slice(0, 2), 'latest')
  const incomingShown = incomingActive === 'new' ? incomingNew : incomingActive === 'send' ? incomingToSend : incomingLatest

  const outgoingTabs: PanelTab[] = [
    { key: 'supplier', label: 'Ke supplier', count: supplierOpen.total },
    { key: 'internal', label: 'Internal', count: internalOpen.total },
    { key: 'latest', label: 'Supplier · periode', count: supplierLatest.total, quiet: true },
  ]
  const outgoingActive = pickTab(outgoingTab, outgoingTabs.slice(0, 2), 'latest')
  const outgoingShown = outgoingActive === 'supplier' ? supplierOpen : outgoingActive === 'internal' ? internalOpen : supplierLatest
  const outgoingKind = outgoingActive === 'internal' ? 'internal' : 'supplier'

  const stockTabs: PanelTab[] = [
    { key: 'empty', label: 'Habis', count: emptyStock.length },
    { key: 'out', label: 'Paling banyak keluar' },
    { key: 'moved', label: 'Semua bergerak', count: moved.length, quiet: true },
  ]
  const stockActive = pickTab(stockTab, stockTabs.slice(0, 1), 'out')
  const stockShown = stockActive === 'empty' ? emptyStock : stockActive === 'out' ? topOut : moved

  const invoiceTabs: PanelTab[] = [
    { key: 'overdue', label: 'Lewat tempo', count: overdue.total },
    { key: 'open', label: 'Belum lunas', count: openInv.total },
    { key: 'latest', label: 'Periode ini', count: listOf(invoicesLatest.data).total, quiet: true },
  ]
  const invoiceActive = pickTab(invoiceTab, invoiceTabs.slice(0, 2), 'latest')
  const invoiceShown = invoiceActive === 'overdue' ? invoicesOverdue : invoiceActive === 'open' ? invoicesOpen : invoicesLatest
  const today = getToday()

  // Excel: summary + open POs (live) + everything in the period, up to 100 rows per sheet.
  const handleExport = async () => {
    setExporting(true)
    try {
      const branch = (user as any)?.branch?.name ?? '—'
      const header = (title: string) => reportHeader({ title, branch, period: periodLabel(period) })
      const invoices = (extra: Record<string, unknown>) =>
        invoicesService
          .list({ page: 1, per_page: 100, sort: '-created_at', include: 'billed_branch', ...scopeParams, ...extra } as any)
          .then((r) => listOf((r as any).data).items)
      const [incomingOpen, incomingPeriod, supplierOpenAll, supplierPeriod, internalOpenAll, invOpen, invPeriod] = await Promise.all([
        canPo ? fetchPoForExport('incoming', branchId, 'open') : [],
        canPo ? fetchPoForExport('incoming', branchId, period) : [],
        canPo ? fetchPoForExport('supplier', branchId, 'open') : [],
        canPo ? fetchPoForExport('supplier', branchId, period) : [],
        canInternal ? fetchPoForExport('internal', branchId, 'open') : [],
        canInvoice ? invoices({ 'filter[status]': 'issued' }) : [],
        canInvoice ? invoices({ 'filter[date_gte]': period.from, 'filter[date_lte]': period.to }) : [],
      ])
      const sheets: ExcelSheet[] = [
        {
          name: 'Ringkasan',
          rows: [
            ...header('Ringkasan Warehouse Dashboard'),
            ['Metrik', 'Nilai'],
            ['PO masuk baru', incomingNew.total],
            ['PO siap dikirim', incomingToSend.total],
            ['PO ke supplier berjalan', supplierOpen.total],
            ['Internal PO berjalan', internalOpen.total],
            ['Stok habis', emptyStock.length],
            ['Invoice lewat tempo', overdue.total],
            ['Invoice belum lunas', openInv.total],
          ],
          cols: [30, 16],
        },
      ]
      const poSheet = (name: string, items: any[], kind: 'incoming' | 'internal' | 'supplier') => ({
        name,
        rows: [...header(name), PO_EXPORT_HEAD, ...(items.length ? poExportRows(items, kind) : [['Tidak ada data']])],
        cols: [20, 26, 14, 50, 12, 14],
      })
      const invoiceSheet = (name: string, items: any[]) => ({
        name,
        rows: [
          ...header(name),
          ['No. Invoice', 'Ditagih ke', 'Tanggal', 'Jatuh tempo', 'Total', 'Dibayar', 'Sisa', 'Status'],
          ...(items.length
            ? items.map((inv: any) => {
                const late = inv.status === 'issued' && !!inv.due_date && String(inv.due_date).slice(0, 10) < today
                return [
                  inv.code ?? '',
                  inv.billed_branch?.name ?? '',
                  formatDate(inv.date ?? inv.created_at),
                  inv.due_date ? formatDate(inv.due_date) : '',
                  money(inv.total_price),
                  money(inv.total_payment),
                  money(Math.max(0, (Number(inv.total_price) || 0) - (Number(inv.total_payment) || 0))),
                  late ? 'Lewat tempo' : PO_STATUS[inv.status]?.label ?? inv.status,
                ]
              })
            : [['Tidak ada data']]),
        ],
        cols: [20, 26, 14, 14, 16, 16, 16, 14],
      })
      if (canPo) sheets.push(poSheet('PO Masuk Belum Selesai', incomingOpen, 'incoming'), poSheet('PO Masuk Periode', incomingPeriod, 'incoming'))
      if (canStock)
        sheets.push({
          name: 'Kartu Stok',
          rows: [
            ...header('Kartu Stok'),
            ['Produk', 'UOM', 'Masuk', 'Keluar', 'Stok'],
            ...(stockItems.length ? stockItems.map(({ it, stock, in: inQty, out }) => [it.product?.name ?? it.name ?? '', it.uom?.name ?? '', inQty, out, stock]) : [['Tidak ada data']]),
          ],
          cols: [36, 14, 12, 12, 12],
        })
      if (canInvoice) sheets.push(invoiceSheet('Invoice Belum Lunas', invOpen), invoiceSheet('Invoice Periode', invPeriod))
      if (canPo) sheets.push(poSheet('PO Supplier Berjalan', supplierOpenAll, 'supplier'), poSheet('PO Supplier Periode', supplierPeriod, 'supplier'))
      if (canInternal) sheets.push(poSheet('Internal PO Berjalan', internalOpenAll, 'internal'))
      downloadExcel(`warehouse-dashboard-${branch.replace(/\s+/g, '-').toLowerCase()}-${period.from}_${period.to}.xlsx`, sheets)
    } catch {
      toast.error('Gagal membuat file Excel')
    } finally {
      setExporting(false)
    }
  }

  const headline =
    incomingNew.total > 0
      ? `${incomingNew.total} PO masuk menunggu diterima`
      : overdue.total > 0
        ? `${overdue.total} invoice lewat jatuh tempo`
        : emptyStock.length > 0
          ? `${emptyStock.length} item stok habis`
          : 'Gudang aman, tidak ada yang mendesak 🎉'
  const body = 'Terima & kirim PO dari cabang produksi, pantau PO ke supplier, kartu stok, dan tagihan invoice cabang produksi.'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0 24px' }}>
      <style>{OPS_STYLES}</style>
      <DashHeader title="Warehouse Dashboard" subtitle="PO masuk, PO keluar, kartu stok, dan invoice" onRefresh={refresh} refreshing={refreshing}>
        <PeriodFilter period={period} setFrom={setFrom} setTo={setTo} onExport={handleExport} exporting={exporting} />
      </DashHeader>
      <Hero expectedType="warehouse" headline={headline} body={body} />

      <div className="ops-kpis">
        {canPo && <KpiTile icon={Inbox} label="PO masuk baru" value={incomingNew.total} tone="warning" href="/purchase/requested-orders" hint="Menunggu diterima / ditolak" loading={incomingNew.loading} />}
        {canPo && <KpiTile icon={Truck} label="PO siap dikirim" value={incomingToSend.total} tone="info" href="/purchase/requested-orders" hint="Diterima, belum terkirim penuh" loading={incomingToSend.loading} />}
        {canPo && <KpiTile icon={ShoppingCart} pastel="lavender" label="PO ke supplier" value={supplierOpen.total} href="/purchase/purchase-orders" hint="Belum diterima penuh" loading={supplierOpen.loading} />}
        {canStock && <KpiTile icon={AlertOctagon} label="Stok habis" value={emptyStock.length} tone="danger" href="/products/stock-card" hint="Dari 100 item pertama kartu stok" loading={cardStock.isLoading} />}
        {canInvoice && <KpiTile icon={FileText} pastel="mint" label="Invoice lewat tempo" value={overdue.total} tone="danger" href="/transfer/invoices" hint={`${openInv.total.toLocaleString('id-ID')} invoice belum lunas`} loading={invoicesOverdue.isLoading} />}
      </div>

      <div className="ops-layout">
        <div className="ops-main">
          {canPo && (
            <DataPanel
              icon={Inbox}
              title="PO masuk"
              href="/purchase/requested-orders"
              linkLabel="Incoming PO Requests"
              tabs={incomingTabs}
              active={incomingActive}
              onTab={setIncomingTab}
              columns={poColumns('incoming')}
              rows={poRows(incomingShown.items, 'incoming')}
              loading={incomingShown.loading}
              error={incomingShown.error}
              empty={incomingActive === 'new' ? 'Tidak ada PO masuk baru.' : incomingActive === 'send' ? 'Semua PO yang diterima sudah terkirim.' : 'Tidak ada PO masuk di periode ini.'}
            />
          )}

          <div className="ops-panels">
            {canStock && (
              <DataPanel
                icon={Layers}
                title="Kartu stok · periode ini"
                href="/products/stock-card"
                linkLabel="Kartu Stok"
                tabs={stockTabs}
                active={stockActive}
                onTab={setStockTab}
                columns={[
                  { key: 'product', label: 'Produk' },
                  { key: 'in', label: 'Masuk', align: 'right' },
                  { key: 'out', label: 'Keluar', align: 'right' },
                  { key: 'stock', label: 'Stok', align: 'right' },
                ]}
                rows={stockShown.slice(0, 8).map(({ it, stock, in: inQty, out }) => ({
                  key: it.id,
                  href: '/products/stock-card',
                  cells: {
                    product: (
                      <>
                        <span className="ops-code">{it.product?.name ?? it.name ?? `#${it.id}`}</span>
                        <span className="ops-sub">{it.uom?.name}</span>
                      </>
                    ),
                    in: formatQty(inQty),
                    out: formatQty(out),
                    stock: <strong style={{ color: stock <= 0 ? 'var(--destructive)' : out > 0 && stock <= out * 0.25 ? 'var(--warning)' : 'var(--foreground)' }}>{formatQty(stock)}</strong>,
                  },
                }))}
                loading={cardStock.isLoading}
                error={cardStock.isError}
                empty={stockActive === 'empty' ? 'Tidak ada stok yang habis.' : 'Belum ada pergerakan stok di periode ini.'}
              />
            )}
            {canInvoice && (
              <DataPanel
                icon={FileText}
                title="Invoice (satu perusahaan)"
                href="/transfer/invoices"
                linkLabel="Invoices"
                tabs={invoiceTabs}
                active={invoiceActive}
                onTab={setInvoiceTab}
                columns={[
                  { key: 'code', label: 'No. Invoice' },
                  { key: 'branch', label: 'Ditagih ke' },
                  { key: 'due', label: 'Jatuh tempo' },
                  { key: 'left', label: 'Sisa', align: 'right' },
                  { key: 'status', label: 'Status', align: 'right' },
                ]}
                rows={listOf(invoiceShown.data).items.map((inv: any) => {
                  const left = Math.max(0, (Number(inv.total_price) || 0) - (Number(inv.total_payment) || 0))
                  const late = inv.status === 'issued' && !!inv.due_date && String(inv.due_date).slice(0, 10) < today
                  return {
                    key: inv.id,
                    href: `/transfer/invoices/${inv.id}`,
                    cells: {
                      code: (
                        <>
                          <span className="ops-code">{inv.code ?? `Invoice #${inv.id}`}</span>
                          <span className="ops-sub">{formatDate(inv.date ?? inv.created_at)}</span>
                        </>
                      ),
                      branch: inv.billed_branch?.name ?? '—',
                      due: inv.due_date ? <span style={{ color: late ? 'var(--destructive)' : undefined }}>{formatDate(inv.due_date)}</span> : '—',
                      left: formatCurrency(left),
                      status: <StatusPill status={late ? 'overdue' : inv.status} />,
                    },
                  }
                })}
                loading={invoiceShown.isLoading}
                error={invoiceShown.isError}
                empty={invoiceActive === 'overdue' ? 'Tidak ada invoice lewat tempo.' : invoiceActive === 'open' ? 'Semua invoice sudah lunas.' : 'Tidak ada invoice di periode ini.'}
              />
            )}
          </div>

          {canPo && (
            <DataPanel
              icon={Send}
              title="PO keluar (supplier & internal)"
              href={outgoingKind === 'internal' ? '/purchase/internal-orders' : '/purchase/purchase-orders'}
              linkLabel={outgoingKind === 'internal' ? 'Internal Orders' : 'Purchase Orders'}
              tabs={outgoingTabs}
              active={outgoingActive}
              onTab={setOutgoingTab}
              columns={poColumns(outgoingKind)}
              rows={poRows(outgoingShown.items, outgoingKind)}
              loading={outgoingShown.loading}
              error={outgoingShown.error}
              empty={outgoingActive === 'latest' ? 'Tidak ada PO supplier di periode ini.' : 'Tidak ada PO yang berjalan.'}
            />
          )}
        </div>
        <aside className="ops-side">
          <QuickMenu links={QUICK_LINKS} />
        </aside>
      </div>
    </div>
  )
}
