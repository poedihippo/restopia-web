'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, X, Search, Loader2, ArrowUpRight } from 'lucide-react'
import BackLink from '@/components/BackLink'
import { invoicesService } from '@/services/invoices.service'
import { salesOrdersService } from '@/services/sales-orders.service'
import { salesChannelsService } from '@/services/sales-channels.service'
import { branchesService } from '@/services/branches.service'
import { PriceDisplay } from '@/components/PriceDisplay'
import { getCanReadPrice } from '@/utils/price'
import { formatDate } from '@/utils/date'
import SearchableSelect from '@/components/SearchableSelect'
import { chartOfAccountsService } from '@/services/accounting.service'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import { useCentralCompanyScope } from '@/hooks/useCentralCompanyScope'

// Local calendar day (toISOString would give yesterday before 07:00 WIB).
const todayInputDate = () => new Date().toLocaleDateString('en-CA')

// Mirrors the backend's ResolveDueDate: invoice date + 7 days.
function calculateDueDate(invoiceDateStr: string): string {
  if (!invoiceDateStr) return ''
  const [y, m, d] = invoiceDateStr.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return ''
  const result = new Date(y, m - 1, d + 7)
  const yyyy = result.getFullYear()
  const mm = String(result.getMonth() + 1).padStart(2, '0')
  const dd = String(result.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

interface DetailSelection {
  sales_order_detail_id: number
  qty: number
  description: string
  product_name: string
  max_qty: number
  price: number
}

/** Baris Sales Order yang dipakai di halaman create invoice. */
interface InvoiceSoLine {
  id: number
  qty?: number
  price?: number
  received_qty?: number
  invoiced_qty?: number
  billable_qty?: number
  product_uom_snapshot?: { product?: { name?: string }; uom?: { name?: string } } | null
  product_inventory_snapshot?: {
    product_uom_batch?: { product_uom?: { product?: { name?: string } } }
  } | null
  bundle_snapshot?: { name?: string } | null
}

interface InvoiceSoRow {
  id: number
  branch_id?: number
  buyer_branch_id?: number | null
  code?: string
  type?: string
  date?: string
  total_price?: number
  subtotal_price?: number
  discount_price?: number
  branch?: { id?: number; name?: string; type?: string } | null
  buyer_branch?: { id?: number; name?: string } | null
  sales_channel?: { id?: number; name?: string } | null
  sales_order_details?: InvoiceSoLine[]
  additional_charges?: Array<{
    id: number
    name?: string
    amount?: number
    billed_amount?: number
    description?: string
  }>
}

/**
 * Qty yang boleh ditagih = sudah diterima − sudah ditagih. Utamakan
 * billable_qty dari backend; bila tidak dikirim, hitung dari
 * received_qty − invoiced_qty. Qty pesanan TIDAK dipakai sebagai cadangan.
 */
function billableQtyOf(line: InvoiceSoLine): number {
  if (line.billable_qty != null) return Math.max(0, Number(line.billable_qty))
  return Math.max(0, Number(line.received_qty ?? 0) - Number(line.invoiced_qty ?? 0))
}

/** Display name of an SO line: product (UOM), falling back to older snapshots. */
function lineNameOf(line: InvoiceSoLine): string {
  const productName =
    line.product_uom_snapshot?.product?.name
    || line.product_inventory_snapshot?.product_uom_batch?.product_uom?.product?.name
    || line.bundle_snapshot?.name
    || `Item #${line.id}`
  const uomName = line.product_uom_snapshot?.uom?.name
  return uomName ? `${productName} (${uomName})` : productName
}

interface AdditionalChargeSelection {
  sales_order_component_id?: number
  name: string
  amount: number
  max_amount?: number
  description: string
  included: boolean
}

export default function InvoiceForm() {
  const router = useRouter()
  const qc = useQueryClient()
  const { hasPermission, user } = useAuth()
  // Warehouse and production branches don't sell over the counter — the
  // POS-only SO filters (settlement, payment, credit type, type, sales
  // channel) don't apply there.
  const isWarehouseBranch = ['warehouse', 'production'].includes(
    String((user as any)?.branch?.type ?? ''),
  )
  const canReadPrice = getCanReadPrice()

  const [date, setDate] = useState(todayInputDate())
  const [dueDate, setDueDate] = useState(() => calculateDueDate(todayInputDate()))
  const [description, setDescription] = useState('')
  const [selectedSoIds, setSelectedSoIds] = useState<number[]>([])

  // Free-form additional charges
  const [freeCharges, setFreeCharges] = useState<{ id: string, name: string, chart_of_account_id: number, amount: number, description: string }[]>([])

  // Details tracking
  const [details, setDetails] = useState<Record<number, DetailSelection>>({})

  // SO Component charges tracking
  const [soCharges, setSoCharges] = useState<Record<number, AdditionalChargeSelection>>({})

  // ── Filter Sales Orders (disamakan dengan menu Sales Orders) ───────────────
  const [soSearch, setSoSearch] = useState('')
  const [soSearchDebounced, setSoSearchDebounced] = useState('')
  const [soSettlement, setSoSettlement] = useState('')
  const [soPayment, setSoPayment] = useState('')
  const [soCreditType, setSoCreditType] = useState('')
  const [soType, setSoType] = useState('')
  const [soChannel, setSoChannel] = useState<string | number>('')
  const [soDateGte, setSoDateGte] = useState('')
  const [soDateLte, setSoDateLte] = useState('')
  // Outlet filter — key from outletKeyOf ('buyer:<id>' | 'own:<id>' | 'none')
  const [soOutlet, setSoOutlet] = useState('')
  // A warehouse / production branch bills its whole company: the list covers
  // every branch's orders (scope=company); the outlet cards narrow it. The
  // invoice is issued by the selected orders' own branch.
  const { isCentral, scopeParams } = useCentralCompanyScope()
  // POS-only filters (outlet branches) live behind a "More filters" toggle
  const [showMoreSoFilters, setShowMoreSoFilters] = useState(false)
  // Sales order shown in the detail popup (clicked from its code)
  const [previewSo, setPreviewSo] = useState<InvoiceSoRow | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSoSearchDebounced(soSearch), 400)
    return () => clearTimeout(t)
  }, [soSearch])

  const soFilterControl: React.CSSProperties = {
    height: 36,
    padding: '0 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  }
  const soFilterLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  }
  const soTh: React.CSSProperties = {
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)',
    background: 'var(--background)',
  }
  const soTd: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 13,
    color: 'var(--foreground)',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
  }

  // Opsi filter & resolver outlet (untuk ditampilkan di kartu SO)
  const { data: channelData } = useQuery({
    queryKey: ['invoice-so-filter-channels'],
    queryFn: () => salesChannelsService.list({ per_page: 100, sort: 'name' }).then((r) => r.data),
  })
  const channelOptions = ((channelData as unknown as { data?: { id: number; name?: string }[] } | undefined)?.data ?? [])

  const { data: branchData } = useQuery({
    queryKey: ['invoice-so-filter-branches'],
    queryFn: () => branchesService.list({ per_page: 1000, sort: 'name' }).then((r) => r.data),
  })
  const branchList = ((branchData as unknown as { data?: { id: number; name?: string }[] } | undefined)?.data ?? [])
  // Outlet yang mau di-invoice: buyer_branch (SO dari production/warehouse ke
  // outlet) → fallback resolve via branches endpoint (buyer_branch_id) → bila
  // SO milik outlet, branch-nya sendiri yang menjadi outlet.
  const outletNameOf = (so: {
    buyer_branch?: { name?: string } | null
    buyer_branch_id?: number | null
    branch?: { name?: string; type?: string } | null
  }): string =>
    so?.buyer_branch?.name ??
    branchList.find((b) => b.id === so?.buyer_branch_id)?.name ??
    (String(so?.branch?.type ?? '').toLowerCase() === 'outlet' ? so?.branch?.name : undefined) ??
    '—'
  // Same resolution as outletNameOf, as a stable grouping key. `buyer:` keys
  // can be filtered on the server (filter[buyer_branch_id]); an outlet's own
  // SOs (`own:`) and unresolved ones (`none`) are filtered client-side.
  const outletKeyOf = (so: {
    buyer_branch_id?: number | null
    branch_id?: number | null
    branch?: { type?: string } | null
  }): string => {
    if (so?.buyer_branch_id) return `buyer:${so.buyer_branch_id}`
    if (String(so?.branch?.type ?? '').toLowerCase() === 'outlet' && so?.branch_id) return `own:${so.branch_id}`
    return 'none'
  }
  const soOutletBuyerId = soOutlet.startsWith('buyer:') ? Number(soOutlet.slice(6)) : undefined

  // Fetch final SOs yang belum di-invoice (filter status/has_invoice dikunci
  // karena aturan bisnis invoice; filter lain menyusul seperti menu Sales Order)
  const soBaseParams = {
    ...scopeParams,
    per_page: 1000,
    'filter[status]': 'final',
    'filter[has_invoice]': 'false',
    'filter[search]': soSearchDebounced || undefined,
    'filter[settlement_status]': soSettlement || undefined,
    'filter[payment_status]': soPayment || undefined,
    'filter[credit_type]': soCreditType || undefined,
    'filter[type]': soType || undefined,
    'filter[sales_channel_id]': soChannel === '' ? undefined : Number(soChannel),
    'filter[date_gte]': soDateGte || undefined,
    'filter[date_lte]': soDateLte || undefined,
    include: 'branch,buyer_branch,customer,sales_channel,sales_order_details,additional_charges',
    sort: '-created_at',
  }
  const soFilterKey = [
    isCentral,
    soSearchDebounced, soSettlement, soPayment, soCreditType, soType,
    soChannel, soDateGte, soDateLte,
  ]
  // All outlets — feeds the per-outlet recap cards.
  const { data: soData, isLoading: soLoading } = useQuery({
    queryKey: ['sales-orders', 'final', ...soFilterKey],
    queryFn: () => salesOrdersService.list(soBaseParams as any).then(res => res.data),
  })
  // One buyer outlet, filtered on the server.
  const { data: soOutletData, isLoading: soOutletLoading, isError: soOutletError } = useQuery({
    queryKey: ['sales-orders', 'final', 'buyer', soOutletBuyerId, ...soFilterKey],
    enabled: !!soOutletBuyerId,
    retry: false,
    queryFn: () =>
      salesOrdersService
        .list({ ...soBaseParams, 'filter[buyer_branch_id]': soOutletBuyerId } as any)
        .then(res => res.data),
  })

  // SO tanpa satu pun baris yang bisa ditagih (belum diterima / sudah
  // ditagih penuh) disembunyikan — memilihnya hanya memicu 422 dari backend.
  const fetchedSOs = ((soData as unknown as { data?: InvoiceSoRow[] } | undefined)?.data ?? [])
  const availableSOs = fetchedSOs.filter((so) =>
    (so.sales_order_details ?? []).some((line) => billableQtyOf(line) > 0),
  )
  const hiddenSoCount = fetchedSOs.length - availableSOs.length

  // Per-outlet recap of what can still be invoiced — shown before the list.
  const outletSummaries = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number; billable: number }>()
    availableSOs.forEach((so) => {
      const key = outletKeyOf(so)
      const entry = map.get(key) ?? { key, name: outletNameOf(so), count: 0, billable: 0 }
      entry.count += 1
      entry.billable += (so.sales_order_details ?? []).reduce(
        (s, line) => s + billableQtyOf(line) * Number(line.price ?? 0),
        0,
      )
      map.set(key, entry)
    })
    return Array.from(map.values()).sort((a, b) => b.billable - a.billable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSOs, branchList])
  // One invoice bills one outlet: the user picks the outlet first. Switching
  // outlets drops the orders already ticked for the previous one.
  const pickOutlet = (key: string) => {
    if (key === soOutlet) return
    setSoOutlet(key)
    setSelectedSoIds([])
    setDetails({})
    setSoCharges({})
  }
  // Only one outlet has something to invoice: pick it.
  useEffect(() => {
    if (!soOutlet && outletSummaries.length === 1) setSoOutlet(outletSummaries[0].key)
  }, [soOutlet, outletSummaries])

  const isBillable = (so: InvoiceSoRow) =>
    (so.sales_order_details ?? []).some((line) => billableQtyOf(line) > 0)
  // Server-filtered rows when available; otherwise (own/none keys, or the
  // filter refused) narrow the all-outlet set in the browser.
  const outletServerSOs =
    soOutletBuyerId && !soOutletError
      ? ((soOutletData as unknown as { data?: InvoiceSoRow[] } | undefined)?.data ?? []).filter(isBillable)
      : null
  const visibleSOs = !soOutlet
    ? availableSOs
    : (outletServerSOs ?? availableSOs).filter((so) => outletKeyOf(so) === soOutlet)
  const listLoading = soLoading || (!!soOutletBuyerId && soOutletLoading)
  // Lookups for selection cover both sets.
  const selectableSOs = outletServerSOs
    ? [...availableSOs, ...outletServerSOs.filter((so) => !availableSOs.some((a) => a.id === so.id))]
    : availableSOs

  // "Select all" over the visible list. One invoice covers one (seller)
  // branch, so only rows matching the current selection's branch — or the
  // first visible row's branch when nothing is picked yet — are taken.
  const anchorBranchId =
    selectedSoIds.length > 0
      ? selectableSOs.find((s) => s.id === selectedSoIds[0])?.branch_id
      : visibleSOs[0]?.branch_id
  const bulkSelectableSOs = visibleSOs.filter((so) => so.branch_id === anchorBranchId)
  const allVisibleSelected =
    bulkSelectableSOs.length > 0 && bulkSelectableSOs.every((so) => selectedSoIds.includes(so.id))
  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      bulkSelectableSOs.forEach((so) => handleSoSelection(so.id))
      return
    }
    bulkSelectableSOs
      .filter((so) => !selectedSoIds.includes(so.id))
      .forEach((so) => handleSoSelection(so.id))
    const skipped = visibleSOs.length - bulkSelectableSOs.length
    if (skipped > 0) {
      toast.info(
        `${skipped} sales order${skipped === 1 ? '' : 's'} from another branch skipped — one invoice covers one branch.`,
      )
    }
  }
  const allBillable = outletSummaries.reduce((s, o) => s + o.billable, 0)

  // Chart of accounts for standalone (custom) charges — required by the API.
  // Searched on the server; SearchableSelect keeps the picked label cached.
  const [coaSearch, setCoaSearch] = useState('')
  const coaSearchDebounced = useDebounce(coaSearch, 400)
  const coaOpts = useInfiniteOptions<any>({
    queryKey: ['chart-of-accounts-options', 'charges', coaSearchDebounced],
    staleTime: 60_000,
    fetchPage: (page) =>
      chartOfAccountsService
        .list({
          page,
          per_page: 50,
          sort: 'code',
          'filter[is_active]': 'true',
          'filter[search]': coaSearchDebounced || undefined,
        } as any)
        .then(r => r.data),
  })
  const coaChargeOptions = coaOpts.items.map((coa: any) => ({
    value: coa.id as number,
    label: (coa.name as string) ?? `COA #${coa.id}`,
    sublabel: (coa.code as string) ?? undefined,
  }))

  const handleSoSelection = (soId: number) => {
    setSelectedSoIds(prev => {
      if (prev.includes(soId)) {
        // Deselect
        const next = prev.filter(id => id !== soId)
        // Remove related details and charges
        const so = selectableSOs.find((s: any) => s.id === soId)
        if (so) {
          setDetails(d => {
            const copy = { ...d }
            so.sales_order_details?.forEach((line: any) => delete copy[line.id])
            return copy
          })
          setSoCharges(c => {
            const copy = { ...c }
            so.additional_charges?.forEach((charge: any) => delete copy[charge.id])
            return copy
          })
        }
        return next
      } else {
        // First check branch rule: all must be same branch
        const newSo = selectableSOs.find((s: any) => s.id === soId)
        if (prev.length > 0) {
          const firstSoId = prev[0]
          const firstSo = selectableSOs.find((s: any) => s.id === firstSoId)
          if (firstSo && newSo && firstSo.branch_id !== newSo.branch_id) {
            toast.error('All selected Sales Orders must belong to the same branch.')
            return prev
          }
        }

        // Auto-populate details and charges
        if (newSo) {
          setDetails(d => {
            const copy = { ...d }
            newSo.sales_order_details?.forEach((line: any) => {
              // Hanya qty yang sudah diterima & belum ditagih yang boleh
              // ditagih — backend menolak baris yang belum diterima
              // ("has not been received yet — nothing to bill").
              // Baris dengan 0 → input disabled & tidak ikut payload.
              const maxQty = billableQtyOf(line)
              const displayName = lineNameOf(line)

              copy[line.id] = {
                sales_order_detail_id: line.id,
                qty: maxQty,
                max_qty: maxQty,
                price: line.price,
                product_name: displayName,
                description: ''
              }
            })
            return copy
          })

          setSoCharges(c => {
            const copy = { ...c }
            newSo.additional_charges?.forEach((charge: any) => {
              const amount = Number(charge.amount ?? 0)
              const remaining = amount - Number(charge.billed_amount || 0)
              // Remaining may be positive or negative (deduction); a zero
              // charge stays billable as a zero invoice charge.
              if (remaining !== 0 || amount === 0) {
                copy[charge.id] = {
                  sales_order_component_id: charge.id,
                  name: charge.name,
                  amount: remaining,
                  max_amount: remaining,
                  description: charge.description || '',
                  included: true
                }
              }
            })
            return copy
          })
        }

        return [...prev, soId]
      }
    })
  }

  // Calculations
  const subtotalPrice = useMemo(() => {
    return Object.values(details).reduce((sum, d) => sum + (d.qty * d.price), 0)
  }, [details])

  const additionalChargePrice = useMemo(() => {
    let sum = 0
    Object.values(soCharges).forEach(c => {
      if (c.included) sum += Number(c.amount)
    })
    freeCharges.forEach(c => {
      sum += Number(c.amount)
    })
    return sum
  }, [soCharges, freeCharges])

  // TODO: taxes (assume fetched from SOs or just simple addition for now)
  // For now, total = subtotal + additional charges. Taxes should ideally be computed by server.
  // Cross-company handling fee preview: the backend derives the billed branch
  // from the selected sales orders, exactly as it does on create.
  const feeSoIds = [...selectedSoIds].sort((a, b) => a - b)
  const { data: handlingFeeData } = useQuery({
    queryKey: ['invoice-handling-fee', feeSoIds.join(',')],
    enabled: feeSoIds.length > 0 && hasPermission('invoice.create'),
    retry: false,
    queryFn: () => invoicesService.handlingFee(feeSoIds).then(r => r.data),
  })
  const handlingFeePreview = (handlingFeeData as any)?.data as
    | { applies?: boolean; handling_fee_percent?: number }
    | undefined
  const handlingFeePercent = handlingFeePreview?.applies
    ? Number(handlingFeePreview.handling_fee_percent ?? 0)
    : 0

  // Fee base = subtotal − discount (backend: net sales before tax and
  // additional charges, never < 0). This form doesn't show a discount, so the
  // discount is derived the backend way: each SO's discount_price prorated by
  // (this invoice's share of that SO / so.subtotal_price). Preview only — the
  // server computes and freezes the real amount at create.
  const handlingFeeBase = useMemo(() => {
    let discount = 0
    selectedSoIds.forEach((soId) => {
      const so = selectableSOs.find((s) => s.id === soId)
      if (!so) return
      const soSubtotal = Number(so.subtotal_price ?? 0)
      const soDiscount = Number(so.discount_price ?? 0)
      if (soSubtotal <= 0 || soDiscount <= 0) return
      const share = (so.sales_order_details ?? []).reduce((sum, line) => {
        const d = details[line.id]
        return d ? sum + Number(d.qty) * Number(d.price) : sum
      }, 0)
      discount += soDiscount * (share / soSubtotal)
    })
    return Math.max(0, subtotalPrice - discount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSoIds, details, subtotalPrice, soData, soOutletData])
  const handlingFeeAmount =
    handlingFeePercent > 0
      ? Math.round(handlingFeeBase * handlingFeePercent) / 100
      : 0

  const totalPrice = subtotalPrice + additionalChargePrice + handlingFeeAmount

  const { mutate: create, isPending } = useMutation({
    mutationFn: () => {
      const payloadDetails = Object.values(details)
        .filter(d => d.qty > 0)
        .map(d => ({
          sales_order_detail_id: d.sales_order_detail_id,
          qty: Number(d.qty),
          description: d.description || undefined
        }))

      const payloadCharges = [
        ...Object.values(soCharges)
          .filter(c => c.included)
          .map(c => ({
            sales_order_component_id: c.sales_order_component_id,
            name: c.name,
            // Omitting the amount bills the full remaining amount (any sign)
            amount: Number(c.amount) === c.max_amount ? undefined : Number(c.amount),
            description: c.description || undefined
          })),
        ...freeCharges
          .filter(c => c.name.trim())
          .map(c => ({
            name: c.name.trim(),
            chart_of_account_id: c.chart_of_account_id,
            amount: Number(c.amount) || 0,
            description: c.description || undefined
          }))
      ]

      return invoicesService.create({
        sales_order_ids: selectedSoIds,
        // `date` wajib menurut CreateInvoiceRequest (openapi) — jangan pernah kosong
        date: date || todayInputDate(),
        description: description || undefined,
        details: payloadDetails,
        additional_charges: payloadCharges.length > 0 ? payloadCharges : undefined
        // Catatan: `due_date` TIDAK ada di CreateInvoiceRequest (openapi);
        // backend menurunkannya sendiri (lihat field due_date di InvoiceResponse).
      })
    },
    onSuccess: (res: any) => {
      toast.success('Invoice created')
      qc.invalidateQueries({ queryKey: ['invoices'] })
      // Invoiced lines change billable_qty / has_invoice on the source orders.
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      qc.invalidateQueries({ queryKey: ['sales-order-detail'] })
      const newId = res?.data?.data?.id ?? res?.data?.id
      if (newId) router.push(`/transfer/invoices/${newId}`)
      else router.push('/transfer/invoices')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to create invoice'
      toast.error(msg)
    }
  })

  // ── Layout styles ──────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '18px 20px',
  }
  const stepHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  }
  const stepBadgeStyle = (active: boolean): React.CSSProperties => ({
    width: 22,
    height: 22,
    borderRadius: 99,
    background: active ? 'var(--accent)' : 'var(--accent-light-bg)',
    color: active ? 'white' : 'var(--accent)',
    fontSize: 12,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  })
  const stepTitleStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    margin: 0,
    color: 'var(--foreground)',
  }
  const stepHintStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--foreground-muted)',
  }
  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--foreground-muted)',
    display: 'block',
    marginBottom: 6,
  }
  const fieldInputStyle: React.CSSProperties = {
    width: '100%',
    height: 36,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '0 10px',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
  }
  const smallInputStyle: React.CSSProperties = { ...fieldInputStyle, height: 32 }
  const summaryRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    fontSize: 13,
    padding: '5px 0',
  }

  const firstSelectedSo = selectableSOs.find((s) => s.id === selectedSoIds[0])
  const billingTo = firstSelectedSo ? outletNameOf(firstSelectedSo) : null
  // "OUTLET CIBUBUR" → "Outlet Cibubur"
  const titleName = (name: string) =>
    name.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_m: string, sp: string, ch: string) => sp + ch.toUpperCase())
  const hasMoreFilters = !isWarehouseBranch
  const activeMoreFilters = [soSettlement, soPayment, soCreditType, soType, soChannel].filter((v) => v !== '').length

  return (
    <div className="inv-page" style={{ padding: '24px 32px 48px', fontFamily: 'var(--font-sans)' }}>
      {/* Phones and narrow tablets: one column, summary after the steps. */}
      <style>{`
        .inv-save, .inv-cancel {
          transition: background-color 150ms ease, color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
        }
        .inv-save:not(:disabled):hover {
          background: var(--accent-hover) !important;
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }
        .inv-save:not(:disabled):active { transform: translateY(0); box-shadow: none; }
        .inv-cancel:hover {
          background: var(--accent-light-bg) !important;
          color: var(--accent) !important;
        }
        .inv-outlet-card:not([aria-pressed="true"]):hover {
          border-color: var(--accent-light) !important;
          box-shadow: var(--shadow-sm) !important;
        }
        @media (max-width: 900px) {
          .inv-page { padding: 16px 0 32px !important; }
          .inv-layout { grid-template-columns: minmax(0, 1fr) !important; }
          .inv-summary { position: static !important; }
          .inv-two-col, .inv-charge-row { grid-template-columns: minmax(0, 1fr) !important; }
          .inv-filters, .inv-filters > * { width: 100%; }
          .inv-filters input, .inv-filters select { width: 100% !important; min-width: 0 !important; }
          .inv-step-title { white-space: nowrap; }
        }
      `}</style>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        <BackLink href="/transfer/invoices" label="Invoices" />
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>
            Create Invoice
          </h1>
          <p style={{ color: 'var(--foreground-muted)', fontSize: 13, margin: '2px 0 0' }}>
            Bill received goods from sales orders to an outlet
          </p>
        </div>
      </div>

      <div className="inv-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20, alignItems: 'start' }}>
        {/* ── Left: steps ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* 1. Invoice details */}
          <div style={cardStyle}>
            <div style={stepHeaderStyle}>
              <span style={stepBadgeStyle(true)}>1</span>
              <h3 style={stepTitleStyle}>Invoice details</h3>
            </div>
            <div className="inv-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={fieldLabelStyle}>Invoice date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => {
                    const val = e.target.value
                    setDate(val)
                    if (val) setDueDate(calculateDueDate(val))
                  }}
                  style={fieldInputStyle}
                />
              </div>
              <div>
                <label style={fieldLabelStyle}>Due date</label>
                {/* Derived from the invoice date (backend sets the real one) — not editable */}
                <div
                  style={{
                    ...fieldInputStyle,
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--background)',
                    color: dueDate ? 'var(--foreground)' : 'var(--foreground-subtle)',
                    cursor: 'default',
                  }}
                >
                  {dueDate ? formatDate(dueDate) : '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--foreground-subtle)', marginTop: 4, lineHeight: 1.4 }}>
                  Patokan: Tgl 1-7 (14), 8-14 (21), 15-21 (28), 22-akhir (7 bulan dpn)
                </div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={fieldLabelStyle}>Note</label>
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Optional note"
                  style={fieldInputStyle}
                />
              </div>
            </div>
          </div>

          {/* 2. Choose sales orders */}
          <div style={cardStyle}>
            <div style={{ ...stepHeaderStyle, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div className="inv-step-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={stepBadgeStyle(true)}>2</span>
                <h3 style={stepTitleStyle}>Choose sales orders</h3>
              </div>
              <div className="inv-filters" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search
                    size={14}
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-subtle)' }}
                  />
                  <input
                    value={soSearch}
                    onChange={(e) => setSoSearch(e.target.value)}
                    placeholder="Search code or customer"
                    style={{ ...soFilterControl, height: 32, width: 200, paddingLeft: 30 }}
                  />
                </div>
                <input type="date" value={soDateGte} onChange={(e) => setSoDateGte(e.target.value)} aria-label="Order date from" style={{ ...soFilterControl, height: 32 }} />
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>–</span>
                <input type="date" value={soDateLte} onChange={(e) => setSoDateLte(e.target.value)} aria-label="Order date to" style={{ ...soFilterControl, height: 32 }} />
                {hasMoreFilters && (
                  <button
                    type="button"
                    onClick={() => setShowMoreSoFilters((v) => !v)}
                    style={{
                      height: 32,
                      padding: '0 10px',
                      border: `1px solid ${showMoreSoFilters || activeMoreFilters > 0 ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)',
                      background: showMoreSoFilters ? 'var(--accent-light-bg)' : 'var(--surface-raised)',
                      color: activeMoreFilters > 0 ? 'var(--accent)' : 'var(--foreground)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    More filters{activeMoreFilters > 0 ? ` (${activeMoreFilters})` : ''}
                  </button>
                )}
              </div>
            </div>

            {/* POS-only filters — outlet branches only, tucked away by default */}
            {hasMoreFilters && showMoreSoFilters && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  alignItems: 'flex-end',
                  padding: 12,
                  marginBottom: 16,
                  background: 'var(--background)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={soFilterLabel}>Settlement</span>
                  <select value={soSettlement} onChange={(e) => setSoSettlement(e.target.value)} style={{ ...soFilterControl, height: 32 }}>
                    <option value="">All Settlements</option>
                    <option value="pending">Pending</option>
                    <option value="credit">Credit</option>
                    <option value="settled">Settled</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={soFilterLabel}>Payment</span>
                  <select value={soPayment} onChange={(e) => setSoPayment(e.target.value)} style={{ ...soFilterControl, height: 32 }}>
                    <option value="">All Payments</option>
                    <option value="pending">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={soFilterLabel}>Credit Type</span>
                  <select value={soCreditType} onChange={(e) => setSoCreditType(e.target.value)} style={{ ...soFilterControl, height: 32 }}>
                    <option value="">All Credit Types</option>
                    <option value="user">Staff (user)</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={soFilterLabel}>Type</span>
                  <select value={soType} onChange={(e) => setSoType(e.target.value)} style={{ ...soFilterControl, height: 32 }}>
                    <option value="">All Types</option>
                    <option value="offline">Offline</option>
                    <option value="online">Online</option>
                    <option value="franchise">Franchise</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={soFilterLabel}>Sales Channel</span>
                  <select
                    value={soChannel === '' ? '' : String(soChannel)}
                    onChange={(e) => setSoChannel(e.target.value ? Number(e.target.value) : '')}
                    style={{ ...soFilterControl, height: 32, minWidth: 150 }}
                  >
                    <option value="">All Channels</option>
                    {channelOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Per-outlet recap — click a card to filter the list below */}
            {!soLoading && outletSummaries.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                {outletSummaries.map((o) => {
                  const active = soOutlet === o.key
                  // "OUTLET DEPOK" → "Outlet Depok"
                  const name = o.name
                    .toLowerCase()
                    .replace(/(^|\s)(\p{L})/gu, (_m: string, sp: string, ch: string) => sp + ch.toUpperCase())
                  const initial = name.replace(/^outlet\s+/i, '').charAt(0).toUpperCase() || '?'
                  const share = allBillable > 0 ? Math.min(100, (o.billable / allBillable) * 100) : 0

                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => pickOutlet(o.key)}
                      aria-pressed={active}
                      className="inv-outlet-card"
                      style={{
                        textAlign: 'left',
                        padding: 0,
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        boxShadow: active ? 'var(--shadow-md)' : 'none',
                        borderRadius: 'var(--radius-lg)',
                        // The picked outlet is reversed: dark brown card, light text.
                        background: active ? 'var(--accent)' : 'var(--surface)',
                        color: active ? '#fff' : 'var(--foreground)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        fontFamily: 'var(--font-sans)',
                        minWidth: 0,
                        transition: 'border-color 150ms ease, box-shadow 150ms ease',
                      }}
                    >
                      {/* Header: which outlet */}
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '9px 12px',
                          borderBottom: `1px solid ${active ? 'rgba(255,255,255,0.14)' : 'var(--border)'}`,
                          background: 'transparent',
                          color: active ? '#fff' : 'var(--accent)',
                          minWidth: 0,
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 22,
                            height: 22,
                            flexShrink: 0,
                            borderRadius: 6,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                            background: active ? 'rgba(255,255,255,0.16)' : 'var(--accent-light-bg)',
                            color: active ? '#fff' : 'var(--accent)',
                          }}
                        >
                          {initial}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            fontSize: 12.5,
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {name}
                        </span>
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '1px 7px',
                            borderRadius: 999,
                            background: active ? 'rgba(255,255,255,0.16)' : 'var(--accent-light-bg)',
                            color: active ? '#fff' : 'var(--accent)',
                          }}
                          title={`${o.count} order${o.count === 1 ? '' : 's'} to invoice`}
                        >
                          {o.count}
                        </span>
                      </span>

                      {/* Body: how much */}
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px 12px' }}>
                        <span style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.72)' : 'var(--foreground-muted)' }}>
                          To invoice · {o.count} order{o.count === 1 ? '' : 's'}
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                          <PriceDisplay amount={o.billable} />
                        </span>
                        <span
                          aria-label={`${Math.round(share)}% of the total to invoice`}
                          title={`${Math.round(share)}% of the total`}
                          style={{ height: 4, borderRadius: 999, background: active ? 'rgba(255,255,255,0.18)' : 'var(--accent-light-bg)', overflow: 'hidden' }}
                        >
                          <span style={{ display: 'block', height: '100%', width: `${share}%`, background: 'var(--accent-light)', borderRadius: 999 }} />
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {!soLoading && hiddenSoCount > 0 && (
              <p style={{ fontSize: 12, color: 'var(--warning)', margin: '0 0 8px' }}>
                {hiddenSoCount} sales order disembunyikan karena barangnya belum diterima atau sudah ditagih penuh.
              </p>
            )}

            {listLoading ? (
              <p style={{ fontSize: 13, color: 'var(--foreground-muted)', padding: '16px 0', textAlign: 'center', margin: 0 }}>
                Loading sales orders...
              </p>
            ) : !soOutlet && outletSummaries.length > 0 ? (
              <p style={{ fontSize: 13, color: 'var(--foreground-muted)', padding: '16px 0', textAlign: 'center', margin: 0 }}>
                Pick an outlet above. One invoice bills one outlet.
              </p>
            ) : visibleSOs.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--foreground-muted)', padding: '16px 0', textAlign: 'center', margin: 0 }}>
                No sales orders available to invoice.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                    {selectedSoIds.length} of {visibleSOs.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={toggleAllVisible}
                    disabled={bulkSelectableSOs.length === 0}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--accent)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: bulkSelectableSOs.length === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <span className="v2-link">{allVisibleSelected ? 'Clear selection' : `Select all (${bulkSelectableSOs.length})`}</span>
                  </button>
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr>
                          <th style={{ ...soTh, width: 40, textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              aria-label="Select all sales orders"
                              checked={allVisibleSelected}
                              disabled={bulkSelectableSOs.length === 0}
                              onChange={toggleAllVisible}
                              style={{ cursor: 'pointer' }}
                            />
                          </th>
                          <th style={{ ...soTh, width: 50, textAlign: 'center' }}>No.</th>
                          <th style={soTh}>Order</th>
                          <th style={soTh}>Outlet</th>
                          <th style={{ ...soTh, width: 120 }}>Order date</th>
                          <th style={{ ...soTh, width: 150, textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleSOs.map((so, soIdx) => {
                          const isSelected = selectedSoIds.includes(so.id)
                          const branchMatched = selectedSoIds.length === 0 || selectableSOs.find((s) => s.id === selectedSoIds[0])?.branch_id === so.branch_id
                          const disabled = !isSelected && !branchMatched

                          return (
                            <tr
                              key={so.id}
                              onClick={() => !disabled && handleSoSelection(so.id)}
                              title={disabled ? `Different branch (${so.branch?.name ?? '—'}) — one invoice covers one branch` : undefined}
                              style={{
                                background: isSelected ? 'var(--accent-light-bg)' : 'transparent',
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                opacity: disabled ? 0.45 : 1,
                              }}
                            >
                              <td style={{ ...soTd, textAlign: 'center' }}>
                                <input type="checkbox" readOnly checked={isSelected} style={{ pointerEvents: 'none' }} />
                              </td>
                              <td style={{ ...soTd, textAlign: 'center', color: 'var(--foreground-muted)', width: 50 }}>
                                {soIdx + 1}
                              </td>
                              <td style={{ ...soTd, fontWeight: 600 }}>
                                {/* Opens the SO detail popup without toggling the row */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setPreviewSo(so)
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    color: 'var(--accent)',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    textDecoration: 'underline',
                                    textUnderlineOffset: 2,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span className="v2-link">{so.code}<ArrowUpRight size={12} /></span>
                                </button>
                              </td>
                              {/* Outlet yang mau di-invoice — resolve dari buyer_branch_id */}
                              <td style={soTd}>
                                {outletNameOf(so)}
                                {isCentral && so.branch?.name && (
                                  <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)', marginTop: 2 }}>
                                    from {so.branch.name}
                                  </div>
                                )}
                              </td>
                              <td style={{ ...soTd, whiteSpace: 'nowrap', color: 'var(--foreground-muted)' }}>
                                {so.date ? formatDate(so.date) : '—'}
                              </td>
                              <td style={{ ...soTd, textAlign: 'right' }}>
                                <PriceDisplay amount={so.total_price} />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 3. Additional charges */}
          <div style={cardStyle}>
            <div style={{ ...stepHeaderStyle, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={stepBadgeStyle(Object.values(soCharges).length > 0 || freeCharges.length > 0)}>3</span>
                <h3 style={stepTitleStyle}>Additional charges</h3>
                <span style={stepHintStyle}>Optional</span>
              </div>
              <button
                type="button"
                onClick={() => setFreeCharges(f => [...f, { id: Math.random().toString(), name: '', chart_of_account_id: 0, amount: 0, description: '' }])}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--accent)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> <span className="v2-link">Add charge</span>
              </button>
            </div>

            {Object.values(soCharges).length === 0 && freeCharges.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--foreground-subtle)', margin: 0 }}>
                No charges. Charges from the selected sales orders appear here automatically.
              </p>
            )}

            {/* From sales orders */}
            {Object.values(soCharges).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: freeCharges.length > 0 ? 16 : 0 }}>
                <span style={soFilterLabel}>From sales orders</span>
                {Object.values(soCharges).map(c => (
                  <div
                    key={c.sales_order_component_id}
                    className="inv-charge-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 160px', gap: 12, alignItems: 'center' }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 0 }}>
                      <input type="checkbox" checked={c.included} onChange={e => setSoCharges({ ...soCharges, [c.sales_order_component_id as number]: { ...c, included: e.target.checked } })} />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                        max <PriceDisplay amount={c.max_amount} />
                      </span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={c.amount}
                      disabled={!c.included}
                      onChange={e => {
                        const max = Number(c.max_amount ?? 0)
                        const raw = Number(e.target.value)
                        let v = Number.isFinite(raw) ? raw : 0
                        // Same sign as the remaining amount, never larger
                        if (v !== 0 && max !== 0 && Math.sign(v) !== Math.sign(max)) v = 0
                        if (max !== 0 && Math.abs(v) > Math.abs(max)) v = max
                        setSoCharges({ ...soCharges, [c.sales_order_component_id as number]: { ...c, amount: v } })
                      }}
                      style={{ ...smallInputStyle, textAlign: 'right', opacity: c.included ? 1 : 0.5 }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Custom charges */}
            {freeCharges.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={soFilterLabel}>Custom charges</span>
                {freeCharges.map((fc, idx) => (
                  <div
                    key={fc.id}
                    className="inv-charge-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px minmax(0, 1.2fr) 32px', gap: 8, alignItems: 'start' }}
                  >
                    <input
                      placeholder="Charge name"
                      value={fc.name}
                      onChange={e => {
                        const copy = [...freeCharges]; copy[idx].name = e.target.value; setFreeCharges(copy)
                      }}
                      style={smallInputStyle}
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="Amount"
                      title="0 = none, negative = deduction"
                      value={fc.amount}
                      onChange={e => {
                        const copy = [...freeCharges]; copy[idx].amount = Number(e.target.value) || 0; setFreeCharges(copy)
                      }}
                      style={{ ...smallInputStyle, textAlign: 'right' }}
                    />
                    <SearchableSelect
                      value={fc.chart_of_account_id || 0}
                      onChange={v => {
                        const copy = [...freeCharges]; copy[idx].chart_of_account_id = Number(v) || 0; setFreeCharges(copy)
                      }}
                      options={coaChargeOptions}
                      placeholder="Account *"
                      searchPlaceholder="Search account name or code..."
                      loading={coaOpts.loading}
                      {...coaOpts.selectProps}
                      onSearchChange={setCoaSearch}
                      triggerStyle={{ height: 32, padding: '0 8px', fontSize: 13, borderRadius: 'var(--radius-md)' }}
                    />
                    <button
                      type="button"
                      aria-label="Remove charge"
                      onClick={() => setFreeCharges(f => f.filter(x => x.id !== fc.id))}
                      style={{
                        width: 32,
                        height: 32,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'none',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--destructive)',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: sticky summary ── */}
        <div className="inv-summary" style={{ ...cardStyle, padding: 0, overflow: 'hidden', position: 'sticky', top: 16, display: 'flex', flexDirection: 'column' }}>
          {/* Route: who bills whom, and when it is due */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--foreground-muted)', marginBottom: 10 }}>
              Invoice summary
            </div>
            {[
              ...(isCentral && firstSelectedSo?.branch?.name ? [{ label: 'From', value: titleName(firstSelectedSo.branch.name) }] : []),
              { label: 'To', value: billingTo ? titleName(billingTo) : null },
              { label: 'Due', value: dueDate ? formatDate(dueDate) : null },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '3px 0', fontSize: 13 }}>
                <span style={{ width: 40, flexShrink: 0, color: 'var(--foreground-muted)' }}>{row.label}</span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontWeight: row.value ? 600 : 400,
                    color: row.value ? 'var(--foreground)' : 'var(--foreground-subtle)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={row.value ?? undefined}
                >
                  {row.value ?? (row.label === 'To' ? 'Pick an outlet' : '—')}
                </span>
              </div>
            ))}
          </div>

          {/* Breakdown */}
          <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              {
                label: 'Subtotal',
                tag: `${selectedSoIds.length} order${selectedSoIds.length === 1 ? '' : 's'}`,
                amount: subtotalPrice,
                show: true,
              },
              { label: 'Additional charges', tag: null, amount: additionalChargePrice, show: true },
              {
                label: 'Handling fee',
                tag: `${handlingFeePercent}%`,
                amount: handlingFeeAmount,
                show: handlingFeeAmount > 0,
                title: 'Added to invoices billed to a branch of another company',
              },
            ]
              .filter((row) => row.show)
              .map((row) => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--foreground-muted)', minWidth: 0 }} title={row.title}>
                    {row.label}
                    {row.tag && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: 'var(--accent-light-bg)', color: 'var(--accent)' }}>
                        {row.tag}
                      </span>
                    )}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
                    <PriceDisplay amount={row.amount} />
                  </span>
                </div>
              ))}
          </div>

          {/* Total + actions */}
          <div style={{ padding: '16px 20px 18px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Total</span>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
                <PriceDisplay amount={totalPrice} />
              </span>
            </div>
          <button
            onClick={() => {
              if (selectedSoIds.length === 0) return toast.error('Select at least one Sales Order')
              const missingAccount = freeCharges.find(c => c.name.trim() && !(c.chart_of_account_id > 0))
              if (missingAccount) return toast.error(`Custom charge "${missingAccount.name.trim()}" needs a chart of account`)
              // Mirror the billing rules: keep the remaining amount's sign
              // and never exceed it in absolute value.
              const wrongSign = Object.values(soCharges).find(
                c => c.included && Number(c.amount) !== 0 && Number(c.max_amount ?? 0) !== 0 &&
                  Math.sign(Number(c.amount)) !== Math.sign(Number(c.max_amount))
              )
              if (wrongSign) return toast.error(`Charge "${wrongSign.name}" must keep the sign of the remaining amount`)
              const tooLarge = Object.values(soCharges).find(
                c => c.included && Math.abs(Number(c.amount)) > Math.abs(Number(c.max_amount ?? 0))
              )
              if (tooLarge) return toast.error(`Charge "${tooLarge.name}" exceeds the remaining amount`)
              create()
            }}
            disabled={isPending || selectedSoIds.length === 0}
            className="inv-save"
            style={{
              width: '100%',
              height: 42,
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              fontWeight: 600,
              cursor: isPending || selectedSoIds.length === 0 ? 'not-allowed' : 'pointer',
              opacity: isPending || selectedSoIds.length === 0 ? 0.6 : 1
            }}
          >
            {isPending && <Loader2 size={16} className="animate-spin" />}
            Save Invoice
          </button>
          <button
            type="button"
            onClick={() => router.push('/transfer/invoices')}
            className="inv-cancel"
            style={{
              marginTop: 8,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'none',
              border: 'none',
              color: 'var(--foreground-muted)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          </div>
        </div>
      </div>

      {/* ── Sales order detail popup ── */}
      {previewSo && (() => {
        const so = previewSo
        const isSelected = selectedSoIds.includes(so.id)
        const branchMatched =
          selectedSoIds.length === 0 ||
          selectableSOs.find((s) => s.id === selectedSoIds[0])?.branch_id === so.branch_id
        const canToggle = isSelected || branchMatched
        const lines = so.sales_order_details ?? []
        const charges = so.additional_charges ?? []
        const th: React.CSSProperties = { ...soTh, position: 'static' }
        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          >
            <div
              onClick={() => setPreviewSo(null)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Sales order ${so.code ?? ''}`}
              style={{
                position: 'relative',
                width: 720,
                maxWidth: '100%',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>
                    {so.code}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}>
                    {so.date ? formatDate(so.date) : '—'}
                    {so.sales_channel?.name ? ` · ${so.sales_channel.name}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setPreviewSo(null)}
                  style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--foreground-muted)', display: 'flex' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                  {[
                    { label: 'Outlet', value: outletNameOf(so) },
                    { label: 'Branch', value: so.branch?.name ?? '—' },
                    { label: 'Order total', value: <PriceDisplay amount={so.total_price} /> },
                  ].map((f) => (
                    <div key={f.label} style={{ background: 'var(--background)', borderRadius: 'var(--radius-md)', padding: '10px 12px', minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginBottom: 2 }}>{f.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, width: 50, textAlign: 'center' }}>No.</th>
                        <th style={th}>Item</th>
                        <th style={{ ...th, textAlign: 'right' }}>Ordered</th>
                        <th style={{ ...th, textAlign: 'right' }}>Received</th>
                        <th style={{ ...th, textAlign: 'right' }}>To bill</th>
                        <th style={{ ...th, textAlign: 'right' }}>Price</th>
                        <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ ...soTd, textAlign: 'center', color: 'var(--foreground-muted)' }}>No lines</td>
                        </tr>
                      ) : (
                        lines.map((line, lineIdx) => {
                          const billable = billableQtyOf(line)
                          return (
                            <tr key={line.id}>
                              <td style={{ ...soTd, textAlign: 'center', color: 'var(--foreground-muted)', width: 50 }}>
                                {lineIdx + 1}
                              </td>
                              <td style={soTd}>{lineNameOf(line)}</td>
                              <td style={{ ...soTd, textAlign: 'right' }}>{Number(line.qty ?? 0)}</td>
                              <td style={{ ...soTd, textAlign: 'right', color: 'var(--foreground-muted)' }}>{Number(line.received_qty ?? 0)}</td>
                              <td style={{ ...soTd, textAlign: 'right', fontWeight: 600, color: billable > 0 ? 'var(--success)' : 'var(--foreground-subtle)' }}>
                                {billable}
                              </td>
                              <td style={{ ...soTd, textAlign: 'right', color: 'var(--foreground-muted)' }}>
                                <PriceDisplay amount={line.price} />
                              </td>
                              <td style={{ ...soTd, textAlign: 'right' }}>
                                <PriceDisplay amount={Number(line.qty ?? 0) * Number(line.price ?? 0)} />
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {charges.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={soFilterLabel}>Additional charges</span>
                    {charges.map((c) => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--foreground-muted)' }}>{c.name ?? 'Charge'}</span>
                        <span><PriceDisplay amount={c.amount} /></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  {canToggle ? '' : 'Different branch from your selection — one invoice covers one branch.'}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setPreviewSo(null)}
                    style={{ height: 36, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', fontSize: 13, cursor: 'pointer', color: 'var(--foreground)' }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={!canToggle}
                    onClick={() => {
                      handleSoSelection(so.id)
                      setPreviewSo(null)
                    }}
                    style={{
                      height: 36,
                      padding: '0 16px',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--destructive)' : 'var(--accent)',
                      color: 'white',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: canToggle ? 'pointer' : 'not-allowed',
                      opacity: canToggle ? 1 : 0.5,
                    }}
                  >
                    {isSelected ? 'Remove from invoice' : 'Add to invoice'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
