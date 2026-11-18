'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  departmentsService,
  type Department,
  type DepartmentRequest,
} from '@/services/departments.service'
import { useAuth } from '@/hooks/useAuth'
import SearchableSelect from '@/components/SearchableSelect'
import { toastMutationApiError } from '@/utils/apiError'
import { formatDate, formatDateTime } from '@/utils/date'
import {
  Plus, Pencil, Trash2, ChevronRight, ChevronDown,
  X, Loader2, Building, FolderTree, Eye, CheckCircle2, AlertCircle, CornerDownRight,
} from 'lucide-react'
import { ActiveSegment, FilterBar, FilterSelect, countActive } from '@/components/ListFilters'
import ActiveToggle from '@/components/ActiveToggle'

const schema = z.object({
  company_id: z.coerce.number().optional().default(1),
  parent_id: z.coerce.number().optional().nullable(),
  code: z.string().min(1, 'Code is required').max(50, 'Max 50 characters'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  sort_order: z.coerce.number().default(0),
  is_active: z.boolean().default(true),
})

type FormValues = z.infer<typeof schema>

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  color: 'var(--foreground)',
  background: 'var(--surface-raised)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--foreground)',
  marginBottom: 4,
}

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
}

interface FlattenedDepartment extends Department {
  level: number
  hasChildren: boolean
  parentName?: string
}

