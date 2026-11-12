'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  bankAccountsService,
  BankAccount,
  BankAccountRequest,
  BankAccountType,
} from '@/services/bank-accounts.service'
import { chartOfAccountsService } from '@/services/accounting.service'
import { useAuth } from '@/hooks/useAuth'
import SearchableSelect from '@/components/SearchableSelect'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { ActiveSegment, FilterBar, FilterSelect, countActive } from '@/components/ListFilters'
import { formatCurrency } from '@/utils/price'
import { formatDateTime } from '@/utils/date'
import { toastMutationApiError } from '@/utils/apiError'
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  X,
  Loader2,
  Building2,
  Landmark,
} from 'lucide-react'

const schema = z.object({
  company_id: z.coerce.number().optional().default(1),
  chart_of_account_id: z.coerce.number().optional().nullable(),
  bank_name: z.string().min(1, 'Bank name is required'),
  account_number: z.string().min(1, 'Account number is required'),
  account_name: z.string().min(1, 'Account name is required'),
  account_type: z.enum(['checking', 'savings', 'deposit'], {
    message: 'Account type is required',
  }),
  opening_balance: z.coerce.number().default(0),
  swift_code: z.string().optional(),
  branch: z.string().optional(),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
})
type FormValues = z.infer<typeof schema>

const TYPE_META: Record<BankAccountType, { label: string; bg: string; color: string }> = {
  checking: { label: 'Checking', bg: 'var(--info-bg, #eff6ff)', color: 'var(--info, #2563eb)' },
  savings: { label: 'Savings', bg: 'var(--success-bg, #f0fdf4)', color: 'var(--success, #16a34a)' },
  deposit: { label: 'Deposit', bg: 'var(--warning-bg, #fffbeb)', color: 'var(--warning, #d97706)' },
}

