'use client'
import { formatDate, toInputDate, formatDateTime } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  journalsService, periodsService, chartOfAccountsService,
  type JournalRequest,
} from '@/services/accounting.service'
import { reportsService } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import SearchableSelect from '@/components/SearchableSelect'
import LocalizedNumberInput from '@/components/LocalizedNumberInput'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight,
  X, Loader2, FileText, CheckCircle2, Send, AlertCircle, Eye, Download,
  RotateCcw, Copy, ExternalLink,
} from 'lucide-react'

interface JournalDetail {
  id?: number
  chart_of_account_id: number
  chart_of_account?: { id: number; name: string; code: string }
  debit: number
  credit: number
  description?: string
}

interface Journal {
  id: number
  journal_number: string
  date: string
  type: string
  description?: string
  is_posted: boolean
  is_reversed: boolean
  period_id: number
  period?: { id: number; name: string }
  journal_details?: JournalDetail[]
  created_at?: string
  created_by?: { id: number; name: string; email?: string }
  reference_type?: string | null
  reference_id?: number | null
}

interface Period {
  id: number
  name: string
  start_date?: string
  end_date?: string
  is_active?: boolean
  is_closed?: boolean
}
interface CoA { id: number; code: string; name: string }

const detailSchema = z.object({
  id: z.number().optional(),
  chart_of_account_id: z.coerce.number().min(1, 'Account is required'),
  debit: z.coerce.number().min(0),
  credit: z.coerce.number().min(0),
  description: z.string().optional(),
})

/** Compare money in whole cents so float sums (0.1 + 0.2) don't break balance. */
const toCents = (n: number) => Math.round((Number(n) || 0) * 100)

const schema = z.object({
  period_id: z.coerce.number().min(1, 'Period is required'),
  date: z.string().min(1, 'Date is required'),
  type: z.enum(['manual', 'sales', 'purchase', 'receipt', 'payment', 'adjustment', 'closing', 'stock_opname', 'production']),
  description: z.string().trim().min(1, 'Description is required'),
  details: z.array(detailSchema).min(2, 'Minimum 2 journal lines'),
}).superRefine((data, ctx) => {
  const debit = data.details.reduce((s, d) => s + toCents(d.debit), 0)
  const credit = data.details.reduce((s, d) => s + toCents(d.credit), 0)
  if (debit <= 0) {
    ctx.addIssue({ code: 'custom', path: ['details'], message: 'Enter at least one debit and one credit amount' })
  } else if (debit !== credit) {
    ctx.addIssue({ code: 'custom', path: ['details'], message: 'Total debit must equal total credit' })
  }
})
type FormValues = z.infer<typeof schema>

const JOURNAL_TYPE_LABELS: Record<string, string> = {
  manual: 'General',
  sales: 'Sales',
  purchase: 'Purchase',
  receipt: 'Receipt',
  payment: 'Payment',
  adjustment: 'Adjustment',
  closing: 'Closing',
  stock_opname: 'Stock Opname',
  production: 'Production',
}

const JOURNAL_TYPE_OPTIONS = [
  { value: 'manual', label: 'General' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'closing', label: 'Closing' },
  { value: 'payment', label: 'Payment' },
  { value: 'purchase', label: 'Purchase' },
]

/**
 * `reference_type` (snake_case, from the API) → frontend route.
 *
 * Types that have a dedicated detail page resolve to `<route>/{id}`;
 * the rest fall back to their list page so the link is still useful.
 * `sellable_settlements` has no matching page, so it is omitted on purpose.
 */
const REFERENCE_ROUTES: Record<string, (id: number) => string> = {
  companies: () => '/users/companies',
  branches: () => '/users/branches',
  roles: () => '/users/roles',
  users: () => '/users',
  media: () => '/media',
  operation_rules: () => '/settings/operation-rules',
  operations: () => '/settings/operations',
  shift_rules: () => '/settings/shift-rules',
  shifts: () => '/settings/shifts',
  product_categories: () => '/products/product-categories',
  products: () => '/products',
  uoms: () => '/products/uom',
  product_conversions: () => '/products/product-conversions',
  product_uoms: () => '/products/product-uoms',
  product_uom_batches: () => '/products/product-uom-batches',
  bundles: () => '/sales/bundles',
  product_inventories: () => '/products/product-inventory',
  stock_movements: () => '/products/product-inventory/stock-movements',
  stock_opnames: (id) => `/products/product-inventory/stock-opname/${id}`,
  recipes: () => '/production/recipes',
  productions: (id) => `/production/${id}/detail`,
  portionings: () => '/production/portioning',
  suppliers: () => '/purchase/suppliers',
  buyers: () => '/purchase/buyers',
  taxes: () => '/accounting/taxes',
  purchase_orders: (id) => `/purchase/purchase-orders/${id}/detail`,
  deliveries: (id) => `/transfer/deliveries/${id}/detail`,
  receipts: (id) => `/transfer/receipts/${id}/detail`,
  invoices: (id) => `/transfer/invoices/${id}`,
  customers: () => '/sales/customers',
  vouchers: (id) => `/sales/vouchers/${id}/detail`,
  sales_orders: (id) => `/sales/sales-orders/${id}/detail`,
  sales_channels: () => '/sales/sales-channels',
  payment_methods: () => '/settings/payment-methods',
  payments: () => '/sales/payments',
  account_categories: () => '/accounting/account-categories',
  account_types: () => '/accounting/account-types',
  chart_of_accounts: () => '/accounting/chart-of-accounts',
  account_settings: () => '/accounting/account-settings',
  product_category_account_settings: () => '/accounting/product-category-account-settings',
  branch_account_settings: () => '/accounting/branch-account-settings',
  buyer_account_settings: () => '/accounting/buyer-account-settings',
  fiscal_years: () => '/accounting/fiscal-years',
  periods: () => '/accounting/periods',
  journals: () => '/accounting/journals',
  budgets: () => '/accounting/budgets',
  price_lists: () => '/products/price-lists',
  stages: () => '/inventory/stages',
  departments: () => '/settings/departments',
  bank_accounts: () => '/accounting/bank-accounts',
  cash_transactions: () => '/accounting/cash-transactions',
}