export default function DepartmentsView() {
  const qc = useQueryClient()
  const { user, hasPermission, isSuperadmin } = useAuth()
  const canRead = isSuperadmin || hasPermission('department.read')
  const canCreate = isSuperadmin || hasPermission('department.create')
  const canEdit = isSuperadmin || hasPermission('department.update')
  const canDelete = isSuperadmin || hasPermission('department.delete')

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

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('true')
  const [parentFilter, setParentFilter] = useState<string>('')
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({})
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<Department | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [detailItem, setDetailItem] = useState<Department | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  // Filter lookup: unfiltered department list for the parent filter options
  const { data: allDepartmentsData } = useQuery({
    queryKey: ['departments-all'],
    enabled: canRead,
    queryFn: () => departmentsService.list({ per_page: 100 } as any).then((r) => r.data),
  })
  const parentFilterOptions: Department[] = (allDepartmentsData as any)?.data ?? []


  const { data, isLoading: listFirstLoad, isFetching: listFetching } = useQuery({
    queryKey: ['departments', debouncedSearch, statusFilter, parentFilter],
    enabled: canRead,
    queryFn: () =>
      departmentsService
        .list({
          per_page: 1000,
          sort: 'sort_order',
          include: 'parent,children,created_by,updated_by',
          'filter[search]': debouncedSearch || undefined,
          'filter[is_active]': statusFilter !== '' ? statusFilter : undefined,
          'filter[parent_id]': parentFilter || undefined,
        } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const rawItems: Department[] = useMemo(() => (data as any)?.data ?? [], [data])

  // Build tree hierarchy
  const { flattenedTree, parentLookup } = useMemo(() => {
    const itemMap = new Map<number, Department>()
    const childrenMap = new Map<number, Department[]>()
    const parents: { id: number; name: string }[] = []

    rawItems.forEach((item) => {
      itemMap.set(item.id, item)
      parents.push({ id: item.id, name: `${item.code} — ${item.name}` })
      const pId = item.parent_id ?? 0
      if (!childrenMap.has(pId)) childrenMap.set(pId, [])
      childrenMap.get(pId)!.push(item)
    })

    // Sort children by sort_order then code
    childrenMap.forEach((children) => {
      children.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.code.localeCompare(b.code))
    })

    const result: FlattenedDepartment[] = []

    const traverse = (parentId: number, level: number) => {
      const children = childrenMap.get(parentId) ?? []
      for (const child of children) {
        const hasChildNodes = (childrenMap.get(child.id) ?? []).length > 0
        const parentDept = child.parent_id ? itemMap.get(child.parent_id) : undefined

        result.push({
          ...child,
          level,
          hasChildren: hasChildNodes,
          parentName: parentDept ? `${parentDept.code} — ${parentDept.name}` : undefined,
        })

        // Expand by default if search active or if explicitly expanded
        const isExpanded = debouncedSearch ? true : expandedIds[child.id] !== false
        if (hasChildNodes && isExpanded) {
          traverse(child.id, level + 1)
        }
      }
    }

    // Top-level departments have no parent or parent_id not in itemMap
    const rootItems = rawItems.filter((item) => !item.parent_id || !itemMap.has(item.parent_id))
    rootItems.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.code.localeCompare(b.code))

    for (const root of rootItems) {
      const hasChildNodes = (childrenMap.get(root.id) ?? []).length > 0
      result.push({
        ...root,
        level: 0,
        hasChildren: hasChildNodes,
        parentName: undefined,
      })
      const isExpanded = debouncedSearch ? true : expandedIds[root.id] !== false
      if (hasChildNodes && isExpanded) {
        traverse(root.id, 1)
      }
    }

    return { flattenedTree: result, parentLookup: parents }
  }, [rawItems, debouncedSearch, expandedIds])

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: prev[id] === false ? true : false,
    }))
  }

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
      parent_id: null,
      code: '',
      name: '',
      description: '',
      sort_order: 0,
      is_active: true,
    },
  })

  const openCreate = (defaultParentId?: number) => {
    setEditData(null)
    reset({
      company_id: userCompanyId,
      parent_id: defaultParentId ?? null,
      code: '',
      name: '',
      description: '',
      sort_order: 0,
      is_active: true,
    })
    setSheetOpen(true)
  }

  const openEdit = (item: Department) => {
    setEditData(item)
    reset({
      company_id: item.company_id ?? userCompanyId,
      parent_id: item.parent_id ?? null,
      code: item.code,
      name: item.name,
      description: item.description ?? '',
      sort_order: item.sort_order ?? 0,
      is_active: item.is_active ?? true,
    })
    setSheetOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: (data: DepartmentRequest) => departmentsService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] })
      qc.invalidateQueries({ queryKey: ['departments-all'] })
      qc.invalidateQueries({ queryKey: ['departments-active'] })
      toast.success('Department created successfully')
      setSheetOpen(false)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create department'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: DepartmentRequest) => departmentsService.update(editData!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] })
      qc.invalidateQueries({ queryKey: ['departments-all'] })
      qc.invalidateQueries({ queryKey: ['departments-active'] })
      toast.success('Department updated successfully')
      setSheetOpen(false)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update department'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => departmentsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] })
      qc.invalidateQueries({ queryKey: ['departments-all'] })
      qc.invalidateQueries({ queryKey: ['departments-active'] })
      toast.success('Department deleted successfully')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message
      if (msg) {
        toast.error(msg)
      } else {
        toastMutationApiError(err, 'Failed to delete department')
      }
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  const onSubmit = (values: FormValues) => {
    if (editData) {
      // UpdateDepartmentRequest in OpenAPI does not take company_id
      const payload: Partial<DepartmentRequest> = {
        parent_id: values.parent_id ? Number(values.parent_id) : null,
        code: values.code.trim(),
        name: values.name.trim(),
        description: values.description ? values.description.trim() : undefined,
        sort_order: Number(values.sort_order) || 0,
        is_active: values.is_active,
      }
      updateMutation.mutate(payload as DepartmentRequest)
    } else {
      // CreateDepartmentRequest requires company_id, code, name
      const payload: DepartmentRequest = {
        company_id: Number(values.company_id || userCompanyId),
        parent_id: values.parent_id ? Number(values.parent_id) : null,
        code: values.code.trim(),
        name: values.name.trim(),
        description: values.description ? values.description.trim() : undefined,
        sort_order: Number(values.sort_order) || 0,
        is_active: values.is_active,
      }
      createMutation.mutate(payload)
    }
  }

  // Parent options excluding self and self's descendants
  const validParentOptions = useMemo(() => {
    const excludeIds = new Set<number>()
    if (editData) {
      excludeIds.add(editData.id)
      const addDescendants = (id: number) => {
        rawItems
          .filter((d) => d.parent_id === id)
          .forEach((child) => {
            excludeIds.add(child.id)
            addDescendants(child.id)
          })
      }
      addDescendants(editData.id)
    }

    const opts = [{ value: '', label: '-- None (Top-Level Department) --' }]
    parentLookup
      .filter((p) => !excludeIds.has(p.id))
      .forEach((p) => {
        opts.push({ value: String(p.id), label: p.name })
      })
    return opts
  }, [parentLookup, editData, rawItems])

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
            Departments
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Manage organizational structure and nested department hierarchy
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => openCreate()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Plus size={16} /> New Department
          </button>
        )}
      </div>

      {/* Filters */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by code or name..."
        activeCount={countActive(statusFilter !== 'true', parentFilter)}
        onClear={() => {
          setStatusFilter('true')
          setParentFilter('')
        }}
        quick={
          <>
            <ActiveSegment value={statusFilter} onChange={setStatusFilter} label="Department status" />
            <FilterSelect value={parentFilter} onChange={(e) => setParentFilter(e.target.value)}>
              <option value="">All Parents</option>
              {parentFilterOptions.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.code} — {d.name}
                </option>
              ))}
            </FilterSelect>
          </>
        }
      />

      {/* Tree / Grid Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={{ ...thStyle, width: 280 }}>Department Name</th>
              <th style={{ ...thStyle, width: 140 }}>Code</th>
              <th style={{ ...thStyle, width: 160 }}>Parent</th>
              <th style={thStyle}>Description</th>
              <th style={{ ...thStyle, width: 90, textAlign: 'center' }}>Sort</th>
              <th style={{ ...thStyle, width: 100 }}>Status</th>
              <th style={{ ...thStyle, width: 110, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} style={tdStyle}>
                      <div
                        style={{
                          height: 14,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--border)',
                          width: j === 7 ? 60 : '80%',
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : flattenedTree.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--foreground-muted)' }}>
                    <FolderTree size={32} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: 14 }}>No departments found</span>
                  </div>
                </td>
              </tr>
            ) : (
              flattenedTree.map((item, idx) => {
                const isExpanded = debouncedSearch ? true : expandedIds[item.id] !== false
                return (
                  <tr
                    key={item.id}
                    style={{ transition: 'background 120ms' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13, width: 50 }}>
                      {idx + 1}
                    </td>
                    {/* Name with indentation & expand toggle */}
                    <td style={{ ...tdStyle, paddingLeft: `${item.level * 24 + 16}px` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.level > 0 && (
                          <CornerDownRight size={13} style={{ color: 'var(--foreground-muted)', flexShrink: 0 }} />
                        )}
                        {item.hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 2,
                              display: 'flex',
                              alignItems: 'center',
                              color: 'var(--foreground-muted)',
                            }}
                          >
                            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </button>
                        ) : (
                          <div style={{ width: 19 }} />
                        )}
                        <span style={{ fontSize: 13, fontWeight: item.level === 0 ? 600 : 500, color: 'var(--foreground)' }}>
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                        {item.code}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                        {item.parentName || '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 13, color: 'var(--foreground)' }}>
                        {item.description || '—'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                        {item.sort_order ?? 0}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {item.is_active ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#10b981', padding: '2px 8px', borderRadius: 99, background: 'rgba(16,185,129,0.1)' }}>
                          <CheckCircle2 size={11} /> Active
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--foreground-muted)', padding: '2px 8px', borderRadius: 99, background: 'var(--background)', border: '1px solid var(--border)' }}>
                          Inactive
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {canCreate && (
                          <button
                            onClick={() => openCreate(item.id)}
                            title="Add Child Sub-Department"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--accent)', display: 'flex' }}
                          >
                            <Plus size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setDetailItem(item)}
                          title="View Detail"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--foreground-muted)', display: 'flex' }}
                        >
                          <Eye size={14} />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => openEdit(item)}
                            title="Edit Department"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--foreground-muted)', display: 'flex' }}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setDeleteConfirmId(item.id)}
                            title="Delete Department"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--destructive)', display: 'flex' }}
                          >
                            <Trash2 size={14} />
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDeleteConfirmId(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
          <div style={{ position: 'relative', zIndex: 70, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', width: 380, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>
              Delete Department
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px', lineHeight: 1.5 }}>
              Are you sure you want to delete this department? Note that departments with sub-departments cannot be deleted.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{ padding: '7px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                style={{ padding: '7px 16px', background: 'var(--destructive)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', opacity: deleteMutation.isPending ? 0.7 : 1 }}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDetailItem(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
          <div style={{ position: 'relative', zIndex: 70, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', width: 500, maxWidth: '92vw', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>
                  {detailItem.name}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
                  Code: <span style={{ fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}>{detailItem.code}</span>
                </p>
              </div>
              <button onClick={() => setDetailItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                <X size={18} color="var(--foreground-muted)" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div>
                <span style={{ color: 'var(--foreground-muted)', display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Parent Department</span>
                <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>
                  {detailItem.parent ? `${detailItem.parent.code} — ${detailItem.parent.name}` : 'Top-Level Department (No Parent)'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--foreground-muted)', display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Description</span>
                <span style={{ color: 'var(--foreground)' }}>{detailItem.description || '—'}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={{ color: 'var(--foreground-muted)', display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Sort Order</span>
                  <span style={{ color: 'var(--foreground)' }}>{detailItem.sort_order ?? 0}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--foreground-muted)', display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Status</span>
                  <span style={{ color: detailItem.is_active ? '#10b981' : 'var(--foreground-muted)', fontWeight: 500 }}>
                    {detailItem.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              {detailItem.created_by?.name && (
                <div>
                  <span style={{ color: 'var(--foreground-muted)', display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Created By</span>
                  <span style={{ color: 'var(--foreground)' }}>
                    {detailItem.created_by.name} {detailItem.created_at && `(${formatDateTime(detailItem.created_at)})`}
                  </span>
                </div>
              )}
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDetailItem(null)}
                style={{ padding: '7px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Side Sheet */}
      {sheetOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSheetOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
          <div style={{ position: 'relative', zIndex: 60, width: 500, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
                {editData ? 'Edit Department' : 'New Department'}
              </h2>
              <button onClick={() => setSheetOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                <X size={18} color="var(--foreground-muted)" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Company (Auto-detected from /auth/me) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                  <Building size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>
                    {userCompanyName}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                  Auto-selected from your active session (/auth/me)
                </span>
              </div>

              {/* Parent Department */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Parent Department</label>
                <Controller
                  control={control}
                  name="parent_id"
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ? String(field.value) : ''}
                      onChange={(val) => field.onChange(val ? Number(val) : null)}
                      options={validParentOptions}
                      placeholder="-- None (Top-Level Department) --"
                      searchPlaceholder="Search parent department..."
                    />
                  )}
                />
                <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                  Leave empty if this is a top-level department
                </span>
              </div>

              {/* Code */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>
                  Code <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <input
                  {...register('code')}
                  placeholder="e.g. HR, FIN, IT"
                  maxLength={50}
                  style={inputStyle}
                />
                {errors.code && (
                  <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.code.message}</span>
                )}
              </div>

              {/* Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>
                  Name <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <input
                  {...register('name')}
                  placeholder="e.g. Human Resources"
                  style={inputStyle}
                />
                {errors.name && (
                  <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.name.message}</span>
                )}
              </div>

              {/* Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Description</label>
                <textarea
                  {...register('description')}
                  rows={3}
                  placeholder="Department responsibilities and notes..."
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              {/* Sort Order */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>Sort Order</label>
                <input
                  type="number"
                  {...register('sort_order')}
                  placeholder="0"
                  style={inputStyle}
                />
                <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                  Lower numbers appear first in lists and menus
                </span>
              </div>

              {/* Active Toggle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Status</label>
                <Controller
                  name="is_active"
                  control={control}
                  render={({ field }) => <ActiveToggle value={field.value} onChange={field.onChange} />}
                />
              </div>
            </form>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSubmit(onSubmit)}
                style={{
                  padding: '8px 16px',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {isSaving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                {editData ? 'Save Changes' : 'Create Department'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