export default function BankAccountsView() {
  const queryClient = useQueryClient()
  const { user, isSuperadmin, hasPermission } = useAuth()
  const userCompanyId =
    (user as any)?.branch?.company?.id ??
    (user as any)?.branch?.company_id ??
    (user as any)?.company_id ??
    (user as any)?.company?.id ??
    (user as any)?.branches?.[0]?.company_id ??
    (user as any)?.branches?.[0]?.company?.id ??
    1

  const userCompanyName =
    (user as any)?.branch?.company?.name ??
    (user as any)?.company?.name ??
    (user as any)?.branches?.[0]?.company?.name ??
    (user as any)?.branches?.[0]?.name ??
    'Active Company'

  const canRead = isSuperadmin || hasPermission('bank_account.read')
  const canCreate = isSuperadmin || hasPermission('bank_account.create')
  const canUpdate = isSuperadmin || hasPermission('bank_account.update')
  const canDelete = isSuperadmin || hasPermission('bank_account.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [activeFilter, setActiveFilter] = useState<string>('1')
  const [coaFilter, setCoaFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [coaDropdownSearch, setCoaDropdownSearch] = useState('')
  const [debouncedCoaDropdownSearch, setDebouncedCoaDropdownSearch] = useState('')

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editItem, setEditItem] = useState<BankAccount | null>(null)
  const [viewItem, setViewItem] = useState<BankAccount | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCoaDropdownSearch(coaDropdownSearch), 400)
    return () => clearTimeout(t)
  }, [coaDropdownSearch])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, typeFilter, activeFilter, coaFilter])

  // Fetch bank accounts
  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['bank-accounts', page, perPage, debouncedSearch, typeFilter, activeFilter, coaFilter],
    queryFn: () =>
      bankAccountsService
        .list({
          page,
          per_page: perPage,
          include: 'chart_of_account,created_by,updated_by',
          sort: '-created_at',
          'filter[search]': debouncedSearch || undefined,
          'filter[account_type]': typeFilter || undefined,
          'filter[is_active]': activeFilter !== '' ? activeFilter : undefined,
          'filter[chart_of_account_id]': coaFilter !== '' ? coaFilter : undefined,
        } as any)
        .then((res) => res.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const bankAccounts: BankAccount[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  // Fetch Chart of Accounts for dropdown
  const { data: coaData } = useQuery({
    queryKey: ['chart-of-accounts-select', debouncedCoaDropdownSearch],
    queryFn: () =>
      chartOfAccountsService
        .list({ per_page: 1000, sort: 'code', 'filter[search]': debouncedCoaDropdownSearch || undefined } as any)
        .then((res) => res.data),
  })
  const coaList: any[] = (coaData as any)?.data ?? []

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
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      company_id: userCompanyId,
      chart_of_account_id: undefined as any,
      bank_name: '',
      account_number: '',
      account_name: '',
      account_type: 'checking',
      opening_balance: 0,
      swift_code: '',
      branch: '',
      description: '',
      is_active: true,
    },
  })

  const openCreate = () => {
    setEditItem(null)
    reset({
      company_id: userCompanyId,
      chart_of_account_id: coaList[0]?.id ?? (undefined as any),
      bank_name: '',
      account_number: '',
      account_name: '',
      account_type: 'checking',
      opening_balance: 0,
      swift_code: '',
      branch: '',
      description: '',
      is_active: true,
    })
    setSheetOpen(true)
  }

  const openEdit = (item: BankAccount) => {
    setEditItem(item)
    reset({
      company_id: item.company_id ?? userCompanyId,
      chart_of_account_id: item.chart_of_account_id,
      bank_name: item.bank_name,
      account_number: item.account_number,
      account_name: item.account_name,
      account_type: item.account_type,
      opening_balance: item.opening_balance ?? 0,
      swift_code: item.swift_code ?? '',
      branch: item.branch ?? item.branch_name ?? '',
      description: item.description ?? '',
      is_active: item.is_active,
    })
    setSheetOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: (vals: BankAccountRequest) => bankAccountsService.create(vals),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
      queryClient.invalidateQueries({ queryKey: ['payment-methods-all'] })
      toast.success('Bank account created successfully')
      setSheetOpen(false)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create bank account'),
  })

  const updateMutation = useMutation({
    mutationFn: (vals: Partial<BankAccountRequest>) =>
      bankAccountsService.update(editItem!.id, vals),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
      queryClient.invalidateQueries({ queryKey: ['payment-methods-all'] })
      toast.success('Bank account updated successfully')
      setSheetOpen(false)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update bank account'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => bankAccountsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
      queryClient.invalidateQueries({ queryKey: ['payment-methods-all'] })
      toast.success('Bank account deleted successfully')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? ''
      if (
        /bank account payment method has payments/i.test(msg) ||
        /bank account has transactions/i.test(msg)
      ) {
        toast.error(
          'This bank account cannot be deleted because it has existing payment records. Void or delete the related payments first.'
        )
        return
      }
      toastMutationApiError(err, 'Failed to delete bank account')
    },
  })

  const onSubmit = (values: FormValues) => {
    if (editItem) {
      // UpdateBankAccountRequest in OpenAPI does not take company_id
      const payload: Partial<BankAccountRequest> = {
        chart_of_account_id: values.chart_of_account_id ? Number(values.chart_of_account_id) : undefined,
        bank_name: values.bank_name.trim(),
        account_number: values.account_number.trim(),
        account_name: values.account_name.trim(),
        account_type: values.account_type,
        opening_balance: values.opening_balance ?? 0,
        swift_code: values.swift_code?.trim() || undefined,
        branch: values.branch?.trim() || undefined,
        branch_name: values.branch?.trim() || undefined,
        description: values.description?.trim() || undefined,
        is_active: values.is_active,
      }
      updateMutation.mutate(payload)
    } else {
      // CreateBankAccountRequest requires company_id, bank_name, account_number, account_name, account_type
      const payload: BankAccountRequest = {
        company_id: Number(values.company_id || userCompanyId),
        chart_of_account_id: values.chart_of_account_id ? Number(values.chart_of_account_id) : undefined,
        bank_name: values.bank_name.trim(),
        account_number: values.account_number.trim(),
        account_name: values.account_name.trim(),
        account_type: values.account_type,
        opening_balance: values.opening_balance ?? 0,
        swift_code: values.swift_code?.trim() || undefined,
        branch: values.branch?.trim() || undefined,
        branch_name: values.branch?.trim() || undefined,
        description: values.description?.trim() || undefined,
        is_active: values.is_active,
      }
      createMutation.mutate(payload)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

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
    <div style={{ padding: '32px 32px 64px', maxWidth: 1340, margin: '0 auto' }}>
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
            Bank Accounts
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Manage corporate bank accounts, cash accounts, and linked chart of accounts
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
            New Bank Account
          </button>
        )}
      </div>

      {/* Toolbar & Filters */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search bank, account number..."
        activeCount={countActive(typeFilter, activeFilter !== '1', coaFilter)}
        onClear={() => {
          setTypeFilter('')
          setActiveFilter('1')
          setCoaFilter('')
          setPage(1)
        }}
        quick={
          <>
            <ActiveSegment value={activeFilter} onChange={setActiveFilter} active="1" inactive="0" label="Bank account status" />
            <FilterSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All Account Types</option>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="deposit">Deposit</option>
            </FilterSelect>
            <div style={{ minWidth: 220 }}>
              <SearchableSelect
                value={coaFilter !== '' ? Number(coaFilter) : ''}
                onChange={(val) => setCoaFilter(val !== '' && val != null ? String(val) : '')}
                options={[
                  { value: '', label: 'All Chart of Accounts' },
                  ...coaList.map((item: any) => ({
                    value: item.id,
                    label: `${item.account_code ?? item.code} — ${item.account_name ?? item.name}`,
                  })),
                ]}
                placeholder="All Chart of Accounts"
                searchPlaceholder="Search COA..."
                triggerStyle={{ height: 36, padding: '0 10px', fontSize: 13 }}
                onSearchChange={setCoaDropdownSearch}
              />
            </div>
          </>
        }
      />

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
                <th style={{ ...thStyle, width: 180 }}>Bank / Branch</th>
                <th style={{ ...thStyle, width: 200 }}>Account Info</th>
                <th style={{ ...thStyle, width: 110 }}>Type</th>
                <th style={thStyle}>Linked CoA</th>
                <th style={{ ...thStyle, textAlign: 'right', width: 140 }}>Opening Balance</th>
                <th style={{ ...thStyle, textAlign: 'right', width: 140 }}>Current Balance</th>
                <th style={{ ...thStyle, width: 100, textAlign: 'center' }}>Status</th>
                <th style={{ ...thStyle, width: 100, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} style={tdStyle}>
                        <div
                          style={{
                            height: 14,
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--border)',
                            width: j === 8 ? 60 : '75%',
                            animation: 'pulse 1.5s ease-in-out infinite',
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                    <span style={{ fontSize: 14, color: 'var(--destructive)' }}>
                      Failed to load bank accounts.
                    </span>
                  </td>
                </tr>
              ) : bankAccounts.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 10,
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      <Landmark size={32} style={{ opacity: 0.4 }} />
                      <span style={{ fontSize: 14 }}>No bank accounts found</span>
                    </div>
                  </td>
                </tr>
              ) : (
                bankAccounts.map((item, idx) => {
                  const typeMeta = TYPE_META[item.account_type] ?? {
                    label: item.account_type,
                    bg: 'var(--background)',
                    color: 'var(--foreground-muted)',
                  }

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

                      {/* Bank & Branch */}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                            {item.bank_name}
                          </span>
                          {item.branch && (
                            <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                              {item.branch}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Account Number & Name */}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span
                            style={{
                              fontWeight: 600,
                              fontFamily: 'monospace',
                              letterSpacing: '0.04em',
                              color: 'var(--foreground)',
                            }}
                          >
                            {item.account_number}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                            {item.account_name}
                          </span>
                          {item.swift_code && (
                            <span style={{ fontSize: 10, color: 'var(--foreground-subtle)' }}>
                              SWIFT: {item.swift_code}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Account Type */}
                      <td style={tdStyle}>
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 600,
                            background: typeMeta.bg,
                            color: typeMeta.color,
                            display: 'inline-block',
                          }}
                        >
                          {typeMeta.label}
                        </span>
                      </td>

                      {/* Linked CoA */}
                      <td style={tdStyle}>
                        {item.chart_of_account ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)' }}>
                              <span style={{ fontFamily: 'monospace', color: 'var(--accent)', marginRight: 6 }}>
                                [{item.chart_of_account.code}]
                              </span>
                              {item.chart_of_account.name}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--foreground-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Opening Balance */}
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                        {formatCurrency(item.opening_balance ?? 0)}
                      </td>

                      {/* Current Balance */}
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          color:
                            item.current_balance >= 0
                              ? 'var(--foreground)'
                              : 'var(--destructive)',
                        }}
                      >
                        {formatCurrency(item.current_balance ?? 0)}
                      </td>

                      {/* Status */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '3px 9px',
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 600,
                            background: item.is_active
                              ? 'var(--success-bg, #f0fdf4)'
                              : 'var(--background)',
                            color: item.is_active
                              ? 'var(--success, #16a34a)'
                              : 'var(--foreground-muted)',
                            border: item.is_active ? 'none' : '1px solid var(--border)',
                          }}
                        >
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
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
                          {canUpdate && (
                            <button
                              onClick={() => openEdit(item)}
                              title="Edit"
                              style={{
                                padding: 6,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--foreground-muted)',
                              }}
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteConfirmId(item.id)}
                              title="Delete"
                              style={{
                                padding: 6,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--destructive)',
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
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

      {/* Create / Edit Side Sheet */}
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
              width: 520,
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
                  {editItem ? 'Edit Bank Account' : 'New Bank Account'}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
                  {editItem ? 'Update account parameters' : 'Register a new bank account'}
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
                {/* Company (Auto-detected from /auth/me) */}
                <div>
                  <label style={labelStyle}>Company</label>
                  <div
                    style={{
                      ...inputStyle,
                      background: 'var(--background)',
                      color: 'var(--foreground-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'default',
                    }}
                  >
                    <Building2 size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>
                      {userCompanyName}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 4, display: 'block' }}>
                    Auto-selected from your active session (/auth/me)
                  </span>
                </div>

                {/* Bank Name */}
                <div>
                  <label style={labelStyle}>
                    Bank Name
                    <span style={{ color: 'var(--destructive)' }}>*</span>
                  </label>
                  <input
                    {...register('bank_name')}
                    placeholder="e.g. Bank Central Asia (BCA)"
                    style={inputStyle}
                  />
                  {errors.bank_name && <div style={errorStyle}>{errors.bank_name.message}</div>}
                </div>

                {/* Account Number & Account Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>
                      Account Number
                      <span style={{ color: 'var(--destructive)' }}>*</span>
                    </label>
                    <input
                      {...register('account_number')}
                      placeholder="e.g. 1234567890"
                      style={inputStyle}
                    />
                    {errors.account_number && (
                      <div style={errorStyle}>{errors.account_number.message}</div>
                    )}
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Account Name
                      <span style={{ color: 'var(--destructive)' }}>*</span>
                    </label>
                    <input
                      {...register('account_name')}
                      placeholder="e.g. PT Dapur Cokelat"
                      style={inputStyle}
                    />
                    {errors.account_name && (
                      <div style={errorStyle}>{errors.account_name.message}</div>
                    )}
                  </div>
                </div>

                {/* Account Type */}
                <div>
                  <label style={labelStyle}>
                    Account Type
                    <span style={{ color: 'var(--destructive)' }}>*</span>
                  </label>
                  <select {...register('account_type')} style={inputStyle}>
                    <option value="checking">Checking (Giro)</option>
                    <option value="savings">Savings (Tabungan)</option>
                    <option value="deposit">Deposit (Deposito)</option>
                  </select>
                </div>

                {/* Linked Chart of Account */}
                <div>
                  <label style={labelStyle}>
                    Linked Chart of Account
                    <span style={{ color: 'var(--destructive)' }}>*</span>
                  </label>
                  <Controller
                    control={control}
                    name="chart_of_account_id"
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value ?? ''}
                        onChange={(val) => field.onChange(val ? Number(val) : undefined)}
                        options={coaOptions}
                        placeholder="Select Chart of Account (Cash / Bank account)"
                        searchPlaceholder="Search COA..."
                        onSearchChange={setCoaDropdownSearch}
                      />
                    )}
                  />
                  {errors.chart_of_account_id && (
                    <div style={errorStyle}>{errors.chart_of_account_id.message}</div>
                  )}
                </div>

                {/* Opening Balance */}
                <div>
                  <label style={labelStyle}>Opening Balance (Rp)</label>
                  <input
                    type="number"
                    step="any"
                    {...register('opening_balance', { valueAsNumber: true })}
                    placeholder="0"
                    style={inputStyle}
                  />
                  <span style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 4, display: 'block' }}>
                    Initial balance when starting ledger integration
                  </span>
                </div>

                {/* Branch & SWIFT Code */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Branch Office</label>
                    <input
                      {...register('branch')}
                      placeholder="e.g. KCU Sudirman"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>SWIFT Code</label>
                    <input
                      {...register('swift_code')}
                      placeholder="e.g. CENAIDJA"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={labelStyle}>Description (Optional)</label>
                  <textarea
                    {...register('description')}
                    placeholder="e.g. Operational checking account for daily expenses"
                    rows={2}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>

                {/* Is Active toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <input
                    type="checkbox"
                    id="is_active_bank"
                    {...register('is_active')}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label
                    htmlFor="is_active_bank"
                    style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}
                  >
                    Active Account
                  </label>
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
                  {editItem ? 'Save Changes' : 'Create Bank Account'}
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
              width: 440,
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
                Bank Account Detail
              </h2>
              <button
                onClick={() => setViewItem(null)}
                style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} color="var(--foreground-muted)" />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(() => {
                return [
                  { label: 'Bank Name', value: viewItem.bank_name },
                  { label: 'Account Number', value: viewItem.account_number },
                  { label: 'Account Name', value: viewItem.account_name },
                  { label: 'Account Type', value: viewItem.account_type?.toUpperCase() },
                  {
                    label: 'Linked CoA',
                    value: viewItem.chart_of_account
                      ? `[${viewItem.chart_of_account.code}] ${viewItem.chart_of_account.name}`
                      : '—',
                  },
                  { label: 'Branch', value: viewItem.branch || '—' },
                  { label: 'SWIFT Code', value: viewItem.swift_code || '—' },
                  {
                    label: 'Opening Balance',
                    value: formatCurrency(viewItem.opening_balance ?? 0),
                  },
                  {
                    label: 'Current Balance',
                    value: formatCurrency(viewItem.current_balance ?? 0),
                  },
                  { label: 'Status', value: viewItem.is_active ? 'Active' : 'Inactive' },
                  { label: 'Created By', value: viewItem.created_by?.name || '—' },
                  {
                    label: 'Created At',
                    value: viewItem.created_at ? formatDateTime(viewItem.created_at) : '—',
                  },
                  {
                    label: 'Updated At',
                    value: viewItem.updated_at ? formatDateTime(viewItem.updated_at) : '—',
                  },
                ]
              })().map((f) => (
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
              Delete Bank Account
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px' }}>
              Are you sure you want to delete this bank account? This action cannot be undone.
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
