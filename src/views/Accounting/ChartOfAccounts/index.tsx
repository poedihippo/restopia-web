'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  chartOfAccountsService, accountCategoriesService, accountTypesService,
  type ChartOfAccountRequest,
} from '@/services/accounting.service'
import { reportsService } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import { formatCurrency } from '@/utils/price'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import SearchableSelect from '@/components/SearchableSelect'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight,
  X, Loader2, BookOpen, CheckCircle2, XCircle, GitBranch, Download,
} from 'lucide-react'

interface CoA {
  id: number
  code: string
  name: string
  description?: string
  is_active: boolean
  is_header: boolean
  normal_balance: 'debit' | 'credit'
  balance?: number
  parent_id?: number | null
  account_category_id: number
  account_type_id: number
  use_as_payment_method?: boolean
  account_category?: { id: number; name: string; code: string }
  account_type?: { id: number; name: string; code: string; account_category?: { id: number; name: string; code: string } }
  created_at?: string
}

interface AccountCategory { id: number; code: string; name: string; normal_balance: 'debit' | 'credit' }
interface AccountType { id: number; code: string; name: string; account_category_id: number }

const schema = z.object({
  account_category_id: z.coerce.number().min(1, 'Category is required'),
  account_type_id: z.coerce.number().min(1, 'Type is required'),
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  is_active: z.boolean(),
  is_header: z.boolean(),
  normal_balance: z.enum(['debit', 'credit']),
  parent_id: z.coerce.number().nullable().optional(),
  use_as_payment_method: z.boolean(),
})
type FormValues = z.infer<typeof schema>

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', fontSize: 14, color: 'var(--foreground)',
  background: 'var(--surface-raised)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
}
const inputError: React.CSSProperties = { ...inputStyle, border: '1px solid var(--destructive)' }
const thStyle: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600,
  color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }

