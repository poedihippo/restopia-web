'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  cashTransactionsService,
  CashTransaction,
  CashTransactionRequest,
  CashTransactionType,
} from '@/services/cash-transactions.service'
import { bankAccountsService, BankAccount } from '@/services/bank-accounts.service'
import { chartOfAccountsService } from '@/services/accounting.service'
import { useAuth } from '@/hooks/useAuth'
import { cashTransactionDeleteBlock, blockedStyle } from '@/lib/actionGuards'
import SearchableSelect from '@/components/SearchableSelect'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { FilterBar, FilterGroup, FilterField, FilterSelect, DateRange, countActive, filterControlStyle } from '@/components/ListFilters'
import FinancePeriodSelect from '@/views/Reports/FinancePeriodSelect'
import { formatCurrency } from '@/utils/price'
import { formatDate, formatDateTime } from '@/utils/date'
import { toastMutationApiError } from '@/utils/apiError'
import {
  Plus,
  Trash2,
  Eye,
  X,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  RotateCcw,
  ReceiptText,
} from 'lucide-react'

const schema = z
  .object({
    transaction_date: z.string().min(1, 'Transaction date is required'),
    type: z.enum(['cash_in', 'cash_out', 'transfer']),
    amount: z.coerce.number().positive('Amount must be greater than 0'),
    bank_account_id: z.coerce.number().min(1, 'Bank account is required'),
    chart_of_account_id: z.coerce.number().optional().nullable(),
    transfer_to_bank_account_id: z.coerce.number().optional().nullable(),
    description: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'transfer') {
      if (!data.transfer_to_bank_account_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['transfer_to_bank_account_id'],
          message: 'Destination bank account is required for transfer',
        })
      } else if (data.transfer_to_bank_account_id === data.bank_account_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['transfer_to_bank_account_id'],
          message: 'Destination account must be different from source account',
        })
      }
    }
    // cash_in / cash_out: chart_of_account_id is optional — when empty the API
    // books against the outlet's petty cash account.
  })

type FormValues = z.infer<typeof schema>

// The API returns bank accounts only through `details[]` (include=details):
// cash_in/cash_out → details[0] is the bank account; transfer → details[0] is
// the source and details[1] the destination (cash-transactions/.../create_usecase.go).
type DetailBank = NonNullable<NonNullable<CashTransaction['details']>[number]['bank_account']>
const sourceBank = (ct: CashTransaction): DetailBank | undefined => ct.details?.[0]?.bank_account
const destinationBank = (ct: CashTransaction): DetailBank | undefined =>
  ct.type === 'transfer' ? ct.details?.[1]?.bank_account : undefined
const bankLabel = (b?: DetailBank) => (b ? `${b.bank_name} (${b.account_number})` : '—')
const bankLong = (b?: DetailBank) => (b ? `${b.bank_name} - ${b.account_number} (${b.account_name})` : '—')

const TYPE_CONFIG: Record<
  CashTransactionType,
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; bg: string; color: string }
> = {
  cash_in: {
    label: 'Cash In',
    icon: ArrowDownLeft,
    bg: 'var(--success-bg, #f0fdf4)',
    color: 'var(--success, #16a34a)',
  },
  cash_out: {
    label: 'Cash Out',
    icon: ArrowUpRight,
    bg: 'var(--destructive-bg, #fef2f2)',
    color: 'var(--destructive, #dc2626)',
  },
  transfer: {
    label: 'Transfer',
    icon: ArrowLeftRight,
    bg: 'var(--info-bg, #eff6ff)',
    color: 'var(--info, #2563eb)',
  },
}

