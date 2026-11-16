'use client'

import { useState } from 'react'
import { useQuery, useQueryClient, useIsFetching } from '@tanstack/react-query'
import { ChefHat, Factory, Inbox, Layers, Send, Truck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes } from '@/hooks/useProductTypes'
import { productionsService } from '@/services/productions.service'
import { recipesService } from '@/services/recipes.service'
import { productUomsService } from '@/services/product-uoms.service'
import { formatDate } from '@/utils/date'
import { downloadExcel, reportHeader, type ExcelSheet } from '@/utils/excelExport'
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
  { label: 'Internal Orders', href: '/purchase/internal-orders', icon: Send, permission: 'internal-purchase-order.menu' },
  { label: 'Productions', href: '/production', icon: Factory, permission: 'production.menu' },
  { label: 'Recipes', href: '/production/recipes', icon: ChefHat, permission: 'recipe.menu' },
  { label: 'SR/DN/Outlet', href: '/products/stock-per-branch', icon: Layers, permission: ['stock-movement.menu', 'product-inventory.menu'] },
  { label: 'Deliveries', href: '/transfer/deliveries', icon: Truck, permission: 'delivery.menu' },
]

interface StockPositionItem {
  id: number
  name?: string
  stock?: number
  total_incoming_po?: number
  total_delivered?: number
  product?: { name: string }
  uom?: { name: string; code?: string }
}

