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
import {
  Plus, Search, Pencil, Trash2, ChevronRight, ChevronDown,
  X, Loader2, BookOpen, XCircle, Download, Folder, FolderOpen, FileText,
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
// Tree view: width of one indent level (guide-line column)
const INDENT = 22
const LINE = 'var(--border-strong)'
// one height for every control in the filter toolbar
const TOOLBAR_H = 36
const toolbarSelectStyle: React.CSSProperties = { height: TOOLBAR_H, padding: '0 10px', fontSize: 13 }

interface TreeNode {
  key: string
  kind: 'category' | 'type' | 'account'
  code: string
  label: string
  item?: CoA
  normalBalance: 'debit' | 'credit'
  children: TreeNode[]
  // own balance + all descendants (roll-up, like a ledger tree)
  total: number
}

interface TreeRow {
  node: TreeNode
  depth: number
  isLast: boolean
  // for each ancestor level: does a vertical guide continue past this row?
  guides: boolean[]
}

// API balance is signed debit − credit: positive = Dr, negative = Cr (zero shows the normal side)
const balanceLabel = (amount: number, normal: 'debit' | 'credit') => {
  const side = amount > 0 ? 'Dr' : amount < 0 ? 'Cr' : normal === 'debit' ? 'Dr' : 'Cr'
  return `${formatCurrency(Math.abs(amount))} ${side}`
}

const highlight = (text: string, q: string) => {
  if (!q) return text
  const idx = text.toLowerCase().indexOf(q)
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--accent-light-bg)', color: 'var(--accent)', borderRadius: 2, padding: '0 1px' }}>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [childParent, setChildParent] = useState<CoA | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<CoA | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [filterType, setFilterType] = useState<string>('')
  const [filterParent, setFilterParent] = useState<string>('')

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 400); return () => clearTimeout(t) }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['chart-of-accounts', filterType, filterParent],
    queryFn: async () => {
      const params = { per_page: 2000, sort: 'code', include: 'account_category,account_type', 'filter[account_type_id]': filterType || undefined, 'filter[parent_id]': filterParent || undefined }
      const first: any = await chartOfAccountsService.list(params).then((r) => r.data)
      // Backend caps per_page (currently 1000) — fetch the remaining pages so the tree is complete
      const lastPage = Number(first?.meta?.total_pages ?? first?.meta?.last_page ?? 1)
      if (lastPage <= 1) return first
      const rest: any[] = await Promise.all(
        Array.from({ length: lastPage - 1 }, (_, i) => chartOfAccountsService.list({ ...params, page: i + 2 }).then((r) => r.data)),
      )
      return { ...first, data: [...(first?.data ?? []), ...rest.flatMap((r) => r?.data ?? [])] }
    },
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['account-categories-all', debouncedDropdownSearch],
    queryFn: () => accountCategoriesService.list({ 'filter[search]': debouncedDropdownSearch || undefined,  per_page: 1000, sort: 'code' }).then((r) => r.data),
  })
  const { data: typesData } = useQuery({
    queryKey: ['account-types-all', debouncedDropdownSearch],
    queryFn: () => accountTypesService.list({ 'filter[search]': debouncedDropdownSearch || undefined,  per_page: 1000, sort: 'code'  }).then((r) => r.data),
  })

  const items: CoA[] = React.useMemo(() => (data as any)?.data ?? [], [data])

  // Tree: Account Category → Account Type → Account (→ child accounts via parent_id).
  // Accounts whose parent is missing from the result sit directly under their type.
  const { roots, groupKeys } = React.useMemo(() => {
    const ids = new Set(items.map((i) => i.id))
    const childMap = new Map<number, CoA[]>()
    const rootAccounts: CoA[] = []
    for (const item of items) {
      if (item.parent_id && ids.has(item.parent_id) && item.parent_id !== item.id) {
        const list = childMap.get(item.parent_id) ?? []
        list.push(item)
        childMap.set(item.parent_id, list)
      } else {
        rootAccounts.push(item)
      }
    }
    const buildAccount = (item: CoA, depth: number): TreeNode => {
      const children = depth < 50 ? (childMap.get(item.id) ?? []).map((c) => buildAccount(c, depth + 1)) : []
      return {
        key: `acc-${item.id}`, kind: 'account', code: item.code, label: item.name, item, normalBalance: item.normal_balance, children,
        total: Number(item.balance ?? 0) + children.reduce((n, c) => n + c.total, 0),
      }
    }
    const catMap = new Map<string, TreeNode>()
    const typeMap = new Map<string, TreeNode>()
    for (const acc of rootAccounts) {
      const cat = acc.account_type?.account_category ?? acc.account_category
      const catKey = `cat-${cat?.id ?? 'none'}`
      if (!catMap.has(catKey)) {
        catMap.set(catKey, { key: catKey, kind: 'category', code: cat?.code ?? '', label: cat?.name ?? 'Uncategorized', normalBalance: (cat as any)?.normal_balance ?? acc.normal_balance, children: [], total: 0 })
      }
      const catNode = catMap.get(catKey)!
      const typeKey = `type-${acc.account_type?.id ?? `none-${catKey}`}`
      let typeNode = typeMap.get(typeKey)
      if (!typeNode) {
        typeNode = { key: typeKey, kind: 'type', code: acc.account_type?.code ?? '', label: acc.account_type?.name ?? 'No Type', normalBalance: catNode.normalBalance, children: [], total: 0 }
        typeMap.set(typeKey, typeNode)
        catNode.children.push(typeNode)
      }
      const node = buildAccount(acc, 0)
      typeNode.children.push(node)
      typeNode.total += node.total
      catNode.total += node.total
    }
    const byCode = (a: TreeNode, b: TreeNode) => a.code.localeCompare(b.code, undefined, { numeric: true })
    const cats = Array.from(catMap.values()).sort(byCode)
    cats.forEach((c) => c.children.sort(byCode))
    const keys: string[] = []
    const collect = (nodes: TreeNode[]) => nodes.forEach((n) => { if (n.children.length) { keys.push(n.key); collect(n.children) } })
    collect(cats)
    return { roots: cats, groupKeys: keys }
  }, [items])

  // Client-side search: keep matching accounts + their ancestors (and their type/category), auto-expanded
  const q = debouncedSearch.trim().toLowerCase()
  const { visibleKeys, matchCount } = React.useMemo(() => {
    if (!q) return { visibleKeys: null as Set<string> | null, matchCount: 0 }
    const visible = new Set<string>()
    let count = 0
    const visit = (node: TreeNode): boolean => {
      const selfMatch = node.kind === 'account' && (node.code.toLowerCase().includes(q) || node.label.toLowerCase().includes(q))
      if (selfMatch) count++
      let childMatch = false
      for (const c of node.children) if (visit(c)) childMatch = true
      if (selfMatch || childMatch) visible.add(node.key)
      return selfMatch || childMatch
    }
    roots.forEach(visit)
    return { visibleKeys: visible, matchCount: count }
  }, [roots, q])

  const rows = React.useMemo(() => {
    const out: TreeRow[] = []
    const walk = (nodes: TreeNode[], depth: number, guides: boolean[]) => {
      const shown = visibleKeys ? nodes.filter((n) => visibleKeys.has(n.key)) : nodes
      shown.forEach((node, idx) => {
        const isLast = idx === shown.length - 1
        out.push({ node, depth, isLast, guides: depth === 0 ? [] : guides })
        const open = visibleKeys ? true : expanded.has(node.key)
        if (open && node.children.length) walk(node.children, depth + 1, depth === 0 ? [] : [...guides, !isLast])
      })
    }
    walk(roots, 0, [])
    return out
  }, [roots, visibleKeys, expanded])

  const toggleExpanded = (key: string) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const rowActionBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', color: 'var(--foreground-muted)', display: 'flex', alignItems: 'center', gap: 4 }

  const renderRow = ({ node, depth, isLast, guides }: TreeRow, index: number) => {
    const { item, children } = node
    const hasChildren = children.length > 0
    const isOpen = hasChildren && (visibleKeys ? true : expanded.has(node.key))
    const isCategory = node.kind === 'category'
    const isGroup = node.kind !== 'account' || hasChildren || !!item?.is_header
    const hovered = hoveredKey === node.key
    const canToggle = hasChildren && !visibleKeys
    const FolderIcon = isOpen ? FolderOpen : Folder
    return (
      <div
        key={node.key}
        onMouseEnter={() => setHoveredKey(node.key)}
        onMouseLeave={() => setHoveredKey((h) => (h === node.key ? null : h))}
        style={{
          display: 'flex', alignItems: 'stretch', minHeight: isCategory ? 42 : 36, padding: '0 16px',
          background: hovered ? 'var(--background)' : 'transparent',
          borderTop: isCategory && index > 0 ? '1px solid var(--border)' : 'none',
          opacity: item && !item.is_active ? 0.55 : 1, transition: 'background 120ms',
        }}
      >
        {/* indent guides */}
        {guides.map((continues, i) => (
          <div key={i} style={{ width: INDENT, flexShrink: 0, position: 'relative' }}>
            {continues && <div style={{ position: 'absolute', left: INDENT / 2, top: 0, bottom: 0, width: 1, background: LINE }} />}
          </div>
        ))}
        {depth > 0 && (
          <div style={{ width: INDENT, flexShrink: 0, position: 'relative' }}>
            <div style={{ position: 'absolute', left: INDENT / 2, top: 0, bottom: isLast ? '50%' : 0, width: 1, background: LINE }} />
            <div style={{ position: 'absolute', left: INDENT / 2, right: 2, top: '50%', height: 1, background: LINE }} />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {hasChildren ? (
            <button type="button" title={isOpen ? 'Collapse' : 'Expand'} onClick={() => toggleExpanded(node.key)} disabled={!canToggle}
              style={{ width: 20, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: canToggle ? 'pointer' : 'default', color: 'var(--foreground-muted)', padding: 0 }}>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : <span style={{ width: 20, flexShrink: 0 }} />}
          <span
            onClick={canToggle ? () => toggleExpanded(node.key) : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, cursor: canToggle ? 'pointer' : 'default' }}
          >
            {isGroup
              ? <FolderIcon size={isCategory ? 16 : 15} style={{ color: isCategory ? 'var(--accent)' : 'var(--accent-light)', flexShrink: 0 }} fill="var(--accent-light-bg)" />
              : <FileText size={14} style={{ color: 'var(--foreground-subtle)', flexShrink: 0 }} />}
            {/* nowrap: kode akun harus satu baris (11-01-000), jangan pecah di tanda "-" */}
            {node.code && <span style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', color: 'var(--foreground-muted)' }}>{node.kind === 'account' ? highlight(node.code, q) : node.code}</span>}
            <span title={item?.description || node.label} style={{
              fontSize: isCategory ? 14 : 13, fontWeight: isGroup ? 500 : 400, color: 'var(--foreground)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{node.kind === 'account' ? highlight(node.label, q) : node.label}</span>
            {hasChildren && <span style={{ fontSize: 11, color: 'var(--foreground-subtle)', whiteSpace: 'nowrap' }}>({children.length})</span>}
          </span>
          {item?.use_as_payment_method && <span title="Used as payment method" style={{ fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 99, background: 'var(--accent-light-bg)', color: 'var(--accent)', whiteSpace: 'nowrap' }}>Payment</span>}
          {item && !item.is_active && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}><XCircle size={12} /> Inactive</span>}

          {item && (
            <div style={{ display: hovered ? 'flex' : 'none', alignItems: 'center', gap: 2, marginLeft: 8, flexShrink: 0 }}>
              {canUpdate && <button type="button" onClick={() => { setChildParent(null); setEditData(item); setSheetOpen(true) }} style={rowActionBtn}><Pencil size={12} /> Edit</button>}
              {canCreate && <button type="button" onClick={() => { setEditData(null); setChildParent(item); setSheetOpen(true) }} style={rowActionBtn}><Plus size={12} /> Add Child</button>}
              {canDelete && <button type="button" onClick={() => setDeleteConfirmId(item.id)} style={{ ...rowActionBtn, color: 'var(--destructive)' }}><Trash2 size={12} /> Delete</button>}
            </div>
          )}

          <span style={{ marginLeft: 'auto', paddingLeft: 16, fontSize: 13, fontWeight: isCategory ? 500 : 400, color: node.total === 0 ? 'var(--foreground-subtle)' : 'var(--foreground)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {balanceLabel(node.total, node.normalBalance)}
          </span>
        </div>
      </div>
    )
  }
  const categories: AccountCategory[] = (categoriesData as any)?.data ?? []
  const allTypes: AccountType[] = (typesData as any)?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => chartOfAccountsService.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] }); queryClient.invalidateQueries({ queryKey: ['chart-of-accounts-all'] }); toast.success('Account deleted'); setDeleteConfirmId(null) },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { account_type_id: 0, code: '', name: '', description: '', is_active: true, is_header: false, normal_balance: 'debit', parent_id: null, use_as_payment_method: false },
  })

  // Normal balance follows the category of the selected account type
  const normalBalanceForType = (typeId: number): 'debit' | 'credit' | undefined => {
    const type = allTypes.find((t) => t.id === typeId)
    return categories.find((c) => c.id === type?.account_category_id)?.normal_balance
  }

  useEffect(() => {
    if (editData) {
      reset({ account_type_id: editData.account_type_id, code: editData.code, name: editData.name, description: editData.description ?? '', is_active: editData.is_active, is_header: editData.is_header, normal_balance: editData.normal_balance, parent_id: editData.parent_id ?? null, use_as_payment_method: editData.use_as_payment_method ?? false })
    } else {
      // "Add Child" presets the parent and inherits its account type
      reset({ account_type_id: childParent?.account_type_id ?? 0, code: '', name: '', description: '', is_active: true, is_header: false, normal_balance: childParent?.normal_balance ?? 'debit', parent_id: childParent?.id ?? null, use_as_payment_method: false })
    }
  }, [editData, childParent, sheetOpen, reset])

  const createMutation = useMutation({
    mutationFn: (data: ChartOfAccountRequest) => chartOfAccountsService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] }); queryClient.invalidateQueries({ queryKey: ['chart-of-accounts-all'] }); toast.success('Account created'); setSheetOpen(false) },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: ChartOfAccountRequest) => chartOfAccountsService.update(editData!.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] }); queryClient.invalidateQueries({ queryKey: ['chart-of-accounts-all'] }); toast.success('Account updated'); setSheetOpen(false) },
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
    <div style={{ padding: '32px 32px 64px', width: '100%', maxWidth: 1200, minWidth: 0, boxSizing: 'border-box', margin: '0 auto' }}>
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
            <button onClick={() => { setEditData(null); setChildParent(null); setSheetOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <Plus size={16} /> New Account
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search account code or name..."
            style={{ width: '100%', height: TOOLBAR_H, padding: '0 12px 0 32px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--foreground)', background: 'var(--surface-raised)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }} />
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
            triggerStyle={toolbarSelectStyle}
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
            triggerStyle={toolbarSelectStyle}
          />
        </div>
        {/* tree controls: segmented, pinned right of the filters */}
        <div style={{ marginLeft: 'auto', height: TOOLBAR_H, boxSizing: 'border-box', display: 'flex', alignItems: 'stretch', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', overflow: 'hidden', opacity: q ? 0.5 : 1 }}>
          <button type="button" disabled={!!q} title={q ? 'Clear search to expand/collapse' : undefined} onClick={() => setExpanded(new Set(groupKeys))}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', background: 'none', border: 'none', fontSize: 13, whiteSpace: 'nowrap', color: 'var(--foreground)', cursor: q ? 'default' : 'pointer' }}>
            <ChevronDown size={14} /> Expand all
          </button>
          <div style={{ width: 1, background: 'var(--border)' }} />
          <button type="button" disabled={!!q} title={q ? 'Clear search to expand/collapse' : undefined} onClick={() => setExpanded(new Set())}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', background: 'none', border: 'none', fontSize: 13, whiteSpace: 'nowrap', color: 'var(--foreground)', cursor: q ? 'default' : 'pointer' }}>
            <ChevronRight size={14} /> Collapse all
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
            {isLoading ? 'Loading…' : q ? `${matchCount} of ${items.length} accounts match` : `${items.length} accounts`}
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--foreground-muted)' }}>Balance</span>
        </div>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: (i % 3) * INDENT }}>
                <div style={{ height: 14, width: 240, borderRadius: 'var(--radius-sm)', background: 'var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ height: 14, width: 110, borderRadius: 'var(--radius-sm)', background: 'var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--foreground-muted)', padding: '48px 16px' }}>
            <BookOpen size={32} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 14 }}>No accounts found</span>
          </div>
        ) : (
          <div>
            {rows.map(renderRow)}
          </div>
        )}
      </div>

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Account Type <span style={{ color: 'var(--destructive)' }}>*</span></label>
                  <Controller
                    control={control}
                    name="account_type_id"
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value ? Number(field.value) : 0}
                        onChange={(val) => {
                          const typeId = Number(val) || 0
                          field.onChange(typeId)
                          const nb = typeId && !editData ? normalBalanceForType(typeId) : undefined
                          if (nb) setValue('normal_balance', nb)
                        }}
                        options={allTypes.map((t) => ({
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
                            .filter((i) => (i.is_header || i.id === childParent?.id || i.id === editData?.parent_id) && i.id !== editData?.id)
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