const REFERENCE_TYPE_LABELS: Record<string, string> = {
  companies: 'Company',
  branches: 'Branch',
  roles: 'Role',
  users: 'User',
  media: 'Media',
  operation_rules: 'Operation Rule',
  operations: 'Operation',
  shift_rules: 'Shift Rule',
  shifts: 'Shift',
  product_categories: 'Product Category',
  products: 'Product',
  uoms: 'UOM',
  product_conversions: 'Product Conversion',
  product_uoms: 'Product UOM',
  product_uom_batches: 'Product UOM Batch',
  bundles: 'Bundle',
  product_inventories: 'Product Inventory',
  stock_movements: 'Stock Movement',
  stock_opnames: 'Stock Opname',
  recipes: 'Recipe',
  productions: 'Production',
  portionings: 'Portioning',
  suppliers: 'Supplier',
  buyers: 'Buyer',
  taxes: 'Tax',
  purchase_orders: 'Purchase Order',
  deliveries: 'Delivery',
  receipts: 'Receipt',
  invoices: 'Invoice',
  customers: 'Customer',
  vouchers: 'Voucher',
  sales_orders: 'Sales Order',
  sales_channels: 'Sales Channel',
  payment_methods: 'Payment Method',
  payments: 'Payment',
  account_categories: 'Account Category',
  account_types: 'Account Type',
  chart_of_accounts: 'Chart of Account',
  account_settings: 'Account Setting',
  product_category_account_settings: 'Product Category Account Setting',
  branch_account_settings: 'Branch Account Setting',
  buyer_account_settings: 'Buyer Account Setting',
  fiscal_years: 'Fiscal Year',
  periods: 'Period',
  journals: 'Journal',
  budgets: 'Budget',
  price_lists: 'Price List',
  stages: 'Stage',
  departments: 'Department',
  bank_accounts: 'Bank Account',
  cash_transactions: 'Cash Transaction',
}

const referenceLabel = (type?: string | null): string => {
  if (!type) return ''
  return REFERENCE_TYPE_LABELS[type] ?? type.replace(/_/g, ' ')
}

/** Route for a reference, or null when the type has no matching page. */
const referenceHref = (type?: string | null, id?: number | null): string | null => {
  if (!type || !id) return null
  const build = REFERENCE_ROUTES[type]
  return build ? build(id) : null
}

const getTodayDateString = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const findPeriodForDate = (dateStr: string, periodList: Period[]): Period | undefined => {
  if (!dateStr || !periodList.length) return undefined
  const target = toInputDate(dateStr)
  if (!target) return undefined

  return periodList.find((p) => {
    if (!p.start_date || !p.end_date) return false
    const start = toInputDate(p.start_date)
    const end = toInputDate(p.end_date)
    return start <= target && target <= end
  })
}

const sortJournalLinesDebitFirst = <T extends { debit?: number | string; credit?: number | string }>(lines: T[]): T[] => {
  return [...lines].sort((a, b) => {
    const aIsDebit = Number(a.debit) > 0 ? 0 : 1
    const bIsDebit = Number(b.debit) > 0 ? 0 : 1
    return aIsDebit - bIsDebit
  })
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--foreground)',
  background: 'var(--surface-raised)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
}
const thStyle: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600,
  color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const fmtDate = (d: string) => formatDate(d)
const fmtCurrency = (n: number) => new Intl.NumberFormat('id-ID').format(n)

