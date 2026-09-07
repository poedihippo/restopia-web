'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { dimensionTransferRequestsService } from '@/services/dimension-transfer-requests.service'
import { companiesService } from '@/services/companies.service'
import { branchesService } from '@/services/branches.service'
import { productUomBatchesService } from '@/services/product-uom-batches.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/utils/date'
import { CustomPagination } from '@/components/ui/CustomPagination'
import DimensionTransferRequestSheet from './DimensionTransferRequestSheet'
import api from '@/hooks/useApi'
import {
  Plus,
  Search,
  ArrowRightLeft,
  Check,
  X as XIcon,
  Building2,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Info,
  Loader2,
} from 'lucide-react'

interface DimensionRef {
  owner_ref?: string
  owner_display?: string
  owner_company_name?: string
  stage?: string
  stage_name?: string
  location_ref?: string
}

interface DimensionTransferRequestItem {
  id: number
  branch_id?: number
  branch?: {
    id: number
    name: string
    code?: string
    company_id?: number
    company?: { id: number; name: string }
  }
  product_uom_batch_id: number
  qty: number
  status: 'pending' | 'approved' | 'rejected'
  reject_reason?: string
  created_at?: string
  approved_at?: string
  requested_at?: string
  from?: DimensionRef
  to?: DimensionRef
  from_owner_ref?: string
  from_stage?: string
  from_location_ref?: string
  to_owner_ref?: string
  to_stage?: string
  to_location_ref?: string
  description?: string
  requested_by?: { id: number; name: string }
  created_by?: { id: number; name: string }
  approved_by?: { id: number; name: string }
  product_uom_batch?: {
    id: number
    batch_code?: string
    code?: string
    expiry_date?: string
    product_uom_id?: number
    product_uom?: {
      id: number
      code?: string
      product?: { id: number; name: string; code?: string }
      uom?: { id: number; name: string; code?: string }
    }
  }
}

const STATUS_META = {
  pending: { label: 'Pending', color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'var(--warning)' },
  approved: { label: 'Approved', color: 'var(--success)', bg: 'var(--success-bg)', border: 'var(--success)' },
  rejected: { label: 'Rejected', color: 'var(--destructive)', bg: 'var(--destructive-bg)', border: 'var(--destructive)' },
}