export default function ChartOfAccountsView() {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const queryClient = useQueryClient()
  const { isSuperadmin, hasPermission } = useAuth()
  const canCreate = isSuperadmin || hasPermission('chart-of-account.create')
  const canUpdate = isSuperadmin || hasPermission('chart-of-account.update')
  const canDelete = isSuperadmin || hasPermission('chart-of-account.delete')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(1000)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<CoA | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(0)
  const [filterType, setFilterType] = useState<string>('')
  const [filterParent, setFilterParent] = useState<string>('')

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 400); return () => clearTimeout(t) }, [search])
  useEffect(() => { setPage(1) }, [debouncedSearch])

  const { data, isLoading } = useQuery({
    queryKey: ['chart-of-accounts', page, perPage, debouncedSearch, filterType, filterParent],
    queryFn: () => chartOfAccountsService.list({ page, per_page: perPage, sort: 'code', include: 'account_category,account_type', 'filter[search]': debouncedSearch || undefined, 'filter[account_type_id]': filterType || undefined, 'filter[parent_id]': filterParent || undefined }).then((r) => r.data),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['account-categories-all', debouncedDropdownSearch],
    queryFn: () => accountCategoriesService.list({ 'filter[search]': debouncedDropdownSearch || undefined,  per_page: 1000, sort: 'code' }).then((r) => r.data),
  })
  const { data: typesData } = useQuery({
    queryKey: ['account-types-all', debouncedDropdownSearch],
    queryFn: () => accountTypesService.list({ 'filter[search]': debouncedDropdownSearch || undefined,  per_page: 1000, sort: 'code'  }).then((r) => r.data),
  })

  const items: CoA[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta
  const categories: AccountCategory[] = (categoriesData as any)?.data ?? []
  const allTypes: AccountType[] = (typesData as any)?.data ?? []
  const filteredTypes = selectedCategoryId ? allTypes.filter((t) => t.account_category_id === selectedCategoryId) : allTypes

  const deleteMutation = useMutation({
    mutationFn: (id: number) => chartOfAccountsService.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] }); toast.success('Account deleted'); setDeleteConfirmId(null) },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const { register, handleSubmit, reset, watch, setValue, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { account_category_id: 0, account_type_id: 0, code: '', name: '', description: '', is_active: true, is_header: false, normal_balance: 'debit', parent_id: null, use_as_payment_method: false },
  })

  const watchedCategoryId = watch('account_category_id')
  const typesForSheet = watchedCategoryId ? allTypes.filter((t) => t.account_category_id === Number(watchedCategoryId)) : allTypes

  useEffect(() => {
    if (editData) {
      setSelectedCategoryId(editData.account_category_id)
      reset({ account_category_id: editData.account_category_id, account_type_id: editData.account_type_id, code: editData.code, name: editData.name, description: editData.description ?? '', is_active: editData.is_active, is_header: editData.is_header, normal_balance: editData.normal_balance, parent_id: editData.parent_id ?? null, use_as_payment_method: editData.use_as_payment_method ?? false })
    } else {
      setSelectedCategoryId(0)
      reset({ account_category_id: 0, account_type_id: 0, code: '', name: '', description: '', is_active: true, is_header: false, normal_balance: 'debit', parent_id: null, use_as_payment_method: false })
    }
  }, [editData, reset])

  useEffect(() => { 
    setValue('account_type_id', 0) 
    if (watchedCategoryId && !editData) {
      const cat = categories.find(c => c.id === Number(watchedCategoryId))
      if (cat) setValue('normal_balance', cat.normal_balance)
    }
  }, [watchedCategoryId, setValue, categories, editData])

  const createMutation = useMutation({
    mutationFn: (data: ChartOfAccountRequest) => chartOfAccountsService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] }); toast.success('Account created'); setSheetOpen(false) },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: ChartOfAccountRequest) => chartOfAccountsService.update(editData!.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] }); toast.success('Account updated'); setSheetOpen(false) },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const onSubmit = (values: FormValues) => {

    const payload: ChartOfAccountRequest = { ...values, parent_id: values.parent_id || null, use_as_payment_method: !!values.use_as_payment_method }
    if (editData) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  const { mutate: exportExcel, isPending: isExporting } = useMutation({
    mutationFn: () => reportsService.exportChartOfAccounts(),
    onSuccess: (res) => { downloadFileFromResponse(res, 'chart-of-accounts.xlsx') },
    onError: () => toast.error('Gagal mengekspor data.'),
  })

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Chart of Accounts (Chart of Accounts)</h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Complete list of accounts used in the bookkeeping system</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => exportExcel()} disabled={isExporting} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: isExporting ? 'not-allowed' : 'pointer', opacity: isExporting ? 0.6 : 1 }}>
            <Download size={14} /> {isExporting ? 'Exporting...' : 'Export Excel'}
          </button>
          {canCreate && (
            <button onClick={() => { setEditData(null); setSheetOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <Plus size={16} /> New Account
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', width: 320 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search account code or name..."
            style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--foreground)', background: 'var(--surface-raised)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }} />
        </div>
        <div style={{ minWidth: 200 }}>
          <SearchableSelect
            value={filterType !== '' ? Number(filterType) : ''}
            onChange={(val) => setFilterType(val !== '' && val != null ? String(val) : '')}
            options={[
              { value: '', label: 'All Types' },
              ...allTypes.map(t => ({ value: t.id, label: t.name })),
            ]}
            placeholder="All Types"
            searchPlaceholder="Search type..."
            onSearchChange={setDropdownSearch}
          />
        </div>
        <div style={{ minWidth: 200 }}>
          <SearchableSelect
            value={filterParent !== '' ? Number(filterParent) : ''}
            onChange={(val) => setFilterParent(val !== '' && val != null ? String(val) : '')}
            options={[
              { value: '', label: 'All Parents' },
              ...items.filter(i => i.is_header).map(a => ({ value: a.id, label: `${a.code} – ${a.name}` })),
            ]}
            placeholder="All Parents"
            searchPlaceholder="Search parent..."
            onSearchChange={setDropdownSearch}
          />
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={{ ...thStyle, width: 120 }}>Code</th>
              <th style={thStyle}>Account Name</th>
              <th style={{ ...thStyle, width: 140, textAlign: 'right' }}>Balance</th>
              <th style={{ ...thStyle, width: 160 }}>Category</th>
              <th style={{ ...thStyle, width: 140 }}>Type</th>
              <th style={{ ...thStyle, width: 110 }}>Normal Balance</th>
              <th style={{ ...thStyle, width: 80 }}>Status</th>
               <th style={{ ...thStyle, width: 70 }}>Header</th>
               <th style={{ ...thStyle, width: 100 }}>Payment</th>
               <th style={{ ...thStyle, width: 100 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 11 }).map((__, j) => (
                  <td key={j} style={tdStyle}><div style={{ height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--border)', width: j === 10 ? 40 : '80%', animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                ))}</tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={11} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--foreground-muted)' }}>
                  <BookOpen size={32} style={{ opacity: 0.4 }} />
                  <span style={{ fontSize: 14 }}>No accounts found</span>
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
                  <td style={tdStyle}>
                    {/* nowrap: kode akun harus satu baris (11-01-000), jangan pecah di tanda "-" */}
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--background)', border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', color: 'var(--foreground-muted)' }}>{item.code}</span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.is_header && <GitBranch size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                      <span style={{ fontSize: 13, fontWeight: item.is_header ? 600 : 400, color: 'var(--foreground)' }}>{item.name}</span>
                    </div>
                    {item.description && <span style={{ fontSize: 12, color: 'var(--foreground-muted)', display: 'block', marginTop: 2 }}>{item.description}</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                      {item.balance !== undefined && item.balance !== null
                        ? formatCurrency(Number(item.balance))
                        : '—'}
                    </span>
                  </td>
                  <td style={tdStyle}><span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{item.account_type?.account_category?.name || '—'}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{item.account_type?.name || '—'}</span></td>
                  <td style={tdStyle}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 500, background: item.normal_balance === 'debit' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)', color: item.normal_balance === 'debit' ? '#3b82f6' : '#10b981' }}>
                      {item.normal_balance === 'debit' ? 'Debit' : 'Credit'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {item.is_active
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#10b981' }}><CheckCircle2 size={13} /> Active</span>
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--foreground-muted)' }}><XCircle size={13} /> Inactive</span>
                    }
                  </td>
                  <td style={tdStyle}><span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{item.is_header ? 'Ya' : '—'}</span></td>
                  <td style={tdStyle}>
                    {item.use_as_payment_method ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'var(--accent-light-bg)', color: 'var(--accent)' }}>
                        Payment Method
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>—</span>
                    )}
                  </td>
                  {/* Aksi: jarak kanan lebih lega supaya tidak menempel di tepi tabel */}
                  <td style={{ ...tdStyle, paddingLeft: 8, paddingRight: 24 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                      {canUpdate && <button onClick={() => { setEditData(item); setSheetOpen(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--foreground-muted)', display: 'flex' }}><Pencil size={14} /></button>}
                      {canDelete && <button onClick={() => setDeleteConfirmId(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--destructive)', display: 'flex' }}><Trash2 size={14} /></button>}
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
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>Delete Account</h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>This action cannot be undone and may affect existing journals.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ padding: '7px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending} style={{ padding: '7px 16px', background: 'var(--destructive)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', opacity: deleteMutation.isPending ? 0.7 : 1 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {sheetOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSheetOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
          <div style={{ position: 'relative', zIndex: 50, width: 500, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>{editData ? 'Edit Account' : 'New Account'}</h2>
              <button onClick={() => setSheetOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} color="var(--foreground-muted)" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Account Categories <span style={{ color: 'var(--destructive)' }}>*</span></label>
                  <Controller
                    control={control}
                    name="account_category_id"
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value ? Number(field.value) : 0}
                        onChange={(val) => {
                          const numVal = Number(val) || 0
                          field.onChange(numVal)
                          setSelectedCategoryId(numVal)
                          setValue('account_type_id', 0)
                          if (numVal && !editData) {
                            const cat = categories.find((c) => c.id === numVal)
                            if (cat) setValue('normal_balance', cat.normal_balance)
                          }
                        }}
                        options={categories.map((c) => ({
                          value: c.id,
                          label: `${c.code} – ${c.name}`,
                        }))}
                        placeholder="-- Select --"
                        searchPlaceholder="Search category..."
                        error={errors.account_category_id?.message}
                        onSearchChange={setDropdownSearch}
/>
                    )}
                  />
                  {errors.account_category_id && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.account_category_id.message}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Account Types <span style={{ color: 'var(--destructive)' }}>*</span></label>
                  <Controller
                    control={control}
                    name="account_type_id"
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value ? Number(field.value) : 0}
                        onChange={(val) => field.onChange(Number(val) || 0)}
                        options={typesForSheet.map((t) => ({
                          value: t.id,
                          label: `${t.code} – ${t.name}`,
                        }))}
                        placeholder="-- Select --"
                        searchPlaceholder="Search type..."
                        error={errors.account_type_id?.message}
                        onSearchChange={setDropdownSearch}
/>
                    )}
                  />
                  {errors.account_type_id && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.account_type_id.message}</span>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Account Code <span style={{ color: 'var(--destructive)' }}>*</span></label>
                  <input {...register('code')} placeholder="e.g. 1101" style={errors.code ? inputError : inputStyle} />
                  {errors.code && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.code.message}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Normal Balance <span style={{ color: 'var(--destructive)' }}>*</span></label>
                  <select {...register('normal_balance')} style={{ ...inputStyle, opacity: 0.7, pointerEvents: 'none' }} tabIndex={-1}>
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Account Name <span style={{ color: 'var(--destructive)' }}>*</span></label>
                <input {...register('name')} placeholder="e.g. Kas dan Bank" style={errors.name ? inputError : inputStyle} />
                {errors.name && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.name.message}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Description</label>
                <textarea {...register('description')} rows={2} placeholder="Description opsional" style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Parent Account</label>
                  <Controller
                    control={control}
                    name="parent_id"
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value ? Number(field.value) : ''}
                        onChange={(val) => field.onChange(val ? Number(val) : null)}
                        options={[
                          { value: '', label: '-- Tidak ada --' },
                          ...items
                            .filter((i) => i.is_header && i.id !== editData?.id)
                            .map((a) => ({
                              value: a.id,
                              label: `${a.code} – ${a.name}`,
                            })),
                        ]}
                        placeholder="-- Tidak ada --"
                        searchPlaceholder="Search parent account..."
                        onSearchChange={setDropdownSearch}
/>
                    )}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" {...register('is_active')} style={{ width: 15, height: 15 }} />
                  <span>Active Account</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" {...register('is_header')} style={{ width: 15, height: 15 }} />
                  <span>Header Account (Group)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" {...register('use_as_payment_method')} style={{ width: 15, height: 15 }} />
                  <span>Use as Payment Method</span>
                </label>
              </div>
            </form>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSheetOpen(false)} style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={isPending} onClick={handleSubmit(onSubmit)} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: isPending ? 0.7 : 1 }}>
                {isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                {editData ? 'Save' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