export default function JournalsView() {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const queryClient = useQueryClient()
  const { isSuperadmin, hasPermission } = useAuth()
  const canCreate = isSuperadmin || hasPermission('journal.create')
  const canUpdate = isSuperadmin || hasPermission('journal.update')
  const canDelete = isSuperadmin || hasPermission('journal.delete')
  const canPost = isSuperadmin || hasPermission('journal.update')
  const canReverse = isSuperadmin || hasPermission('journal.reverse') || hasPermission('journal.update')
  // ?search=<journal number> (links from a sale's Journals card) prefills the search.
  const initialSearch =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('search') ?? '' : ''
  const [search, setSearch] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<Journal | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [reverseConfirmId, setReverseConfirmId] = useState<number | null>(null)
  const [detailItem, setDetailItem] = useState<Journal | null>(null)
  const [coaSearch, setCoaSearch] = useState('')
  const [debouncedCoaSearch, setDebouncedCoaSearch] = useState('')

  useEffect(() => { const t = setTimeout(() => setDebouncedCoaSearch(coaSearch), 400); return () => clearTimeout(t) }, [coaSearch])

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 400); return () => clearTimeout(t) }, [search])
  useEffect(() => { setPage(1) }, [debouncedSearch, typeFilter])

  const { data, isLoading } = useQuery({
    queryKey: ['journals', page, perPage, debouncedSearch, typeFilter],
    queryFn: () => journalsService.list({ page, per_page: perPage, sort: '-id', include: 'period,journal_details,created_by', 'filter[search]': debouncedSearch || undefined, 'filter[type]': typeFilter || undefined }).then((r) => r.data),
  })

  const { data: periodsData } = useQuery({
    queryKey: ['periods-all', debouncedDropdownSearch],
    queryFn: () => periodsService.list({ 'filter[search]': debouncedDropdownSearch || undefined, per_page: 1000, sort: '-id' }).then((r) => r.data),
  })

  const { data: coaData } = useQuery({
    queryKey: ['chart-of-accounts-all', 'journals-active', debouncedCoaSearch],
    queryFn: () => chartOfAccountsService.list({ per_page: 1000, sort: 'code', 'filter[is_active]': 'true', 'filter[search]': debouncedCoaSearch || undefined } as any).then((r) => r.data),
  })

  const items: Journal[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta
  const periods: Period[] = (periodsData as any)?.data ?? []
  const accounts: CoA[] = (coaData as any)?.data ?? []
  const periodOptions = periods.map((p) => ({ value: String(p.id), label: p.name }))
  const accountOptions = accounts.map((a) => ({ value: String(a.id), label: `${a.code} ${a.name}` }))

  const deleteMutation = useMutation({
    mutationFn: (id: number) => journalsService.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['journals'] }); toast.success('Journal deleted'); setDeleteConfirmId(null) },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const postMutation = useMutation({
    mutationFn: (id: number) => journalsService.post(id),
    onSuccess: (_res, id) => { queryClient.invalidateQueries({ queryKey: ['journals'] }); queryClient.invalidateQueries({ queryKey: ['journal-detail', id] }); toast.success('Journal posted') },
    onError: (err: any) => toastMutationApiError(err, 'Failed to post journal'),
  })

  const reverseMutation = useMutation({
    mutationFn: (id: number) => journalsService.reverse(id),
    onSuccess: (_res, id) => {
      queryClient.invalidateQueries({ queryKey: ['journals'] })
      // Reversal also creates a new journal, but the original's detail must refresh too.
      queryClient.invalidateQueries({ queryKey: ['journal-detail', id] })
      toast.success('Journal reversed successfully')
      setReverseConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to reverse journal'),
  })

  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      period_id: 0, date: '', type: 'manual', description: '',
      details: [
        { chart_of_account_id: 0, debit: 0, credit: 0, description: '' },
        { chart_of_account_id: 0, debit: 0, credit: 0, description: '' },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'details' })
  const watchedDetails = watch('details')
  const watchedDate = watch('date')
  const watchedPeriodId = watch('period_id')

  const totalDebit = watchedDetails?.reduce((s, d) => s + (Number(d.debit) || 0), 0) ?? 0
  const totalCredit = watchedDetails?.reduce((s, d) => s + (Number(d.credit) || 0), 0) ?? 0
  const isBalanced = toCents(totalDebit) === toCents(totalCredit) && toCents(totalDebit) > 0

  const handleOpenCreate = () => {
    setEditData(null)
    const today = getTodayDateString()
    const matched = findPeriodForDate(today, periods)
    reset({
      period_id: matched ? matched.id : 0,
      date: today,
      type: 'manual',
      description: '',
      details: [
        { chart_of_account_id: 0, debit: 0, credit: 0, description: '' },
        { chart_of_account_id: 0, debit: 0, credit: 0, description: '' },
      ],
    })
    setSheetOpen(true)
  }

  const handleEditJournal = async (item: Journal) => {
    let journalToEdit = item
    if (!item.journal_details || item.journal_details.length === 0) {
      try {
        const res = await journalsService.findById(item.id, { include: 'period,journal_details,created_by' })
        journalToEdit = (res.data as any)?.data ?? (res.data as any) ?? item
      } catch (e) {
        console.error('Failed to load journal details for edit', e)
      }
    }

    const sorted = sortJournalLinesDebitFirst(journalToEdit.journal_details ?? [])
    setEditData({ ...journalToEdit, journal_details: sorted })
    reset({
      period_id: journalToEdit.period_id,
      date: toInputDate(journalToEdit.date),
      type: journalToEdit.type as any,
      description: journalToEdit.description ?? '',
      details: sorted.length
        ? sorted.map((d) => ({
            id: d.id,
            chart_of_account_id: d.chart_of_account_id,
            debit: Number(d.debit) || 0,
            credit: Number(d.credit) || 0,
            description: d.description ?? '',
          }))
        : [
            { chart_of_account_id: 0, debit: 0, credit: 0, description: '' },
            { chart_of_account_id: 0, debit: 0, credit: 0, description: '' },
          ],
    })
    setSheetOpen(true)
  }

  const handleDuplicateForEdit = async (item: Journal) => {
    let journalToCopy = item
    if (!item.journal_details || item.journal_details.length === 0) {
      try {
        const res = await journalsService.findById(item.id, { include: 'period,journal_details,created_by' })
        journalToCopy = (res.data as any)?.data ?? (res.data as any) ?? item
      } catch (e) {
        console.error('Failed to load journal details for correction', e)
      }
    }

    const sorted = sortJournalLinesDebitFirst(journalToCopy.journal_details ?? [])
    setEditData(null)
    const today = getTodayDateString()
    const matched = findPeriodForDate(today, periods)
    reset({
      period_id: matched ? matched.id : journalToCopy.period_id,
      date: today,
      type: (journalToCopy.type as any) || 'manual',
      description: journalToCopy.description
        ? `Correction of ${journalToCopy.journal_number}: ${journalToCopy.description}`
        : `Correction of ${journalToCopy.journal_number}`,
      details: sorted.length
        ? sorted.map((d) => ({
            chart_of_account_id: d.chart_of_account_id,
            debit: Number(d.debit) || 0,
            credit: Number(d.credit) || 0,
            description: d.description ?? '',
          }))
        : [
            { chart_of_account_id: 0, debit: 0, credit: 0, description: '' },
            { chart_of_account_id: 0, debit: 0, credit: 0, description: '' },
          ],
    })
    setSheetOpen(true)
  }

  useEffect(() => {
    if (editData) {
      const sorted = sortJournalLinesDebitFirst(editData.journal_details ?? [])
      reset({
        period_id: editData.period_id,
        date: toInputDate(editData.date),
        type: editData.type as any,
        description: editData.description ?? '',
        details: sorted.length
          ? sorted.map((d) => ({
              id: d.id,
              chart_of_account_id: d.chart_of_account_id,
              debit: Number(d.debit) || 0,
              credit: Number(d.credit) || 0,
              description: d.description ?? '',
            }))
          : [
              { chart_of_account_id: 0, debit: 0, credit: 0, description: '' },
              { chart_of_account_id: 0, debit: 0, credit: 0, description: '' },
            ],
      })
    }
  }, [editData, reset])

  // Liveness sync: If period is not yet set on create mode, auto match from date
  useEffect(() => {
    if (sheetOpen && !editData && (!watchedPeriodId || watchedPeriodId === 0) && periods.length > 0) {
      const targetDate = watchedDate || getTodayDateString()
      const matched = findPeriodForDate(targetDate, periods)
      if (matched) {
        setValue('period_id', matched.id, { shouldValidate: true })
      }
    }
  }, [sheetOpen, editData, watchedPeriodId, watchedDate, periods, setValue])

  const createMutation = useMutation({
    mutationFn: (data: JournalRequest) => journalsService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['journals'] }); toast.success('Journal created'); setSheetOpen(false) },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: JournalRequest) => journalsService.update(editData!.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['journals'] }); queryClient.invalidateQueries({ queryKey: ['journal-detail', editData?.id] }); toast.success('Journal updated'); setSheetOpen(false) },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const onSubmit = (values: FormValues) => {

    const payload: JournalRequest = {
      period_id: values.period_id,
      date: values.date,
      type: values.type,
      description: values.description,
      details: values.details.map((d) => ({ id: d.id, chart_of_account_id: d.chart_of_account_id, debit: Number(d.debit), credit: Number(d.credit), description: d.description })),
    }
    if (editData) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  // A rejected submit must never be silent: surface the first validation message.
  const onInvalid = (errs: any) => {
    const detailLineError = Array.isArray(errs?.details)
      ? errs.details.find((d: any) => d)?.chart_of_account_id?.message
      : undefined
    const msg =
      errs?.period_id?.message ??
      errs?.date?.message ??
      errs?.type?.message ??
      errs?.description?.message ??
      errs?.details?.message ??
      errs?.details?.root?.message ??
      detailLineError ??
      'Please check the form'
    toast.error(String(msg))
  }

  const numInputStyle: React.CSSProperties = { ...inputStyle, textAlign: 'right' }
  const smallInputStyle: React.CSSProperties = { ...inputStyle, padding: '7px 10px', fontSize: 13 }

  // Detail modal: fetch the journal by id for its lines
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['journal-detail', detailItem?.id],
    enabled: !!detailItem?.id,
    queryFn: () =>
      journalsService
        .findById(detailItem!.id, { include: 'period,journal_details,created_by' })
        .then((r) => r.data),
  })

  const fetchedJournal: Journal | undefined = (detailData as any)?.data ?? (detailData as any)
  const activeDetailJournal: Journal | undefined = fetchedJournal ?? (detailItem || undefined)

  // Detail modal: debit/credit lines, standard journal presentation (debits first, then credits).
  const detailLines = fetchedJournal?.journal_details ?? detailItem?.journal_details ?? []
  const sortedDetailLines = sortJournalLinesDebitFirst(detailLines)
  const detailTotalDebit = detailLines.reduce((s, l) => s + Number(l.debit || 0), 0)
  const detailTotalCredit = detailLines.reduce((s, l) => s + Number(l.credit || 0), 0)
  const detailIsBalanced = detailTotalDebit === detailTotalCredit

  const { mutate: exportExcel, isPending: isExporting } = useMutation({
    mutationFn: () => reportsService.exportJournalEntries(),
    onSuccess: (res) => { downloadFileFromResponse(res, 'journal-entries.xlsx') },
    onError: () => toast.error('Gagal mengekspor data.'),
  })

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Journals</h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Accounting journal entries with double-entry method (debit = credit)</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => exportExcel()} disabled={isExporting} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: isExporting ? 'not-allowed' : 'pointer', opacity: isExporting ? 0.6 : 1 }}>
            <Download size={14} /> {isExporting ? 'Exporting...' : 'Export Excel'}
          </button>
          {canCreate && (
            <button onClick={handleOpenCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <Plus size={16} /> New Journal Entry
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', width: 300 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search journal number or description..."
            style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--foreground)', background: 'var(--surface-raised)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }} />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ width: 160, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--foreground)', background: 'var(--surface-raised)', outline: 'none', cursor: 'pointer' }}
        >
          <option value="">All Types</option>
          {Object.entries(JOURNAL_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={{ ...thStyle, width: 140 }}>Journal No.</th>
              <th style={{ ...thStyle, width: 130 }}>Date</th>
              <th style={{ ...thStyle, width: 130 }}>Type</th>
              <th style={{ ...thStyle, width: 150 }}>Reference</th>
              <th style={thStyle}>Description</th>
              <th style={{ ...thStyle, width: 110 }}>Periode</th>
              <th style={{ ...thStyle, width: 140 }}>Created By</th>
              <th style={{ ...thStyle, width: 90 }}>Status</th>
              <th style={{ ...thStyle, width: 100 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 10 }).map((__, j) => (
                  <td key={j} style={tdStyle}><div style={{ height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--border)', width: j === 9 ? 60 : '80%', animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                ))}</tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={10} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--foreground-muted)' }}>
                  <FileText size={32} style={{ opacity: 0.4 }} />
                  <span style={{ fontSize: 14 }}>No journals found</span>
                </div>
              </td></tr>
            ) : (
              items.map((item, idx) => (
                <tr key={item.id} style={{ transition: 'background 120ms' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13, width: 50 }}>
                    {(page - 1) * perPage + idx + 1}
                  </td>
                  <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--foreground-muted)' }}>{item.journal_number}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{item.date ? fmtDate(item.date) : '—'}</span></td>
                  <td style={tdStyle}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 12, background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>
                      {JOURNAL_TYPE_LABELS[item.type] ?? item.type}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {(() => {
                      const href = referenceHref(item.reference_type, item.reference_id)
                      if (!href) {
                        return (
                          <span style={{ fontSize: 13, color: 'var(--foreground-subtle)' }}>
                            {item.reference_type
                              ? `${referenceLabel(item.reference_type)}${item.reference_id ? ` #${item.reference_id}` : ''}`
                              : '—'}
                          </span>
                        )
                      }
                      return (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Buka ${referenceLabel(item.reference_type)} #${item.reference_id}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 13,
                            color: 'var(--accent)',
                            textDecoration: 'none',
                            fontWeight: 500,
                          }}
                        >
                          <span>{referenceLabel(item.reference_type)}</span>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '1px 6px',
                              borderRadius: 99,
                              fontSize: 11,
                              fontFamily: 'monospace',
                              background: 'var(--accent-light-bg)',
                              color: 'var(--accent)',
                            }}
                          >
                            #{item.reference_id}
                          </span>
                          <ExternalLink size={11} style={{ color: 'var(--foreground-muted)' }} />
                        </a>
                      )
                    })()}
                  </td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground)' }}>{item.description || '—'}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{item.period?.name || '—'}</span></td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: 13, color: 'var(--foreground)' }}>{item.created_by?.name || '—'}</div>
                    {item.created_at && (
                      <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>{formatDate(item.created_at)}</div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {item.is_reversed ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#8b5cf6', padding: '2px 8px', borderRadius: 99, background: 'rgba(139,92,246,0.1)' }}>
                        <RotateCcw size={11} /> Reversed
                      </span>
                    ) : item.is_posted ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#10b981', padding: '2px 8px', borderRadius: 99, background: 'rgba(16,185,129,0.1)' }}>
                        <CheckCircle2 size={11} /> Posted
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#f59e0b', padding: '2px 8px', borderRadius: 99, background: 'rgba(245,158,11,0.1)' }}>
                        <AlertCircle size={11} /> Draft
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button onClick={() => setDetailItem(item)} title="View Detail"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--foreground-muted)', display: 'flex' }}><Eye size={14} /></button>
                      {!item.is_posted && (
                        <>
                          {canPost && <button onClick={() => postMutation.mutate(item.id)} disabled={postMutation.isPending} title="Post Journal"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: '#10b981', display: 'flex' }}><Send size={13} /></button>}
                          {canUpdate && <button onClick={() => handleEditJournal(item)} title="Edit Journal"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--foreground-muted)', display: 'flex' }}><Pencil size={14} /></button>}
                          {canDelete && <button onClick={() => setDeleteConfirmId(item.id)} title="Delete Journal"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--destructive)', display: 'flex' }}><Trash2 size={14} /></button>}
                        </>
                      )}
                      {item.is_posted && !item.is_reversed && canReverse && (
                        <button onClick={() => setReverseConfirmId(item.id)} disabled={reverseMutation.isPending} title="Reverse Journal"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: '#8b5cf6', display: 'flex' }}><RotateCcw size={14} /></button>
                      )}
                      {item.is_reversed && canCreate && (
                        <button onClick={() => handleDuplicateForEdit(item)} title="Koreksi / Buat Ulang Jurnal"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--accent)', display: 'flex' }}><Copy size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

      {deleteConfirmId !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDeleteConfirmId(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
          <div style={{ position: 'relative', zIndex: 70, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', width: 360, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>Delete Journal</h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>Only draft journals can be deleted.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ padding: '7px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending} style={{ padding: '7px 16px', background: 'var(--destructive)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', opacity: deleteMutation.isPending ? 0.7 : 1 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {reverseConfirmId !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setReverseConfirmId(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
          <div style={{ position: 'relative', zIndex: 70, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', width: 400, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>Reverse Journal</h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px', lineHeight: 1.5 }}>
              Apakah Anda yakin ingin membalikkan (reverse) jurnal ini? Sistem akan membuat entri jurnal pembalik dan menandai jurnal ini sebagai reversed.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setReverseConfirmId(null)} style={{ padding: '7px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => reverseMutation.mutate(reverseConfirmId)} disabled={reverseMutation.isPending} style={{ padding: '7px 16px', background: '#8b5cf6', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', opacity: reverseMutation.isPending ? 0.7 : 1 }}>
                {reverseMutation.isPending ? 'Reversing...' : 'Reverse'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sheetOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSheetOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
          <div style={{ position: 'relative', zIndex: 50, width: 680, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>{editData ? 'Edit Journal' : 'New Journal Entry'}</h2>
              <button onClick={() => setSheetOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} color="var(--foreground-muted)" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit, onInvalid)} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Header fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Periode <span style={{ color: 'var(--destructive)' }}>*</span></label>
                  <Controller
                    control={control}
                    name="period_id"
                    render={({ field }) => (
                      <SearchableSelect
                        value={String(field.value ?? 0)}
                        onChange={(val) => field.onChange(Number(val))}
                        options={periodOptions}
                        placeholder="-- Pilih Periode --"
                        searchPlaceholder="Cari periode..."
                        onSearchChange={setDropdownSearch}
                      />
                    )}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Date <span style={{ color: 'var(--destructive)' }}>*</span></label>
                  <input
                    type="date"
                    {...register('date')}
                    onChange={(e) => {
                      const val = e.target.value
                      setValue('date', val, { shouldValidate: true })
                      if (val) {
                        const matched = findPeriodForDate(val, periods)
                        if (matched) {
                          setValue('period_id', matched.id, { shouldValidate: true })
                        }
                      }
                    }}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Journal Type</label>
                  <Controller
                    control={control}
                    name="type"
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value}
                        onChange={(val) => field.onChange(val)}
                        options={
                          // Keep system types (sales, production, …) visible when editing such a journal.
                          !field.value || JOURNAL_TYPE_OPTIONS.some((o) => o.value === field.value)
                            ? JOURNAL_TYPE_OPTIONS
                            : [...JOURNAL_TYPE_OPTIONS, { value: field.value, label: JOURNAL_TYPE_LABELS[field.value] ?? field.value }]
                        }
                        placeholder="Select type..."
                        searchPlaceholder="Cari tipe jurnal..."
                      />
                    )}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Description <span style={{ color: 'var(--destructive)' }}>*</span></label>
                  <input {...register('description')} placeholder="Journal description" style={inputStyle} />
                  {errors.description && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.description.message}</span>}
                </div>
              </div>

              {/* Journal Lines */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Journal Lines</label>
                  <button type="button" onClick={() => append({ chart_of_account_id: 0, debit: 0, credit: 0, description: '' })}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 12, cursor: 'pointer' }}>
                    <Plus size={12} /> Add Line
                  </button>
                </div>

                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--background)' }}>
                        <th style={{ ...thStyle, fontSize: 11 }}>Account</th>
                        <th style={{ ...thStyle, fontSize: 11, width: 110, textAlign: 'right' }}>Debit (Rp)</th>
                        <th style={{ ...thStyle, fontSize: 11, width: 110, textAlign: 'right' }}>Credit (Rp)</th>
                        <th style={{ ...thStyle, fontSize: 11, width: 130 }}>Description</th>
                        <th style={{ ...thStyle, width: 36 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field, idx) => {
                        const currentDebit = Number(watchedDetails?.[idx]?.debit) || 0;
                        const currentCredit = Number(watchedDetails?.[idx]?.credit) || 0;
                        return (
                          <tr key={field.id}>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                              <Controller
                                control={control}
                                name={`details.${idx}.chart_of_account_id`}
                                render={({ field }) => (
                                  <SearchableSelect
                                    value={String(field.value ?? 0)}
                                    onChange={(val) => field.onChange(Number(val))}
                                    options={accountOptions}
                                    placeholder="-- Pilih Akun --"
                                    searchPlaceholder="Cari akun..."
                                    onSearchChange={setCoaSearch}
                                  />
                                )}
                              />
                            </td>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                              <Controller
                                control={control}
                                name={`details.${idx}.debit`}
                                render={({ field }) => (
                                  <LocalizedNumberInput
                                    disabled={currentCredit > 0}
                                    value={field.value || ''}
                                    onChange={(n) => field.onChange(Number.isFinite(n) ? n : 0)}
                                    decimals={2}
                                    padDecimals={false}
                                    style={{
                                      ...smallInputStyle,
                                      textAlign: 'right',
                                      fontSize: 12,
                                      background: currentCredit > 0 ? 'var(--muted)' : 'var(--surface-raised)',
                                      opacity: currentCredit > 0 ? 0.6 : 1,
                                      cursor: currentCredit > 0 ? 'not-allowed' : 'text',
                                    }}
                                    placeholder="0"
                                  />
                                )}
                              />
                            </td>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                              <Controller
                                control={control}
                                name={`details.${idx}.credit`}
                                render={({ field }) => (
                                  <LocalizedNumberInput
                                    disabled={currentDebit > 0}
                                    value={field.value || ''}
                                    onChange={(n) => field.onChange(Number.isFinite(n) ? n : 0)}
                                    decimals={2}
                                    padDecimals={false}
                                    style={{
                                      ...smallInputStyle,
                                      textAlign: 'right',
                                      fontSize: 12,
                                      background: currentDebit > 0 ? 'var(--muted)' : 'var(--surface-raised)',
                                      opacity: currentDebit > 0 ? 0.6 : 1,
                                      cursor: currentDebit > 0 ? 'not-allowed' : 'text',
                                    }}
                                    placeholder="0"
                                  />
                                )}
                              />
                            </td>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                              <input {...register(`details.${idx}.description`)} style={{ ...smallInputStyle, fontSize: 12 }} placeholder="Opsional" />
                            </td>
                            <td style={{ padding: '6px 4px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                              {fields.length > 2 && (
                                <button type="button" onClick={() => remove(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--destructive)', display: 'flex' }}><X size={14} /></button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--background)' }}>
                        <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600 }}>Total</td>
                        <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, textAlign: 'right', color: 'var(--foreground)' }}>{fmtCurrency(totalDebit)}</td>
                        <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, textAlign: 'right', color: 'var(--foreground)' }}>{fmtCurrency(totalCredit)}</td>
                        <td colSpan={2} style={{ padding: '8px 10px' }}>
                          {totalDebit > 0 && (
                            isBalanced
                              ? <span style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} /> Seimbang</span>
                              : <span style={{ fontSize: 11, color: 'var(--destructive)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={11} /> Tidak seimbang</span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {(errors.details as any)?.message && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{(errors.details as any).message}</span>}
              </div>
            </form>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSheetOpen(false)} style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
              {!isBalanced && (
                <span style={{ marginRight: 'auto', alignSelf: 'center', fontSize: 12, color: 'var(--destructive)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={12} />
                  {toCents(totalDebit) <= 0 ? 'Enter debit and credit amounts' : 'Total debit must equal total credit'}
                </span>
              )}
              <button type="button" disabled={isPending || !isBalanced} onClick={handleSubmit(onSubmit, onInvalid)} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: isPending || !isBalanced ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: isPending || !isBalanced ? 0.6 : 1 }}>
                {isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                {editData ? 'Save' : 'Create Journal (Draft)'}
              </button>
            </div>
          </div>
        </div>
      )}
      {detailItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDetailItem(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
          <div style={{ position: 'relative', zIndex: 70, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', width: 640, maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>
                  {activeDetailJournal?.journal_number}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
                  {activeDetailJournal?.date ? fmtDate(activeDetailJournal.date) : '—'} · {JOURNAL_TYPE_LABELS[activeDetailJournal?.type || ''] ?? activeDetailJournal?.type} · {activeDetailJournal?.period?.name || '—'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
                  Created by: <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{activeDetailJournal?.created_by?.name || '—'}</span>
                  {activeDetailJournal?.created_at && (
                    <span style={{ marginLeft: 6 }}>({formatDateTime(activeDetailJournal.created_at)})</span>
                  )}
                </p>
                {(() => {
                  const href = referenceHref(activeDetailJournal?.reference_type, activeDetailJournal?.reference_id)
                  if (!href) return null
                  return (
                    <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
                      Reference:{' '}
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        {referenceLabel(activeDetailJournal?.reference_type)} #{activeDetailJournal?.reference_id}
                        <ExternalLink size={11} />
                      </a>
                    </p>
                  )
                })()}
              </div>
              <button onClick={() => setDetailItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} color="var(--foreground-muted)" /></button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 20px', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {activeDetailJournal?.is_reversed ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#8b5cf6', padding: '2px 8px', borderRadius: 99, background: 'rgba(139,92,246,0.1)' }}>
                    <RotateCcw size={11} /> Reversed
                  </span>
                ) : activeDetailJournal?.is_posted ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#10b981', padding: '2px 8px', borderRadius: 99, background: 'rgba(16,185,129,0.1)' }}>
                    <CheckCircle2 size={11} /> Posted
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#f59e0b', padding: '2px 8px', borderRadius: 99, background: 'rgba(245,158,11,0.1)' }}>
                    <AlertCircle size={11} /> Draft
                  </span>
                )}
                {activeDetailJournal?.description && (
                  <span style={{ fontSize: 13, color: 'var(--foreground)' }}>{activeDetailJournal.description}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {activeDetailJournal?.is_posted && !activeDetailJournal?.is_reversed && canReverse && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = activeDetailJournal.id
                      setDetailItem(null)
                      setReverseConfirmId(id)
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                  >
                    <RotateCcw size={12} /> Reverse Journal
                  </button>
                )}
                {activeDetailJournal?.is_reversed && canCreate && (
                  <button
                    type="button"
                    onClick={() => {
                      const item = activeDetailJournal
                      setDetailItem(null)
                      handleDuplicateForEdit(item)
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                  >
                    <Copy size={12} /> Koreksi / Buat Ulang
                  </button>
                )}
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--background)' }}>
                    <th style={thStyle}>Account</th>
                    <th style={{ ...thStyle, width: 150, textAlign: 'right' }}>Debit</th>
                    <th style={{ ...thStyle, width: 150, textAlign: 'right' }}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {detailLoading ? (
                    <tr>
                      <td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>
                        Loading…
                      </td>
                    </tr>
                  ) : sortedDetailLines.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>
                        No journal lines
                      </td>
                    </tr>
                  ) : (
                    sortedDetailLines.map((line, idx) => (
                      <tr key={line.id ?? idx}>
                        <td style={tdStyle}>
                          <div style={{ fontSize: 13, color: 'var(--foreground)' }}>
                            {line.chart_of_account
                              ? `${line.chart_of_account.code} — ${line.chart_of_account.name}`
                              : `Account #${line.chart_of_account_id}`}
                          </div>
                          {line.description && (
                            <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 2 }}>{line.description}</div>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {Number(line.debit) > 0 ? `Rp ${Number(line.debit).toLocaleString('id-ID')}` : ''}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {Number(line.credit) > 0 ? `Rp ${Number(line.credit).toLocaleString('id-ID')}` : ''}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--background)' }}>
                    <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>Total</td>
                    <td style={{
                      padding: '10px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                      color: detailIsBalanced ? 'var(--foreground)' : 'var(--warning)',
                    }}>
                      Rp {detailTotalDebit.toLocaleString('id-ID')}
                    </td>
                    <td style={{
                      padding: '10px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                      color: detailIsBalanced ? 'var(--foreground)' : 'var(--warning)',
                    }}>
                      Rp {detailTotalCredit.toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