export default function DimensionTransferRequestsView() {
  const { user, hasPermission, isSuperadmin } = useAuth()
  const queryClient = useQueryClient()

  // Comprehensive permission fallbacks
  const canCreate =
    isSuperadmin ||
    hasPermission('dimension-transfer-request.create') ||
    hasPermission('stock-movement.create') ||
    hasPermission('stock-movement.menu') ||
    hasPermission('delivery.create')

  const canApprove =
    isSuperadmin ||
    hasPermission('dimension-transfer-request.approve') ||
    hasPermission('dimension-transfer-request.update') ||
    hasPermission('stock-movement.update') ||
    hasPermission('stock-movement.create') ||
    hasPermission('delivery.update')

  // Active company and branch context
  const activeCompanyId = user?.branch?.company?.id ? String(user?.branch?.company?.id) : undefined
  const activeCompanyName = user?.branch?.company?.name
  const activeBranchId = user?.branch?.id
  const activeBranchName = user?.branch?.name

  // States
  const [directionTab, setDirectionTab] = useState<'all' | 'outbound' | 'inbound'>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [statusFilter, setStatusFilter] = useState<'' | 'pending' | 'approved' | 'rejected'>('')
  const [companyFilter, setCompanyFilter] = useState<string>('')
  const [branchFilter, setBranchFilter] = useState<string>('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<DimensionTransferRequestItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, companyFilter, branchFilter, directionTab])

  // Lookups: Companies
  const { data: companiesData } = useQuery({
    queryKey: ['companies-all'],
    queryFn: () => companiesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const companies: { id: number; name: string }[] = (companiesData as any)?.data ?? []

  const companyMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of companies) {
      map.set(String(c.id), c.name)
      map.set(c.name, c.name)
    }
    return map
  }, [companies])

  // Lookups: Stages
  const { data: stagesData } = useQuery({
    queryKey: ['stages-all'],
    queryFn: () => api.get('/stages', { params: { per_page: 100 } }).then((r) => r.data),
  })
  const stages: { code?: string; name: string }[] = (stagesData as any)?.data ?? []

  const stageMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of stages) {
      if (s.code) map.set(s.code.toLowerCase(), s.name)
      map.set(s.name.toLowerCase(), s.name)
    }
    return map
  }, [stages])

  // Lookups: Branches
  const { data: branchesData } = useQuery({
    queryKey: ['branches-all'],
    queryFn: () => branchesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const allBranches: any[] = (branchesData as any)?.data ?? []
  const availableBranches: any[] = isSuperadmin ? allBranches : user?.branches ?? []

  // Lookups: Batches (safety cache for products)
  const { data: batchesData } = useQuery({
    queryKey: ['product-uom-batches-lookup'],
    queryFn: () =>
      productUomBatchesService
        .list({ per_page: 100, include: 'product_uom,product_uom.product,product_uom.uom' })
        .then((r: any) => r.data),
  })
  const batchesList: any[] = (batchesData as any)?.data ?? []

  const batchMap = useMemo(() => {
    const map = new Map<number, any>()
    for (const b of batchesList) {
      map.set(b.id, b)
    }
    return map
  }, [batchesList])

  // Main Requests Query
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dimension-transfer-requests', page, perPage, statusFilter, branchFilter],
    queryFn: () =>
      dimensionTransferRequestsService
        .list({
          page,
          per_page: perPage,
          include: 'branch,product_uom_batch,requested_by,approved_by,created_by',
          sort: '-created_at',
          'filter[branch_id]': branchFilter || undefined,
          'filter[status]': statusFilter || undefined,
        } as any)
        .then((r) => r.data),
  })

  const rawItems: DimensionTransferRequestItem[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  // Resolvers
  const resolveOwnerName = (ownerRef?: string): { name: string; isGeneral: boolean } => {
    if (!ownerRef || ownerRef === '—') return { name: '—', isGeneral: false }
    if (ownerRef.toUpperCase() === 'GENERAL') return { name: 'Umum (GENERAL)', isGeneral: true }
    const name = companyMap.get(String(ownerRef))
    if (name) return { name, isGeneral: false }
    return { name: `PT #${ownerRef}`, isGeneral: false }
  }

  const resolveStageName = (stage?: string): string => {
    if (!stage || stage === '—') return '—'
    const match = stageMap.get(stage.toLowerCase())
    if (match) return match
    return stage.charAt(0).toUpperCase() + stage.slice(1).toLowerCase()
  }

  const resolveProductInfo = (item: DimensionTransferRequestItem) => {
    const fallbackBatch = item.product_uom_batch_id ? batchMap.get(item.product_uom_batch_id) : undefined
    const batch = item.product_uom_batch || fallbackBatch

    const batchCode = batch?.batch_code || batch?.code || (item as any).batch_code || '—'
    const product =
      batch?.product_uom?.product ||
      (batch as any)?.product ||
      (item as any)?.product
    const productName = product?.name || (batch?.product_uom?.code ? `SKU: ${batch.product_uom.code}` : '—')
    const productCode = product?.code
    const uomName = batch?.product_uom?.uom?.name || batch?.product_uom?.uom?.code

    return { productName, productCode, batchCode, uomName }
  }

  // Filter items by directionTab, companyFilter, and debouncedSearch
  const filteredItems = useMemo(() => {
    return rawItems.filter((item) => {
      const fromOwner = item.from?.owner_ref || item.from_owner_ref || ''
      const toOwner = item.to?.owner_ref || item.to_owner_ref || ''

      // Direction Tab
      if (directionTab === 'outbound') {
        // Must originate from active PT or active branch
        const matchesPt = activeCompanyId && String(fromOwner) === activeCompanyId
        const matchesBranch = activeBranchId && item.branch_id === activeBranchId
        if (!matchesPt && !matchesBranch) return false
      } else if (directionTab === 'inbound') {
        // Must be destined for active PT
        const matchesPt = activeCompanyId && String(toOwner) === activeCompanyId
        if (!matchesPt) return false
      }

      // Company Filter
      if (companyFilter) {
        if (companyFilter === 'GENERAL') {
          if (fromOwner.toUpperCase() !== 'GENERAL' && toOwner.toUpperCase() !== 'GENERAL') {
            return false
          }
        } else {
          if (String(fromOwner) !== companyFilter && String(toOwner) !== companyFilter) {
            return false
          }
        }
      }

      // Search Filter
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim()
        const { productName, productCode, batchCode } = resolveProductInfo(item)
        const requester = item.requested_by?.name || item.created_by?.name || ''
        const fromCompany = resolveOwnerName(fromOwner).name.toLowerCase()
        const toCompany = resolveOwnerName(toOwner).name.toLowerCase()
        const fromStage = (item.from?.stage || item.from_stage || '').toLowerCase()
        const toStage = (item.to?.stage || item.to_stage || '').toLowerCase()
        const reason = (item.reject_reason || '').toLowerCase()
        const branchName = (item.branch?.name || '').toLowerCase()

        const match =
          productName.toLowerCase().includes(q) ||
          (productCode && productCode.toLowerCase().includes(q)) ||
          batchCode.toLowerCase().includes(q) ||
          requester.toLowerCase().includes(q) ||
          fromCompany.includes(q) ||
          toCompany.includes(q) ||
          fromStage.includes(q) ||
          toStage.includes(q) ||
          reason.includes(q) ||
          branchName.includes(q)

        if (!match) return false
      }

      return true
    })
  }, [rawItems, directionTab, activeCompanyId, activeBranchId, companyFilter, debouncedSearch, batchMap, companyMap, stageMap])

  // Counts for tabs
  const tabCounts = useMemo(() => {
    let outbound = 0
    let inbound = 0
    for (const item of rawItems) {
      const fromOwner = item.from?.owner_ref || item.from_owner_ref || ''
      const toOwner = item.to?.owner_ref || item.to_owner_ref || ''
      if (
        (activeCompanyId && String(fromOwner) === activeCompanyId) ||
        (activeBranchId && item.branch_id === activeBranchId)
      ) {
        outbound++
      }
      if (activeCompanyId && String(toOwner) === activeCompanyId) {
        inbound++
      }
    }
    return { all: rawItems.length, outbound, inbound }
  }, [rawItems, activeCompanyId, activeBranchId])

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (id: number) => dimensionTransferRequestsService.approve(id),
    onSuccess: () => {
      toast.success('Permintaan transfer dimensi disetujui')
      queryClient.invalidateQueries({ queryKey: ['dimension-transfer-requests'] })
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal menyetujui permintaan'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      dimensionTransferRequestsService.reject(id, reason),
    onSuccess: () => {
      toast.success('Permintaan transfer dimensi ditolak')
      setRejectTarget(null)
      setRejectReason('')
      queryClient.invalidateQueries({ queryKey: ['dimension-transfer-requests'] })
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal menolak permintaan'),
  })

  const submitReject = () => {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      toast.error('Alasan penolakan wajib diisi')
      return
    }
    rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason.trim() })
  }

  // Styles
  const thStyle: React.CSSProperties = {
    padding: '12px 14px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
    background: 'var(--surface-muted)',
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
  }

  const inputBase: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
  }

  const actionBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 10px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    border: '1px solid var(--border)',
    transition: 'opacity 0.15s ease',
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1320, margin: '0 auto' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 20,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 26,
                fontWeight: 600,
                color: 'var(--foreground)',
                margin: 0,
              }}
            >
              Dimension Transfer Requests
            </h1>
            <span
              style={{
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 99,
                background: 'var(--accent-light-bg, rgba(160,82,45,0.1))',
                color: 'var(--accent)',
                fontWeight: 600,
              }}
            >
              OpenAPI Symmetrical
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Permintaan transfer stok antar entitas (PT / Owner) dan tahapan (Stage) yang memerlukan persetujuan
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setSheetOpen(true)}
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
            <Plus size={16} />
            Buat Permintaan Baru
          </button>
        )}
      </div>

      {/* Active Context Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 20,
          fontSize: 12,
          color: 'var(--foreground-muted)',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building2 size={15} style={{ color: 'var(--accent)' }} />
          <span>
            <strong>PT Aktif:</strong>{' '}
            <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>
              {activeCompanyName || 'Umum (GENERAL)'}
            </span>
          </span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span>
            <strong>Cabang:</strong>{' '}
            <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>
              {activeBranchName || 'Semua Cabang'}
            </span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--foreground-subtle)' }}>
          <Info size={13} />
          <span>
            Permintaan dari PT Aktif masuk ke tab <strong>Permintaan Keluar</strong>, menuju PT Aktif masuk ke tab{' '}
            <strong>Permintaan Masuk</strong>.
          </span>
        </div>
      </div>

      {/* Direction Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 8,
        }}
      >
        <button
          onClick={() => setDirectionTab('all')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: directionTab === 'all' ? 600 : 500,
            background: directionTab === 'all' ? 'var(--accent)' : 'transparent',
            color: directionTab === 'all' ? 'white' : 'var(--foreground-muted)',
          }}
        >
          <ArrowRightLeft size={14} />
          Semua Permintaan
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 99,
              fontSize: 11,
              background: directionTab === 'all' ? 'rgba(255,255,255,0.25)' : 'var(--border)',
              color: directionTab === 'all' ? 'white' : 'var(--foreground)',
            }}
          >
            {tabCounts.all}
          </span>
        </button>

        <button
          onClick={() => setDirectionTab('outbound')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: directionTab === 'outbound' ? 600 : 500,
            background: directionTab === 'outbound' ? 'var(--accent)' : 'transparent',
            color: directionTab === 'outbound' ? 'white' : 'var(--foreground-muted)',
          }}
        >
          <ArrowUpRight size={14} />
          Permintaan Keluar (Dari PT Aktif)
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 99,
              fontSize: 11,
              background: directionTab === 'outbound' ? 'rgba(255,255,255,0.25)' : 'var(--border)',
              color: directionTab === 'outbound' ? 'white' : 'var(--foreground)',
            }}
          >
            {tabCounts.outbound}
          </span>
        </button>

        <button
          onClick={() => setDirectionTab('inbound')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: directionTab === 'inbound' ? 600 : 500,
            background: directionTab === 'inbound' ? 'var(--accent)' : 'transparent',
            color: directionTab === 'inbound' ? 'white' : 'var(--foreground-muted)',
          }}
        >
          <ArrowDownLeft size={14} />
          Permintaan Masuk (Menuju PT Aktif)
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 99,
              fontSize: 11,
              background: directionTab === 'inbound' ? 'rgba(255,255,255,0.25)' : 'var(--border)',
              color: directionTab === 'inbound' ? 'white' : 'var(--foreground)',
            }}
          >
            {tabCounts.inbound}
          </span>
        </button>
      </div>

      {/* Toolbar Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', minWidth: 260 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--foreground-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari produk, batch, peminta..."
            style={{
              ...inputBase,
              width: 260,
              padding: '8px 12px 8px 32px',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          style={{ ...inputBase, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}
        >
          <option value="">Semua Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        {/* PT / Company Filter */}
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          style={{ ...inputBase, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}
        >
          <option value="">Semua PT / Owner</option>
          <option value="GENERAL">Umum (GENERAL)</option>
          {companies.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Branch Filter (for Superadmin or multi-branch) */}
        {(isSuperadmin || availableBranches.length > 1) && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            style={{ ...inputBase, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}
          >
            <option value="">Semua Cabang</option>
            {availableBranches.map((b: any) => (
              <option key={b.id} value={String(b.id)}>
                {b.name} {b.company?.name ? `(${b.company.name})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Main Table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1040 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 45, textAlign: 'center' }}>No.</th>
                <th style={{ ...thStyle, width: 220 }}>Produk & Batch</th>
                <th style={{ ...thStyle, width: 130 }}>Cabang</th>
                <th style={{ ...thStyle, width: 200 }}>Dari (Asal)</th>
                <th style={{ ...thStyle, width: 200 }}>Ke (Tujuan)</th>
                <th style={{ ...thStyle, width: 70, textAlign: 'right' }}>Qty</th>
                <th style={{ ...thStyle, width: 120 }}>Peminta</th>
                <th style={{ ...thStyle, width: 140 }}>Status</th>
                <th style={{ ...thStyle, width: 120 }}>Tanggal</th>
                <th style={{ ...thStyle, width: 160 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }).map((__, j) => (
                      <td key={j} style={tdStyle}>
                        <div
                          style={{
                            height: 14,
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--border)',
                            width: j === 9 ? 120 : j === 0 ? 20 : '75%',
                            animation: 'pulse 1.5s ease-in-out infinite',
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={10} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                    <span style={{ fontSize: 14, color: 'var(--destructive)' }}>
                      Gagal memuat permintaan transfer dimensi. Silakan coba lagi.
                    </span>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 10,
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      <ArrowRightLeft size={32} style={{ opacity: 0.35 }} />
                      <span style={{ fontSize: 14 }}>
                        {rawItems.length === 0
                          ? 'Belum ada permintaan transfer dimensi'
                          : 'Tidak ada permintaan yang sesuai dengan filter'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const statusMeta = STATUS_META[item.status] ?? STATUS_META.pending
                  const { productName, productCode, batchCode, uomName } = resolveProductInfo(item)
                  const requester = item.requested_by?.name ?? item.created_by?.name ?? '—'

                  const fromOwnerRef = item.from?.owner_ref || item.from_owner_ref || ''
                  const fromOwnerResolved = resolveOwnerName(fromOwnerRef)
                  const fromStage = item.from?.stage || item.from_stage || ''
                  const fromStageResolved = resolveStageName(fromStage)
                  const fromLocation = item.from?.location_ref || item.from_location_ref || 'GENERAL'

                  const toOwnerRef = item.to?.owner_ref || item.to_owner_ref || ''
                  const toOwnerResolved = resolveOwnerName(toOwnerRef)
                  const toStage = item.to?.stage || item.to_stage || ''
                  const toStageResolved = resolveStageName(toStage)
                  const toLocation = item.to?.location_ref || item.to_location_ref || 'GENERAL'

                  const branchName = item.branch?.name || (item as any).branch_name || '—'

                  const isActioning =
                    (approveMutation.isPending && approveMutation.variables === item.id) ||
                    (rejectMutation.isPending && rejectMutation.variables?.id === item.id)

                  const isOutgoingFromActive =
                    activeCompanyId && String(fromOwnerRef) === activeCompanyId
                  const isIncomingToActive =
                    activeCompanyId && String(toOwnerRef) === activeCompanyId

                  return (
                    <tr
                      key={item.id}
                      style={{
                        background:
                          isOutgoingFromActive
                            ? 'rgba(255, 165, 0, 0.02)'
                            : isIncomingToActive
                            ? 'rgba(34, 197, 94, 0.02)'
                            : undefined,
                      }}
                    >
                      {/* No */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                          {(page - 1) * perPage + idx + 1}
                        </span>
                      </td>

                      {/* Product & Batch */}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                            {productName}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {productCode && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 500,
                                  color: 'var(--foreground-muted)',
                                  background: 'var(--surface-muted)',
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  border: '1px solid var(--border)',
                                }}
                              >
                                {productCode}
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: 11,
                                color: 'var(--accent)',
                                fontWeight: 500,
                              }}
                            >
                              Batch: {batchCode}
                            </span>
                            {uomName && (
                              <span style={{ fontSize: 10, color: 'var(--foreground-subtle)' }}>
                                ({uomName})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Branch */}
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, color: 'var(--foreground)' }}>{branchName}</span>
                      </td>

                      {/* Dari (Asal) */}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: fromOwnerResolved.isGeneral ? 'var(--foreground-muted)' : 'var(--foreground)',
                              }}
                            >
                              {fromOwnerResolved.name}
                            </span>
                            {isOutgoingFromActive && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: 'var(--accent)',
                                  background: 'var(--accent-light-bg, rgba(160,82,45,0.1))',
                                  padding: '1px 4px',
                                  borderRadius: 3,
                                }}
                              >
                                SAYA
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: 10,
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: 'var(--border)',
                                color: 'var(--foreground)',
                                fontWeight: 500,
                              }}
                            >
                              {fromStageResolved}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: 'var(--surface-muted)',
                                border: '1px solid var(--border)',
                                color: 'var(--foreground-muted)',
                              }}
                            >
                              {fromLocation}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Ke (Tujuan) */}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: toOwnerResolved.isGeneral ? 'var(--foreground-muted)' : 'var(--foreground)',
                              }}
                            >
                              {toOwnerResolved.name}
                            </span>
                            {isIncomingToActive && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: 'var(--success)',
                                  background: 'var(--success-bg)',
                                  padding: '1px 4px',
                                  borderRadius: 3,
                                }}
                              >
                                SAYA
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: 10,
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: 'var(--border)',
                                color: 'var(--foreground)',
                                fontWeight: 500,
                              }}
                            >
                              {toStageResolved}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: 'var(--surface-muted)',
                                border: '1px solid var(--border)',
                                color: 'var(--foreground-muted)',
                              }}
                            >
                              {toLocation}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Qty */}
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                          {item.qty?.toLocaleString('id-ID')}
                        </span>
                      </td>

                      {/* Peminta */}
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{requester}</span>
                      </td>

                      {/* Status */}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px 9px',
                              borderRadius: 99,
                              fontSize: 11,
                              fontWeight: 600,
                              background: statusMeta.bg,
                              color: statusMeta.color,
                              border: `1px solid ${statusMeta.border}`,
                              width: 'fit-content',
                            }}
                          >
                            {statusMeta.label}
                          </span>
                          {item.status === 'approved' && (
                            <span style={{ fontSize: 10, color: 'var(--foreground-subtle)' }}>
                              oleh {item.approved_by?.name ?? '—'}
                              {item.approved_at ? ` · ${formatDate(item.approved_at)}` : ''}
                            </span>
                          )}
                          {item.status === 'rejected' && item.reject_reason && (
                            <span
                              title={item.reject_reason}
                              style={{
                                fontSize: 10,
                                color: 'var(--destructive)',
                                maxWidth: 140,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              alasan: {item.reject_reason}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tanggal */}
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                          {item.created_at ? formatDate(item.created_at) : '—'}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td style={tdStyle}>
                        {item.status === 'pending' && canApprove ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => approveMutation.mutate(item.id)}
                              style={{
                                ...actionBtnStyle,
                                background: 'var(--success-bg)',
                                color: 'var(--success)',
                                borderColor: 'var(--success)',
                                opacity: isActioning ? 0.6 : 1,
                                cursor: isActioning ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <Check size={12} />
                              Setujui
                            </button>
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => {
                                setRejectTarget(item)
                                setRejectReason('')
                              }}
                              style={{
                                ...actionBtnStyle,
                                background: 'var(--destructive-bg)',
                                color: 'var(--destructive)',
                                borderColor: 'var(--destructive)',
                                opacity: isActioning ? 0.6 : 1,
                                cursor: isActioning ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <XIcon size={12} />
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

      <DimensionTransferRequestSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />

      {/* Reject Reason Modal */}
      {rejectTarget !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={() => {
              setRejectTarget(null)
              setRejectReason('')
            }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 70,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              width: 440,
              boxShadow: 'var(--shadow-xl)',
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
              Tolak Permintaan Transfer Dimensi
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 16px' }}>
              Berikan alasan mengapa permintaan pemindahan dimensi ini ditolak.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Contoh: Stok tidak mencukupi, salah tahapan, dll..."
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                color: 'var(--foreground)',
                background: 'var(--background)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                boxSizing: 'border-box',
                resize: 'vertical',
                minHeight: 72,
                marginBottom: 20,
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setRejectTarget(null)
                  setRejectReason('')
                }}
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
                Batal
              </button>
              <button
                onClick={submitReject}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                style={{
                  padding: '7px 16px',
                  background: 'var(--destructive)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'white',
                  cursor: rejectMutation.isPending || !rejectReason.trim() ? 'not-allowed' : 'pointer',
                  opacity: rejectMutation.isPending || !rejectReason.trim() ? 0.6 : 1,
                }}
              >
                {rejectMutation.isPending ? 'Menolak...' : 'Tolak Permintaan'}
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