export default function CashTransactionsView() {
  const queryClient = useQueryClient()
  const { isSuperadmin, hasPermission } = useAuth()

  const canRead = isSuperadmin || hasPermission('cash_transaction.read')
  const canCreate = isSuperadmin || hasPermission('cash_transaction.create')
  // PATCH /:id/reverse is guarded by cash-transaction.reverse (cash-transactions/.../cash_transaction_route.go)
  const canReverse = isSuperadmin || hasPermission('cash_transaction.reverse')
  const canDelete = isSuperadmin || hasPermission('cash_transaction.delete')

  const todayStr = new Date().toLocaleDateString('en-CA')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [bankDropdownSearch, setBankDropdownSearch] = useState('')
  const [debouncedBankDropdownSearch, setDebouncedBankDropdownSearch] = useState('')
  const [coaDropdownSearch, setCoaDropdownSearch] = useState('')
  const [debouncedCoaDropdownSearch, setDebouncedCoaDropdownSearch] = useState('')

  const [sheetOpen, setSheetOpen] = useState(false)
  const [viewItem, setViewItem] = useState<CashTransaction | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [reverseConfirmItem, setReverseConfirmItem] = useState<CashTransaction | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedBankDropdownSearch(bankDropdownSearch), 400)
    return () => clearTimeout(t)
  }, [bankDropdownSearch])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCoaDropdownSearch(coaDropdownSearch), 400)
    return () => clearTimeout(t)
  }, [coaDropdownSearch])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, typeFilter, startDate, endDate])

  // Fetch Cash Transactions
  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: [
      'cash-transactions',
      page,
      perPage,
      debouncedSearch,
      typeFilter,
      startDate,
      endDate,
    ],
    queryFn: () =>
      cashTransactionsService
        .list({
          page,
          per_page: perPage,
          // Allowed includes: created_by, updated_by, details (cash_transaction_query_request.go)
          include: 'details,created_by',
          sort: '-date,-id',
          // Allowed filters: transaction_number (exact match), type, date_from, date_to.
          'filter[transaction_number]': debouncedSearch.trim() || undefined,
          'filter[type]': typeFilter || undefined,
          'filter[date_from]': startDate || undefined,
          'filter[date_to]': endDate || undefined,
        } as any)
        .then((res) => res.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const transactions: CashTransaction[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  // Fetch Bank Accounts for selectors
  const { data: bankAccountsData } = useQuery({
    queryKey: ['bank-accounts-all-active', debouncedBankDropdownSearch],
    queryFn: () =>
      bankAccountsService
        .list({ per_page: 1000, 'filter[is_active]': 1, 'filter[search]': debouncedBankDropdownSearch || undefined } as any)
        .then((res) => res.data),
  })
  const bankAccounts: BankAccount[] = (bankAccountsData as any)?.data ?? []
  const bankAccountOptions = bankAccounts.map((b) => ({
    value: b.id,
    label: `${b.bank_name} - ${b.account_number} (${b.account_name})`,
  }))

  // Fetch Chart of Accounts for offsetting selection
  const { data: coaData } = useQuery({
    queryKey: ['chart-of-accounts-for-cash', debouncedCoaDropdownSearch],
    queryFn: () =>
      chartOfAccountsService
        .list({ per_page: 1000, sort: 'code', 'filter[is_active]': 'true', 'filter[is_header]': 'false', 'filter[search]': debouncedCoaDropdownSearch || undefined } as any)
        .then((res) => res.data),
  })
  const coaList: any[] = ((coaData as any)?.data ?? []).filter((c: any) => !c.is_header && c.is_active !== false)
  const coaOptions = coaList.map((item: any) => ({
    value: item.id,
    label: `${item.account_code ?? item.code} — ${item.account_name ?? item.name}`,
  }))

  // Form setup
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      transaction_date: todayStr,
      type: 'cash_in',
      amount: undefined as any,
      bank_account_id: undefined as any,
      chart_of_account_id: null,
      transfer_to_bank_account_id: null,
      description: '',
    },
  })

  const selectedType = watch('type')
  const selectedBankAccountId = watch('bank_account_id')

  const openCreate = () => {
    reset({
      transaction_date: todayStr,
      type: 'cash_in',
      amount: undefined as any,
      bank_account_id: bankAccounts[0]?.id ?? (undefined as any),
      chart_of_account_id: null,
      transfer_to_bank_account_id: null,
      description: '',
    })
    setSheetOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: (vals: CashTransactionRequest) => cashTransactionsService.create(vals),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
      toast.success('Cash transaction created successfully')
      setSheetOpen(false)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create cash transaction'),
  })

  const reverseMutation = useMutation({
    // The API takes no body for reverse (a reason would be discarded).
    mutationFn: ({ id }: { id: number }) => cashTransactionsService.reverse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
      toast.success('Transaction reversed successfully')
      setReverseConfirmItem(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to reverse transaction'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cashTransactionsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
      toast.success('Transaction deleted successfully')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete transaction'),
  })

  const onSubmit = (values: FormValues) => {
    const payload: CashTransactionRequest = {
      date: values.transaction_date,
      transaction_date: values.transaction_date,
      type: values.type,
      // Keep cents (round to 2 dp only to drop float noise).
      amount: Math.round(Number(values.amount) * 100) / 100,
      bank_account_id: values.bank_account_id ? Number(values.bank_account_id) : undefined,
      description: values.description?.trim() || undefined,
    }

    if (values.type === 'transfer') {
      payload.transfer_to_bank_account_id = values.transfer_to_bank_account_id
        ? Number(values.transfer_to_bank_account_id)
        : undefined
    } else {
      payload.chart_of_account_id = values.chart_of_account_id
        ? Number(values.chart_of_account_id)
        : undefined
    }

    createMutation.mutate(payload)
  }

  const isPending = createMutation.isPending

  // Styles
  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
    fontSize: 13,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface-raised, #ffffff)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--foreground)',
    marginBottom: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  }

  const errorStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--destructive)',
    marginTop: 4,
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1380, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 600,
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            Cash Transactions
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Record cash in, cash out, and inter-bank transfers with automated journal entries
          </p>
        </div>

        {canCreate && (
          <button
            onClick={openCreate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Plus size={15} />
            New Cash Transaction
          </button>
        )}
      </div>

      {/* Toolbar & Filters */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search transaction number..."
        activeCount={countActive(typeFilter, startDate, endDate)}
        onClear={() => {
          setTypeFilter('')
          setStartDate('')
          setEndDate('')
          setPage(1)
        }}
        quick={
          <>
            <FilterSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              <option value="cash_in">Cash In</option>
              <option value="cash_out">Cash Out</option>
              <option value="transfer">Transfer</option>
            </FilterSelect>
          </>
        }
      >
        <FilterGroup title="Dates">
          <FilterField label="Period">
            <FinancePeriodSelect
              start={startDate}
              end={endDate}
              onChange={(p) => { setStartDate(p.start_date); setEndDate(p.end_date) }}
              style={{ ...filterControlStyle, width: '100%' }}
            />
          </FilterField>
          <FilterField label="Transaction date">
            <DateRange from={startDate} to={endDate} onFromChange={setStartDate} onToChange={setEndDate} />
          </FilterField>
        </FilterGroup>
      </FilterBar>

      {/* Table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
                <th style={{ ...thStyle, width: 170 }}>Txn Number / Date</th>
                <th style={{ ...thStyle, width: 110 }}>Type</th>
                <th style={thStyle}>Accounts Flow</th>
                <th style={{ ...thStyle, textAlign: 'right', width: 150 }}>Amount</th>
                <th style={{ ...thStyle, width: 130 }}>Journal Entry</th>
                <th style={{ ...thStyle, width: 100, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} style={tdStyle}>
                        <div
                          style={{
                            height: 14,
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--border)',
                            width: j === 6 ? 60 : '75%',
                            animation: 'pulse 1.5s ease-in-out infinite',
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                    <span style={{ fontSize: 14, color: 'var(--destructive)' }}>
                      Failed to load cash transactions.
                    </span>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 10,
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      <ReceiptText size={32} style={{ opacity: 0.4 }} />
                      <span style={{ fontSize: 14 }}>No cash transactions found</span>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((item, idx) => {
                  const typeConf = TYPE_CONFIG[item.type] ?? {
                    label: item.type,
                    icon: ReceiptText,
                    bg: 'var(--background)',
                    color: 'var(--foreground)',
                  }
                  const Icon = typeConf.icon

                  return (
                    <tr
                      key={item.id}
                      style={{ transition: 'background 120ms' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: 'center',
                          color: 'var(--foreground-muted)',
                          fontSize: 13,
                        }}
                      >
                        {(page - 1) * perPage + idx + 1}
                      </td>

                      {/* Transaction Number & Date */}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontWeight: 600,
                                fontFamily: 'monospace',
                                color: 'var(--foreground)',
                                fontSize: 13,
                              }}
                            >
                              {item.transaction_number}
                            </span>
                            {item.is_reversed && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: '1px 6px',
                                  borderRadius: 99,
                                  background: 'var(--destructive-bg, #fef2f2)',
                                  color: 'var(--destructive, #ef4444)',
                                  border: '1px solid var(--destructive-border, #fecaca)',
                                }}
                              >
                                Reversed
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                            {formatDate(item.date || item.transaction_date)}
                          </span>
                          {item.description && (
                            <span
                              style={{
                                fontSize: 11,
                                color: 'var(--foreground-subtle)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 200,
                              }}
                            >
                              {item.description}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td style={tdStyle}>
                        <span
                          style={{
                            padding: '4px 9px',
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 600,
                            background: typeConf.bg,
                            color: typeConf.color,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Icon size={12} />
                          {typeConf.label}
                        </span>
                      </td>

                      {/* Accounts Flow */}
                      <td style={tdStyle}>
                        {item.type === 'transfer' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: 'var(--foreground-muted)', fontSize: 11 }}>From:</span>
                              <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>
                                {bankLabel(sourceBank(item))}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: 'var(--foreground-muted)', fontSize: 11 }}>To:</span>
                              <span style={{ fontWeight: 500, color: 'var(--accent)' }}>
                                {bankLabel(destinationBank(item))}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: 'var(--foreground-muted)', fontSize: 11 }}>Bank:</span>
                              <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>
                                {bankLabel(sourceBank(item))}
                              </span>
                            </div>
                          </div>
                        )}
                      </td>


                      {/* Amount */}
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          fontSize: 13,
                          color:
                            item.type === 'cash_in'
                              ? 'var(--success)'
                              : item.type === 'cash_out'
                              ? 'var(--destructive)'
                              : 'var(--foreground)',
                        }}
                      >
                        {item.type === 'cash_in' ? '+ ' : item.type === 'cash_out' ? '- ' : ''}
                        {formatCurrency(item.amount)}
                      </td>

                      {/* Journal Entry */}
                      <td style={tdStyle}>
                        {item.journal_id ? (
                          <span
                            style={{
                              fontSize: 12,
                              fontFamily: 'monospace',
                              color: 'var(--accent)',
                              background: 'var(--accent-light-bg)',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            Journal #{item.journal_id}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--foreground-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          <button
                            onClick={() => setViewItem(item)}
                            title="View Detail"
                            style={{
                              padding: 6,
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--foreground-muted)',
                            }}
                          >
                            <Eye size={15} />
                          </button>

                          {canReverse && (
                            <button
                              onClick={() => {
                                if (item.is_reversed) return
                                setReverseConfirmItem(item)
                              }}
                              disabled={item.is_reversed}
                              title={item.is_reversed ? 'Already Reversed' : 'Reverse / Void'}
                              style={{
                                padding: 6,
                                background: 'none',
                                border: 'none',
                                cursor: item.is_reversed ? 'not-allowed' : 'pointer',
                                color: item.is_reversed ? 'var(--foreground-muted)' : 'var(--warning)',
                                opacity: item.is_reversed ? 0.35 : 1,
                              }}
                            >
                              <RotateCcw size={15} />
                            </button>
                          )}

                          {canDelete && (() => {
                            const reason = cashTransactionDeleteBlock(item)
                            return (
                            <button
                              onClick={() => { if (!reason) setDeleteConfirmId(item.id) }}
                              disabled={!!reason}
                              title={reason ?? 'Delete'}
                              style={{
                                padding: 6,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--destructive)',
                                ...(reason ? blockedStyle : {}),
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                            )
                          })()}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <CustomPagination
        page={page}
        setPage={setPage}
        perPage={perPage}
        setPerPage={setPerPage}
        meta={meta}
      />

      {/* Create Transaction Side Sheet */}
      {sheetOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div
            onClick={() => setSheetOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 540,
              background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 60,
            }}
          >
            {/* Sheet Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 18,
                    fontWeight: 600,
                    margin: 0,
                    color: 'var(--foreground)',
                  }}
                >
                  New Cash Transaction
                </h2>
                <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
                  Transaction number and journal entries are generated automatically
                </p>
              </div>
              <button
                onClick={() => setSheetOpen(false)}
                style={{
                  padding: 6,
                  background: 'none',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  color: 'var(--foreground-muted)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Sheet Form */}
            <form
              onSubmit={handleSubmit(onSubmit)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                }}
              >
                {/* Transaction Type Tabs */}
                <div>
                  <label style={labelStyle}>
                    Transaction Type
                    <span style={{ color: 'var(--destructive)' }}>*</span>
                  </label>
                  <Controller
                    control={control}
                    name="type"
                    render={({ field }) => (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        {(['cash_in', 'cash_out', 'transfer'] as CashTransactionType[]).map((t) => {
                          const conf = TYPE_CONFIG[t]
                          const isSelected = field.value === t
                          const IconComp = conf.icon
                          return (
                            <button
                              type="button"
                              key={t}
                              onClick={() => {
                                field.onChange(t)
                                if (t === 'transfer') {
                                  setValue('chart_of_account_id', null)
                                } else {
                                  setValue('transfer_to_bank_account_id', null)
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                padding: '10px 12px',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: 'pointer',
                                background: isSelected
                                  ? conf.bg
                                  : 'var(--surface-raised, #ffffff)',
                                color: isSelected ? conf.color : 'var(--foreground-muted)',
                                border: isSelected
                                  ? `1px solid ${conf.color}`
                                  : '1px solid var(--border)',
                                transition: 'all 120ms',
                              }}
                            >
                              <IconComp size={15} />
                              {conf.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  />
                </div>

                {/* Date & Amount */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>
                      Date
                      <span style={{ color: 'var(--destructive)' }}>*</span>
                    </label>
                    <input type="date" {...register('transaction_date')} style={inputStyle} />
                    {errors.transaction_date && (
                      <div style={errorStyle}>{errors.transaction_date.message}</div>
                    )}
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Amount (Rp)
                      <span style={{ color: 'var(--destructive)' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={1}
                      placeholder="e.g. 500000"
                      {...register('amount', { valueAsNumber: true })}
                      style={inputStyle}
                    />
                    {errors.amount && <div style={errorStyle}>{errors.amount.message}</div>}
                  </div>
                </div>

                {/* Bank Account (Source or Main) */}
                <div>
                  <label style={labelStyle}>
                    {selectedType === 'transfer'
                      ? 'Source Bank Account (From)'
                      : selectedType === 'cash_in'
                      ? 'Deposit To Bank Account'
                      : 'Pay From Bank Account'}
                    <span style={{ color: 'var(--destructive)' }}>*</span>
                  </label>
                  <Controller
                    control={control}
                    name="bank_account_id"
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value ?? ''}
                        onChange={(val) => field.onChange(val ? Number(val) : undefined)}
                        options={bankAccountOptions}
                        placeholder="Select Bank Account"
                        searchPlaceholder="Search bank account..."
                        onSearchChange={setBankDropdownSearch}
                      />
                    )}
                  />
                  {errors.bank_account_id && (
                    <div style={errorStyle}>{errors.bank_account_id.message}</div>
                  )}
                </div>

                {/* Transfer Destination or Offsetting CoA */}
                {selectedType === 'transfer' ? (
                  <div>
                    <label style={labelStyle}>
                      Destination Bank Account (To)
                      <span style={{ color: 'var(--destructive)' }}>*</span>
                    </label>
                    <Controller
                      control={control}
                      name="transfer_to_bank_account_id"
                      render={({ field }) => (
                        <SearchableSelect
                          value={field.value ?? ''}
                          onChange={(val) => field.onChange(val ? Number(val) : null)}
                          options={bankAccountOptions.filter(
                            (opt) => opt.value !== selectedBankAccountId
                          )}
                          placeholder="Select Destination Bank Account"
                          searchPlaceholder="Search bank account..."
                          onSearchChange={setBankDropdownSearch}
                        />
                      )}
                    />
                    {errors.transfer_to_bank_account_id && (
                      <div style={errorStyle}>{errors.transfer_to_bank_account_id.message}</div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label style={labelStyle}>
                      Offsetting Chart of Account (Optional)
                    </label>
                    <span style={{ fontSize: 11, color: 'var(--foreground-muted)', marginBottom: 6, display: 'block' }}>
                      Leave empty to book against the outlet&apos;s petty cash
                    </span>
                    <Controller
                      control={control}
                      name="chart_of_account_id"
                      render={({ field }) => (
                        <SearchableSelect
                          value={field.value ?? ''}
                          onChange={(val) => field.onChange(val ? Number(val) : null)}
                          options={coaOptions}
                          placeholder="Petty cash (default)"
                          searchPlaceholder="Search COA..."
                          onSearchChange={setCoaDropdownSearch}
                        />
                      )}
                    />
                    {errors.chart_of_account_id && (
                      <div style={errorStyle}>{errors.chart_of_account_id.message}</div>
                    )}
                  </div>
                )}


                {/* Description */}
                <div>
                  <label style={labelStyle}>Description / Memo</label>
                  <textarea
                    rows={3}
                    {...register('description')}
                    placeholder="Enter transaction purpose or reference..."
                    style={{
                      ...inputStyle,
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              {/* Sheet Footer */}
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--foreground)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{
                    padding: '8px 18px',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'white',
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: isPending ? 0.75 : 1,
                  }}
                >
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  Submit Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Slideover Drawer */}
      {viewItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div
            onClick={() => setViewItem(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 460,
              background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 60,
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 18,
                  fontWeight: 600,
                  margin: 0,
                  color: 'var(--foreground)',
                }}
              >
                Cash Transaction Detail
              </h2>
              <button
                onClick={() => setViewItem(null)}
                style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} color="var(--foreground-muted)" />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Transaction Number', value: viewItem.transaction_number },
                { label: 'Transaction Date', value: formatDate(viewItem.date || viewItem.transaction_date) },
                { label: 'Status', value: viewItem.is_reversed ? 'Reversed / Void' : 'Active / Posted' },
                { label: 'Type', value: TYPE_CONFIG[viewItem.type]?.label || viewItem.type },
                { label: 'Amount', value: formatCurrency(viewItem.amount) },
                {
                  label: 'Primary Bank Account',
                  value: bankLong(sourceBank(viewItem)),
                },
                ...(viewItem.type === 'transfer'
                  ? [{ label: 'Destination Bank Account', value: bankLong(destinationBank(viewItem)) }]
                  : []),
                {
                  label: 'Journal Entry',
                  value: viewItem.journal_id ? `Journal #${viewItem.journal_id}` : '—',
                },
                { label: 'Description', value: viewItem.description || '—' },
                { label: 'Created By', value: viewItem.created_by?.name || '—' },
                {
                  label: 'Created At',
                  value: viewItem.created_at ? formatDateTime(viewItem.created_at) : '—',
                },
              ].map((f) => (
                <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--foreground-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                    }}
                  >
                    {f.label}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--foreground)' }}>{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reverse Confirmation Modal */}
      {reverseConfirmItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={() => setReverseConfirmItem(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 80,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px 28px',
              width: 420,
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 17,
                fontWeight: 600,
                margin: '0 0 8px',
                color: 'var(--foreground)',
              }}
            >
              Reverse Cash Transaction
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px' }}>
              Reversing transaction{' '}
              <strong style={{ color: 'var(--foreground)' }}>
                {reverseConfirmItem.transaction_number}
              </strong>{' '}
              will create offsetting reversal entries for both cash accounts and general ledger journals.
            </p>


            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setReverseConfirmItem(null)}
                style={{
                  padding: '7px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  reverseMutation.mutate({ id: reverseConfirmItem.id })
                }
                disabled={reverseMutation.isPending}
                style={{
                  padding: '7px 16px',
                  background: 'var(--warning)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'white',
                  cursor: 'pointer',
                  opacity: reverseMutation.isPending ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {reverseMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={() => setDeleteConfirmId(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 80,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px 28px',
              width: 380,
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 17,
                fontWeight: 600,
                margin: '0 0 8px',
                color: 'var(--foreground)',
              }}
            >
              Delete Cash Transaction
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px' }}>
              Are you sure you want to delete this cash transaction? This will permanently remove the transaction and all related journal entries. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  padding: '7px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                style={{
                  padding: '7px 16px',
                  background: 'var(--destructive)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'white',
                  cursor: 'pointer',
                  opacity: deleteMutation.isPending ? 0.7 : 1,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