export default function ProductionDashboardView() {
  const { user, hasPermission } = useAuth()
  const branchId = Number((user as any)?.branch?.id) || 0
  const productTypes = useActiveBranchProductTypes()
  const queryClient = useQueryClient()
  const refreshing = useIsFetching({ queryKey: ['ops-dashboard'] }) + useIsFetching({ queryKey: ['ops-dashboard-po'] }) > 0
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['ops-dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['ops-dashboard-po'] })
  }

  const canPo = hasPermission('purchase-order.menu') || hasPermission('purchase-order.read')
  const canInternal = hasPermission('internal-purchase-order.menu') || hasPermission('internal-purchase-order.read') || canPo
  const canProduction = hasPermission('production.menu') || hasPermission('production.read')
  const canRecipe = hasPermission('recipe.menu') || hasPermission('recipe.read')
  const canStock = hasPermission('stock-movement.read') || hasPermission('product-inventory.read')

  const [incomingTab, setIncomingTab] = useState<string | null>(null)
  const [internalTab, setInternalTab] = useState<string | null>(null)
  const [productionTab, setProductionTab] = useState<string | null>(null)
  const [demandTab, setDemandTab] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const { period, setFrom, setTo } = usePeriod()

  const incoming = usePoSet('incoming', branchId, canPo, period)
  const internal = usePoSet('internal', branchId, canInternal, period)
  const incomingNew = mergePo(incoming.pending)
  const incomingToSend = mergePo(incoming.accepted, incoming.partial)
  const incomingLatest = mergePo(incoming.latest)
  const internalOpen = mergePo(internal.pending, internal.accepted, internal.partial)
  const internalLatest = mergePo(internal.latest)

  const productionsPending = useQuery({
    queryKey: ['ops-dashboard', 'productions', 'pending', branchId],
    enabled: canProduction,
    queryFn: () =>
      productionsService
        .list({ page: 1, per_page: 8, sort: '-created_at', include: 'branch,production_details', 'filter[status]': 'pending', 'filter[branch_id]': branchId || undefined } as any)
        .then((r) => r.data),
  })
  const productionsLatest = useQuery({
    queryKey: ['ops-dashboard', 'productions', 'period', branchId, period.from, period.to],
    enabled: canProduction,
    queryFn: () =>
      productionsService
        .list({ page: 1, per_page: 8, sort: '-created_at', include: 'branch,production_details', 'filter[date_gte]': period.from, 'filter[date_lte]': period.to, 'filter[branch_id]': branchId || undefined } as any)
        .then((r) => r.data),
  })
  const productionsMonth = useQuery({
    queryKey: ['ops-dashboard', 'productions', 'final-period', branchId, period.from, period.to],
    enabled: canProduction,
    queryFn: () =>
      productionsService
        .list({ page: 1, per_page: 1, 'filter[status]': 'final', 'filter[date_gte]': period.from, 'filter[date_lte]': period.to, 'filter[branch_id]': branchId || undefined } as any)
        .then((r) => r.data),
  })
  const recipes = useQuery({
    queryKey: ['ops-dashboard', 'recipes', 'count'],
    enabled: canRecipe,
    queryFn: () => recipesService.list({ page: 1, per_page: 1 } as any).then((r) => r.data),
  })
  // SR/DN/Outlet for the period: ordered (incoming PO) vs delivered vs stock.
  const demand = useQuery({
    queryKey: ['ops-dashboard', 'stock-position', productTypes, period.from, period.to],
    enabled: canStock,
    queryFn: () =>
      productUomsService
        .stockPosition({
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

  const pending = listOf(productionsPending.data)
  const latestProd = listOf(productionsLatest.data)
  const demandAll = listOf<StockPositionItem>(demand.data)
    .items.map((it) => {
      const ordered = Number(it.total_incoming_po) || 0
      const sent = Number(it.total_delivered) || 0
      const stock = Number(it.stock) || 0
      return { it, ordered, sent, stock, open: Math.max(0, ordered - sent), short: Math.max(0, ordered - sent - stock) }
    })
    .filter((r) => r.ordered > 0)
    .sort((a, b) => b.short - a.short || b.open - a.open || b.ordered - a.ordered)
  const demandShort = demandAll.filter((r) => r.short > 0)

  const incomingTabs: PanelTab[] = [
    { key: 'new', label: 'Baru', count: incomingNew.total },
    { key: 'send', label: 'Siap kirim', count: incomingToSend.total },
    { key: 'latest', label: 'Periode ini', count: incomingLatest.total, quiet: true },
  ]
  const incomingActive = pickTab(incomingTab, incomingTabs.slice(0, 2), 'latest')
  const incomingShown = incomingActive === 'new' ? incomingNew : incomingActive === 'send' ? incomingToSend : incomingLatest

  const internalTabs: PanelTab[] = [
    { key: 'open', label: 'Berjalan', count: internalOpen.total },
    { key: 'latest', label: 'Periode ini', count: internalLatest.total, quiet: true },
  ]
  const internalActive = pickTab(internalTab, internalTabs.slice(0, 1), 'latest')
  const internalShown = internalActive === 'open' ? internalOpen : internalLatest

  const productionTabs: PanelTab[] = [
    { key: 'pending', label: 'Pending', count: pending.total },
    { key: 'latest', label: 'Periode ini', count: latestProd.total, quiet: true },
  ]
  const productionActive = pickTab(productionTab, productionTabs.slice(0, 1), 'latest')
  const productionShown = productionActive === 'pending' ? productionsPending : productionsLatest

  const demandTabs: PanelTab[] = [
    { key: 'short', label: 'Kurang stok', count: demandShort.length },
    { key: 'all', label: 'Semua dipesan', count: demandAll.length, quiet: true },
  ]
  const demandActive = pickTab(demandTab, demandTabs.slice(0, 1), 'all')
  const demandShown = demandActive === 'short' ? demandShort : demandAll

  const openWork = incomingNew.total + incomingToSend.total + pending.total
  const headline =
    openWork === 0 ? 'Tidak ada pesanan yang menunggu 🎉' : incomingNew.total > 0 ? `${incomingNew.total} PO masuk menunggu diterima` : `${openWork} pekerjaan produksi menunggu`
  const body =
    demandShort.length > 0
      ? `${demandShort.length} produk dipesan melebihi stok — jadwalkan produksinya, lalu kirim PO yang sudah diterima.`
      : 'Terima PO masuk, jalankan produksi sesuai resep, lalu kirim ke cabang pemesan.'

  // Excel: summary + open POs (live) + everything in the period, up to 100 rows per sheet.
  const handleExport = async () => {
    setExporting(true)
    try {
      const branch = (user as any)?.branch?.name ?? '—'
      const header = (title: string) => reportHeader({ title, branch, period: periodLabel(period) })
      const [incomingOpen, incomingPeriod, internalOpenAll, internalPeriod, prodPeriod] = await Promise.all([
        canPo ? fetchPoForExport('incoming', branchId, 'open') : [],
        canPo ? fetchPoForExport('incoming', branchId, period) : [],
        canInternal ? fetchPoForExport('internal', branchId, 'open') : [],
        canInternal ? fetchPoForExport('internal', branchId, period) : [],
        canProduction
          ? productionsService
              .list({ page: 1, per_page: 100, sort: '-created_at', include: 'production_details', 'filter[date_gte]': period.from, 'filter[date_lte]': period.to, 'filter[branch_id]': branchId || undefined } as any)
              .then((r) => listOf((r as any).data).items)
          : [],
      ])
      const sheets: ExcelSheet[] = [
        {
          name: 'Ringkasan',
          rows: [
            ...header('Ringkasan Production Dashboard'),
            ['Metrik', 'Nilai'],
            ['PO masuk baru', incomingNew.total],
            ['PO siap dikirim', incomingToSend.total],
            ['Internal PO berjalan', internalOpen.total],
            ['Produksi pending', pending.total],
            ['Produksi selesai di periode', listOf(productionsMonth.data).total],
            ['Produk kurang stok', demandShort.length],
            ['Resep', listOf(recipes.data).total],
          ],
          cols: [30, 16],
        },
      ]
      const poSheet = (name: string, items: any[], kind: 'incoming' | 'internal') => ({
        name,
        rows: [...header(name), PO_EXPORT_HEAD, ...(items.length ? poExportRows(items, kind) : [['Tidak ada data']])],
        cols: [20, 26, 14, 50, 12, 14],
      })
      if (canPo) sheets.push(poSheet('PO Masuk Belum Selesai', incomingOpen, 'incoming'), poSheet('PO Masuk Periode', incomingPeriod, 'incoming'))
      if (canStock)
        sheets.push({
          name: 'Permintaan vs Stok',
          rows: [
            ...header('Permintaan vs Stok'),
            ['Produk', 'UOM', 'Dipesan', 'Terkirim', 'Stok', 'Kurang'],
            ...(demandAll.length ? demandAll.map(({ it, ordered, sent, stock, short }) => [it.product?.name ?? it.name ?? '', it.uom?.name ?? '', ordered, sent, stock, short]) : [['Tidak ada data']]),
          ],
          cols: [36, 14, 12, 12, 12, 12],
        })
      if (canProduction)
        sheets.push({
          name: 'Produksi Periode',
          rows: [
            ...header('Produksi Periode'),
            ['Kode', 'Tanggal', 'Jumlah produk', 'Status', 'Keterangan'],
            ...(prodPeriod.length ? prodPeriod.map((p: any) => [p.code ?? '', formatDate(p.date ?? p.created_at), (p.production_details ?? []).length, p.status, p.description ?? '']) : [['Tidak ada data']]),
          ],
          cols: [20, 14, 14, 12, 36],
        })
      if (canInternal) sheets.push(poSheet('Internal PO Berjalan', internalOpenAll, 'internal'), poSheet('Internal PO Periode', internalPeriod, 'internal'))
      downloadExcel(`production-dashboard-${branch.replace(/\s+/g, '-').toLowerCase()}-${period.from}_${period.to}.xlsx`, sheets)
    } catch {
      toast.error('Gagal membuat file Excel')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0 24px' }}>
      <style>{OPS_STYLES}</style>
      <DashHeader title="Production Dashboard" subtitle="PO masuk, internal order, dan produksi cabang ini" onRefresh={refresh} refreshing={refreshing}>
        <PeriodFilter period={period} setFrom={setFrom} setTo={setTo} onExport={handleExport} exporting={exporting} />
      </DashHeader>
      <Hero expectedType="production" headline={headline} body={body} />

      <div className="ops-kpis">
        {canPo && <KpiTile icon={Inbox} label="PO masuk baru" value={incomingNew.total} tone="warning" href="/purchase/requested-orders" hint="Menunggu diterima / ditolak" loading={incomingNew.loading} />}
        {canPo && <KpiTile icon={Truck} label="PO siap dikirim" value={incomingToSend.total} tone="info" href="/purchase/requested-orders" hint="Diterima, belum terkirim penuh" loading={incomingToSend.loading} />}
        {canInternal && <KpiTile icon={Send} label="Internal PO berjalan" value={internalOpen.total} href="/purchase/internal-orders" hint="Order bahan ke gudang / cabang lain" loading={internalOpen.loading} />}
        {canProduction && <KpiTile icon={Factory} pastel="mint" label="Produksi pending" value={pending.total} tone="warning" href="/production" hint={`${listOf(productionsMonth.data).total.toLocaleString('id-ID')} selesai di periode ini`} loading={productionsPending.isLoading} />}
        {canRecipe && <KpiTile icon={ChefHat} pastel="coral" label="Resep" value={listOf(recipes.data).total} href="/production/recipes" hint="Total resep terdaftar" loading={recipes.isLoading} />}
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
                title="Permintaan vs stok · periode ini"
                href="/products/stock-per-branch"
                linkLabel="SR/DN/Outlet"
                tabs={demandTabs}
                active={demandActive}
                onTab={setDemandTab}
                columns={[
                  { key: 'product', label: 'Produk' },
                  { key: 'ordered', label: 'Dipesan', align: 'right' },
                  { key: 'sent', label: 'Terkirim', align: 'right' },
                  { key: 'stock', label: 'Stok', align: 'right' },
                  { key: 'short', label: 'Kurang', align: 'right' },
                ]}
                rows={demandShown.slice(0, 8).map(({ it, ordered, sent, stock, short }) => ({
                  key: it.id,
                  href: '/products/stock-per-branch',
                  cells: {
                    product: (
                      <>
                        <span className="ops-code">{it.product?.name ?? it.name ?? `#${it.id}`}</span>
                        <span className="ops-sub">{it.uom?.name}</span>
                      </>
                    ),
                    ordered: formatQty(ordered),
                    sent: formatQty(sent),
                    stock: formatQty(stock),
                    short: short > 0 ? <strong style={{ color: 'var(--destructive)' }}>{formatQty(short)}</strong> : <span style={{ color: 'var(--success)' }}>cukup</span>,
                  },
                }))}
                loading={demand.isLoading}
                error={demand.isError}
                empty={demandActive === 'short' ? 'Stok mencukupi semua pesanan.' : 'Belum ada pesanan di periode ini.'}
              />
            )}
            {canProduction && (
              <DataPanel
                icon={Factory}
                title="Produksi"
                href="/production"
                linkLabel="Productions"
                tabs={productionTabs}
                active={productionActive}
                onTab={setProductionTab}
                columns={[
                  { key: 'code', label: 'Kode' },
                  { key: 'date', label: 'Tanggal' },
                  { key: 'items', label: 'Produk', align: 'right' },
                  { key: 'status', label: 'Status', align: 'right' },
                ]}
                rows={listOf(productionShown.data).items.map((p: any) => ({
                  key: p.id,
                  href: `/production/${p.id}/detail`,
                  cells: {
                    code: (
                      <>
                        <span className="ops-code">{p.code ?? `Produksi #${p.id}`}</span>
                        {p.description && <span className="ops-sub">{p.description}</span>}
                      </>
                    ),
                    date: formatDate(p.date ?? p.created_at),
                    items: `${(p.production_details ?? []).length} produk`,
                    status: <StatusPill status={p.status} />,
                  },
                }))}
                loading={productionShown.isLoading}
                error={productionShown.isError}
                empty={productionActive === 'pending' ? 'Tidak ada produksi pending.' : 'Tidak ada produksi di periode ini.'}
              />
            )}
          </div>

          {canInternal && (
            <DataPanel
              icon={Send}
              title="Internal PO (order bahan)"
              href="/purchase/internal-orders"
              linkLabel="Internal Orders"
              tabs={internalTabs}
              active={internalActive}
              onTab={setInternalTab}
              columns={poColumns('internal')}
              rows={poRows(internalShown.items, 'internal')}
              loading={internalShown.loading}
              error={internalShown.error}
              empty={internalActive === 'open' ? 'Tidak ada internal PO yang berjalan.' : 'Tidak ada internal PO di periode ini.'}
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
