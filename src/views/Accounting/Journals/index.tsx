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
import { referenceLabel, referenceHref } from '@/lib/references'
import ReferenceLink from '@/components/ReferenceLink'
import { journalEditBlock, journalDeleteBlock, journalReverseBlock, blockedStyle } from '@/lib/actionGuards'
import SearchableSelect from '@/components/SearchableSelect'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import LocalizedNumberInput from '@/components/LocalizedNumberInput'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { useDeepLinkId } from '@/views/Operations/shared'
import { FilterBar, FilterGroup, FilterField, FilterSelect, FilterInput, countActive } from '@/components/ListFilters'
import AccountingBranchFilter, { accountingBranchParam, useBranchNameOf, useOtherBranchBlock } from '../AccountingBranchFilter'
import {
  Plus, Pencil, Trash2, ChevronLeft, ChevronRight,
  X, Loader2, FileText, CheckCircle2, Send, AlertCircle, Eye, Download,
  RotateCcw, Copy,
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
  // 'closing' is not offered: the API refuses it (posted only by closing a fiscal year).
  { value: 'payment', label: 'Payment' },
  { value: 'purchase', label: 'Purchase' },
]

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

  const queryClient = useQueryClient()
  const { isSuperadmin, hasPermission } = useAuth()
  const canCreate = isSuperadmin || hasPermission('journal.create')
  const canUpdate = isSuperadmin || hasPermission('journal.update')
  const canDelete = isSuperadmin || hasPermission('journal.delete')
  // Route keys: POST /:id/post → journal.post, POST /:id/reverse → journal.create (journals/.../journal_route.go)
  const canPost = isSuperadmin || hasPermission('journal.post')
  const canReverse = isSuperadmin || hasPermission('journal.create')
  // ?search=<journal number> (links from a sale's Journals card) prefills the search.
  const initialSearch =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('search') ?? '' : ''
  const [search, setSearch] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)
  const [typeFilter, setTypeFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  // ?account_ids=&account=&posted=1 (the balance link on Chart of Accounts) opens
  // the posted journals on those accounts.
  const initialParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const [accountFilter, setAccountFilter] = useState<{ ids: string; label: string } | null>(() => {
    const ids = initialParams?.get('account_ids') ?? ''
    return ids ? { ids, label: initialParams?.get('account') || 'Selected accounts' } : null
  })
  const [postedFilter, setPostedFilter] = useState(initialParams?.get('posted') ?? '')
  const [reversedFilter, setReversedFilter] = useState('')
  // '' = every branch of the company (accounting is run by head office).
  const [branchFilter, setBranchFilter] = useState('')
  const branchNameOf = useBranchNameOf()
  const otherBranchBlock = useOtherBranchBlock()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<Journal | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [reverseConfirmId, setReverseConfirmId] = useState<number | null>(null)
  const [detailItem, setDetailItem] = useState<Journal | null>(null)
  // `?id=` (from a ReferenceLink, e.g. the General Ledger) opens that journal's
  // detail; the panel loads the full journal by id.
  const [deepJournalId, clearDeepJournalId] = useDeepLinkId()
  useEffect(() => {
    if (deepJournalId) setDetailItem((cur) => (cur?.id === deepJournalId ? cur : ({ id: deepJournalId } as Journal)))
  }, [deepJournalId])
  const closeDetail = () => {
    setDetailItem(null)
    clearDeepJournalId()
  }
  const [coaSearch, setCoaSearch] = useState('')
  const [debouncedCoaSearch, setDebouncedCoaSearch] = useState('')

  useEffect(() => { const t = setTimeout(() => setDebouncedCoaSearch(coaSearch), 400); return () => clearTimeout(t) }, [coaSearch])

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 400); return () => clearTimeout(t) }, [search])
  useEffect(() => { setPage(1) }, [debouncedSearch, typeFilter, periodFilter, dateFilter, postedFilter, reversedFilter, accountFilter, branchFilter])

  // Shared by the list and the Excel export (the export reads the same filter[...] keys).
  const listFilters = {
    'filter[search]': debouncedSearch || undefined,
    'filter[type]': typeFilter || undefined,
    'filter[period_id]': periodFilter || undefined,
    'filter[date]': dateFilter || undefined,
    'filter[is_posted]': postedFilter || undefined,
    'filter[is_reversed]': reversedFilter || undefined,
    'filter[chart_of_account_id]': accountFilter?.ids || undefined,
    ...accountingBranchParam(branchFilter),
  }

  const { data, isLoading: listFirstLoad, isFetching: listFetching } = useQuery({
    queryKey: ['journals', page, perPage, debouncedSearch, typeFilter, periodFilter, dateFilter, postedFilter, reversedFilter, accountFilter?.ids, branchFilter],
    queryFn: () => journalsService.list({
      page, per_page: perPage, sort: '-id', include: 'period,journal_details,created_by',
      ...listFilters,
    } as any).then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  // Filter dropdown: full period list (independent of the sheet's dropdown search).
  const { data: filterPeriodsData } = useQuery({
    queryKey: ['periods-all', ''],
    queryFn: () => periodsService.list({ per_page: 1000, sort: '-id' } as any).then((r) => r.data),
  })
  const filterPeriods: Period[] = (filterPeriodsData as any)?.data ?? []

  // Form dropdown: OPEN periods only (a journal cannot be posted into a closed
  // period). Fetched unfiltered so the date → period match sees every open period;
  // the select searches its options locally.
  const { data: periodsData } = useQuery({
    queryKey: ['periods-all', 'open'],
    queryFn: () => periodsService.list({ 'filter[is_closed]': 'false', per_page: 1000, sort: '-id' } as any).then((r) => r.data),
  })

  const coaOpts = useInfiniteOptions<CoA>({
    queryKey: ['chart-of-accounts-all', 'journals-active', debouncedCoaSearch],
    fetchPage: (page) => chartOfAccountsService.list({ page, per_page: 20, sort: 'code,id', 'filter[is_active]': 'true', 'filter[is_header]': 'false', 'filter[search]': debouncedCoaSearch || undefined } as any).then((r) => r.data),
  })

  const items: Journal[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta
  const periods: Period[] = ((periodsData as any)?.data ?? []).filter((p: Period) => !p.is_closed)
  const periodOptions = periods.map((p) => ({ value: String(p.id), label: p.name }))
  // id → account cache (loaded pages + accounts included on journal lines) so a line's
  // chosen account keeps its label even when it is not in the currently loaded pages.
  const seenCoaRef = React.useRef(new Map<number, CoA>())
  const rememberAccounts = (lines?: JournalDetail[]) => {
    for (const d of lines ?? []) if (d.chart_of_account?.id) seenCoaRef.current.set(d.chart_of_account.id, d.chart_of_account)
  }
  for (const a of coaOpts.items) seenCoaRef.current.set(a.id, a)
  for (const j of items) rememberAccounts(j.journal_details)

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

  const loadedAccountIds = new Set(coaOpts.items.map((a) => a.id))
  const selectedExtraAccounts = Array.from(new Set((watchedDetails ?? []).map((d) => Number(d.chart_of_account_id) || 0)))
    .filter((id) => id && !loadedAccountIds.has(id) && seenCoaRef.current.has(id))
    .map((id) => seenCoaRef.current.get(id)!)
  const accountOptions = [...coaOpts.items, ...selectedExtraAccounts].map((a) => ({ value: String(a.id), label: `${a.code} ${a.name}` }))

  const totalDebit = watchedDetails?.reduce((s, d) => s + (Number(d.debit) || 0), 0) ?? 0
  const totalCredit = watchedDetails?.reduce((s, d) => s + (Number(d.credit) || 0), 0) ?? 0
  const isBalanced = toCents(totalDebit) === toCents(totalCredit) && toCents(totalDebit) > 0

  // The journal date must fall inside the chosen (open) period — the API books
  // by period_id, so a mismatch would land the entry in the wrong period.
  const selectedPeriod = periods.find((p) => p.id === Number(watchedPeriodId))
  const dateTarget = watchedDate ? toInputDate(watchedDate) : ''
  const dateError: string | null = !dateTarget || !periods.length
    ? null
    : !findPeriodForDate(dateTarget, periods)
      ? 'No open period covers this date'
      : selectedPeriod && selectedPeriod.start_date && selectedPeriod.end_date &&
        (dateTarget < toInputDate(selectedPeriod.start_date) || dateTarget > toInputDate(selectedPeriod.end_date))
        ? `Date is outside ${selectedPeriod.name} (${fmtDate(selectedPeriod.start_date)} – ${fmtDate(selectedPeriod.end_date)})`
        : null

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

    rememberAccounts(journalToEdit.journal_details)
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

    rememberAccounts(journalToCopy.journal_details)
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
    if (dateError) { toast.error(dateError); return }

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
  const detailIsBalanced = detailLines.reduce((s, l) => s + toCents(Number(l.debit || 0)), 0) ===
    detailLines.reduce((s, l) => s + toCents(Number(l.credit || 0)), 0)

  const { mutate: exportExcel, isPending: isExporting } = useMutation({
    mutationFn: () => reportsService.exportJournalEntries({ ...listFilters, sort: '-id' } as any),
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

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search journal number or description..."
        activeCount={countActive(typeFilter, periodFilter, dateFilter, postedFilter, reversedFilter, accountFilter, branchFilter)}
        onClear={() => { setBranchFilter(''); setTypeFilter(''); setPeriodFilter(''); setDateFilter(''); setPostedFilter(''); setReversedFilter(''); setAccountFilter(null); setPage(1) }}
        quick={
          <>
            {accountFilter && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 6px 0 10px', borderRadius: 999, background: 'var(--accent-light-bg)', color: 'var(--accent)', fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', maxWidth: 280 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Account: {accountFilter.label}</span>
                <button type="button" title="Remove account filter" onClick={() => setAccountFilter(null)} className="v2-icon-btn" style={{ width: 20, height: 20, color: 'var(--accent)' }}>
                  <X size={12} />
                </button>
              </span>
            )}
            <AccountingBranchFilter value={branchFilter} onChange={setBranchFilter} />
            <FilterSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: 160 }}>
              <option value="">All Types</option>
              {Object.entries(JOURNAL_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="">All Periods</option>
              {filterPeriods.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </FilterSelect>
          </>
        }
      >
        <FilterGroup title="Dates">
          <FilterField label="Journal date">
            <FilterInput type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          </FilterField>
        </FilterGroup>
        <FilterGroup title="Flags">
          <FilterField label="Posted">
            <FilterSelect block value={postedFilter} onChange={(e) => setPostedFilter(e.target.value)}>
              <option value="">All</option>
              <option value="1">Yes</option>
              <option value="0">No</option>
            </FilterSelect>
          </FilterField>
          <FilterField label="Reversed">
            <FilterSelect block value={reversedFilter} onChange={(e) => setReversedFilter(e.target.value)}>
              <option value="">All</option>
              <option value="1">Yes</option>
              <option value="0">No</option>
            </FilterSelect>
          </FilterField>
        </FilterGroup>
      </FilterBar>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={{ ...thStyle, width: 140 }}>Journal No.</th>
              <th style={{ ...thStyle, width: 130 }}>Branch</th>
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
                <tr key={i}>{Array.from({ length: 11 }).map((__, j) => (
                  <td key={j} style={tdStyle}><div style={{ height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--border)', width: j === 9 ? 60 : '80%', animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                ))}</tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={11} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
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
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground)' }}>{branchNameOf(item as any)}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{item.date ? fmtDate(item.date) : '—'}</span></td>
                  <td style={tdStyle}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 12, background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>
                      {JOURNAL_TYPE_LABELS[item.type] ?? item.type}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {item.reference_type ? (
                      <ReferenceLink type={item.reference_type} id={item.reference_id} newTab style={{ fontSize: 13 }}>
                        {referenceLabel(item.reference_type)}
                      </ReferenceLink>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--foreground-subtle)' }}>—</span>
                    )}
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
                      {(() => {
                        // Writes go to the journal's own branch (the API scopes them to the active branch).
                        const branchBlock = otherBranchBlock(item as any)
                        const editBlock = branchBlock ?? journalEditBlock(item)
                        const deleteBlock = branchBlock ?? journalDeleteBlock(item)
                        const postBlock = branchBlock ?? ((item.period as any)?.is_closed ? 'Period is closed' : null)
                        const reverseBlock = branchBlock ?? journalReverseBlock(item)
                        const btn = (color: string, blocked: string | null) => ({ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color, display: 'flex', ...(blocked ? blockedStyle : {}) })
                        return (
                          <>
                            {!item.is_posted && canPost && <button onClick={() => { if (!postBlock) postMutation.mutate(item.id) }} disabled={postMutation.isPending || !!postBlock} title={postBlock ?? 'Post Journal'}
                              style={btn('#10b981', postBlock)}><Send size={13} /></button>}
                            {canUpdate && <button onClick={() => { if (!editBlock) handleEditJournal(item) }} disabled={!!editBlock} title={editBlock ?? 'Edit Journal'}
                              style={btn('var(--foreground-muted)', editBlock)}><Pencil size={14} /></button>}
                            {canDelete && <button onClick={() => { if (!deleteBlock) setDeleteConfirmId(item.id) }} disabled={!!deleteBlock} title={deleteBlock ?? 'Delete Journal'}
                              style={btn('var(--destructive)', deleteBlock)}><Trash2 size={14} /></button>}
                            {item.is_posted && !item.is_reversed && canReverse && (
                              <button onClick={() => { if (!reverseBlock) setReverseConfirmId(item.id) }} disabled={reverseMutation.isPending || !!reverseBlock} title={reverseBlock ?? 'Reverse Journal'}
                                style={btn('#8b5cf6', reverseBlock)}><RotateCcw size={14} /></button>
                            )}
                          </>
                        )
                      })()}
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
                        // No open period covers the date → clear the period so a stale one isn't submitted.
                        setValue('period_id', matched ? matched.id : 0, { shouldValidate: true })
                      }
                    }}
                    style={dateError ? { ...inputStyle, border: '1px solid var(--destructive)' } : inputStyle}
                  />
                  {dateError && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{dateError}</span>}
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
                                    loading={coaOpts.loading}
                                    {...coaOpts.selectProps}
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
              <button type="button" disabled={isPending || !isBalanced || !!dateError} title={dateError ?? undefined} onClick={handleSubmit(onSubmit, onInvalid)} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: isPending || !isBalanced || dateError ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: isPending || !isBalanced || dateError ? 0.6 : 1 }}>
                {isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                {editData ? 'Save' : 'Create Journal (Draft)'}
              </button>
            </div>
          </div>
        </div>
      )}
      {detailItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => closeDetail()} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
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
                {activeDetailJournal?.reference_type && referenceHref(activeDetailJournal.reference_type, activeDetailJournal.reference_id) && (
                  <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
                    Reference:{' '}
                    <ReferenceLink type={activeDetailJournal.reference_type} id={activeDetailJournal.reference_id} newTab>
                      Go to {referenceLabel(activeDetailJournal.reference_type).toLowerCase()}
                    </ReferenceLink>
                  </p>
                )}
              </div>
              <button onClick={() => closeDetail()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} color="var(--foreground-muted)" /></button>
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
                    disabled={!!(otherBranchBlock(activeDetailJournal as any) ?? journalReverseBlock(activeDetailJournal))}
                    title={(otherBranchBlock(activeDetailJournal as any) ?? journalReverseBlock(activeDetailJournal)) ?? 'Reverse Journal'}
                    onClick={() => {
                      if ((otherBranchBlock(activeDetailJournal as any) ?? journalReverseBlock(activeDetailJournal))) return
                      const id = activeDetailJournal.id
                      closeDetail()
                      setReverseConfirmId(id)
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 500, cursor: 'pointer', ...((otherBranchBlock(activeDetailJournal as any) ?? journalReverseBlock(activeDetailJournal)) ? blockedStyle : {}) }}
                  >
                    <RotateCcw size={12} /> Reverse Journal
                  </button>
                )}
                {/* The copy is created on the active branch, so only offer it on the journal's own branch. */}
                {activeDetailJournal?.is_reversed && canCreate && !otherBranchBlock(activeDetailJournal as any) && (
                  <button
                    type="button"
                    onClick={() => {
                      const item = activeDetailJournal
                      closeDetail()
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
