'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productInventoriesService } from '@/services/product-inventories.service'
import { productUomsService } from '@/services/product-uoms.service'
import { productCategoriesService } from '@/services/product-categories.service'
import { companiesService } from '@/services/companies.service'
import { toastMutationApiError } from '@/utils/apiError'
import { getProductUomName } from '@/utils/productUomName'
import { availableStockOf } from '@/utils/inventoryStock'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes, isProductTypeAllowed } from '@/hooks/useProductTypes'
import { useBranchUomDisplay } from '@/hooks/useBranchUomDisplay'
import ProductInventorySheet from './ProductInventorySheet'
import ChangeDimensionModal from './ChangeDimensionModal'
import StockMovementSheet from '../StockMovement/StockMovementSheet'
import { CustomPagination } from '@/components/ui/CustomPagination'
import MultiSearchableSelect from '@/components/MultiSearchableSelect'
import { ActiveSegment, FilterBar, FilterGroup, FilterField, FilterSelect, FilterInput, DateRange, countActive } from '@/components/ListFilters'
import api from '@/hooks/useApi'
import {
  packagingChains,
  type ConversionEntry,
  type UnitDisplayMode,
} from '@/utils/unitDisplay'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Boxes,
  Download,
  Loader2,
  SlidersHorizontal,
  History,
} from 'lucide-react'

interface ProductInventory {
  id: number
  qty: number
  /** The one quantity now — the old sellable/cutable/reserved figures are gone. */
  stock?: number
  display_qty?: number | null
  display_uom_code?: string | null
  base_stock?: number | null
  base_uom_code?: string | null
  min_qty?: number
  code?: string
  expiry_date?: string
  status?: 'active' | 'inactive'
  created_at?: string
  product_uom_id: number
  branch_id: number
  owner_ref?: string
  stage?: string
  location_ref?: string
  product_uom?: {
    id: number
    code?: string
    product?: {
      id: number
      name: string
      type?: string
      conversions?: ConversionEntry[]
      product_category?: { id: number; name: string }
    }
    uom?: { id: number; name: string; code: string }
  }
  product_uom_batch?: {
    id: number
    code?: string
    batch_code?: string
    expiry_date?: string
    product_uom?: {
      id: number
      code?: string
      product?: {
        id: number
        name: string
        type?: string
        conversions?: ConversionEntry[]
        product_category?: { id: number; name: string }
      }
      uom?: { id: number; name: string; code: string }
    }
  }
  branch?: { id: number; name: string; code?: string }
}

export default function ProductInventoriesView({ defaultType }: { defaultType?: string }) {
  const queryClient = useQueryClient()
  const { user, hasPermission } = useAuth()
  const activeProductTypes = useActiveBranchProductTypes()
  const allowedTypes = activeProductTypes
    ? activeProductTypes.split(',').map((s) => s.trim().toLowerCase())
    : null

  const allTypeOptions = [
    { value: 'raw', label: 'Raw' },
    { value: 'wip', label: 'WIP' },
    { value: 'final', label: 'Final' },
    { value: 'supply', label: 'Supply' },
  ]

  const availableTypeOptions = allowedTypes
    ? allTypeOptions.filter(
      (o) =>
        allowedTypes.includes(o.value) ||
        (o.value === 'supply' && allowedTypes.includes('supplies')),
    )
    : allTypeOptions

  const canRead = hasPermission("product-inventory.read");
  const canCreate = hasPermission('product-inventory.create')
  const canEdit = hasPermission('product-inventory.update')
  const canDelete = hasPermission('product-inventory.delete')
  // Adjust stock = membuat stock movement, jadi mengikuti izin stock-movement
  const canAdjustStock = hasPermission('stock-movement.create')
  const canViewStockMovement = hasPermission('stock-movement.read')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(20)
  const [stockGte, setStockGte] = useState<string>('')
  const [stockLte, setStockLte] = useState<string>('')
  const [expiryDateGte, setExpiryDateGte] = useState<string>('')
  const [expiryDateLte, setExpiryDateLte] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('active')
  const [branchTypeFilter, setBranchTypeFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('')
  const [typeFilter, setTypeFilter] = useState<string | ''>(defaultType ?? '')
  const [ownerRefFilter, setOwnerRefFilter] = useState<(number | string)[]>([])
  const [stageFilter, setStageFilter] = useState<(number | string)[]>([])
  const [locationRefFilter, setLocationRefFilter] = useState<(number | string)[]>([])
  useEffect(() => {
    if (defaultType !== undefined) {
      setTypeFilter(defaultType)
    }
  }, [defaultType])
  const [debouncedStockGte, setDebouncedStockGte] = useState<string>('')
  const [debouncedStockLte, setDebouncedStockLte] = useState<string>('')
  const [debouncedExpiryDateGte, setDebouncedExpiryDateGte] = useState<string>('')
  const [debouncedExpiryDateLte, setDebouncedExpiryDateLte] = useState<string>('')
  const [debouncedOwnerRef, setDebouncedOwnerRef] = useState<(number | string)[]>([])
  const [debouncedStage, setDebouncedStage] = useState<(number | string)[]>([])
  const [debouncedLocationRef, setDebouncedLocationRef] = useState<(number | string)[]>([])
  // On by default; sent to the API so pagination counts only non-empty batches.
  const [hideEmpty, setHideEmpty] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<ProductInventory | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  // Baris yang sedang di-adjust — membuka Record Movement sheet dgn batch terpilih
  const [adjustItem, setAdjustItem] = useState<ProductInventory | null>(null)
  const [dimensionItem, setDimensionItem] = useState<ProductInventory | null>(null)

  // Gaya tombol ikon di kolom aksi (seragam untuk semua tombol baris)
  const actionBtnStyle: React.CSSProperties = {
    padding: 6,
    background: 'none',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    color: 'var(--foreground-muted)',
    display: 'flex',
  }

  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  // Not persisted: every visit opens in 'branch' mode (stock shown in the
  // product-UOM matching the user's branch.type). Smallest/Largest only
  // apply until the user leaves the page.
  const userBranchType = ((user as any)?.branch?.type as string | undefined) ?? ''
  const [unitMode, setUnitMode] = useState<UnitDisplayMode>('branch')
  // Switching Stock submenus (Raw / WIP / Final / Supplies) only changes
  // ?type=, so this view stays mounted — reset the mode on each switch.
  useEffect(() => {
    setUnitMode('branch')
  }, [defaultType])

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setDebouncedStockGte(stockGte)
      setDebouncedStockLte(stockLte)
      setDebouncedExpiryDateGte(expiryDateGte)
      setDebouncedExpiryDateLte(expiryDateLte)
      setDebouncedOwnerRef(ownerRefFilter)
      setDebouncedStage(stageFilter)
      setDebouncedLocationRef(locationRefFilter)
    }, 500)
    return () => clearTimeout(t)
  }, [search, stockGte, stockLte, expiryDateGte, expiryDateLte, ownerRefFilter, stageFilter, locationRefFilter])

  const handleExport = async () => {
    try {
      setIsExporting(true)
      const response = await productInventoriesService.exportExcel(filterParams as any)

      const blob = new Blob([response.data], {
        type:
          'application/vnd.openxmlformats-' +
          'officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `product-inventories-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Export downloaded successfully')
    } catch (err) {
      toast.error('Failed to export')
    } finally {
      setIsExporting(false)
    }
  }

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, debouncedStockGte, debouncedStockLte, debouncedExpiryDateGte, debouncedExpiryDateLte, categoryFilter, typeFilter, debouncedOwnerRef, debouncedStage, debouncedLocationRef, hideEmpty, statusFilter, branchTypeFilter])


  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories-all'],
    queryFn: () =>
      productCategoriesService
        .list({ per_page: 1000 })
        .then((r) => r.data),
  })
  const categories = (categoriesData as any)?.data ?? []

  // Companies for Owner filter
  const { data: companiesData } = useQuery({
    queryKey: ['companies-all'],
    queryFn: () => companiesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const companies: { id: number; name: string }[] = (companiesData as any)?.data ?? []
  const ownerOptions = [
    { value: 'GENERAL', label: 'General (Umum)' },
    ...companies.map((c) => ({ value: String(c.id), label: c.name })),
  ]

  // Stages for Stage filter
  const { data: stagesData } = useQuery({
    queryKey: ['stages-all'],
    queryFn: () => api.get('/stages', { params: { per_page: 100 } }).then((r) => r.data),
  })
  const stages: { code?: string; name: string }[] = (stagesData as any)?.data ?? []
  const stageOptions = stages.length > 0
    ? stages.map((s) => ({ value: s.code || s.name, label: s.name }))
    : [
        { value: 'GENERAL', label: 'General' },
        { value: 'RAW', label: 'Raw' },
        { value: 'WIP', label: 'WIP' },
        { value: 'FINISHED', label: 'Finished' },
        { value: 'CHILLED', label: 'Chilled' },
        { value: 'NORMAL', label: 'Normal' },
      ]

  // Tipe produk yang diizinkan branch/company aktif ("raw,wip,...").
  const activeTypeList = (activeProductTypes ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  // Nilai untuk filter[product_type] di API — hanya boleh SATU nilai
  // (nilai berkoma menghasilkan 0 baris).
  const requestedType =
    typeFilter !== ''
      ? String(typeFilter)
      : activeTypeList.length === 1
        ? activeTypeList[0]
        : ''

  // The API has no "stock > 0" filter: hide-empty sends the smallest positive
  // stock_gte (or the user's own minimum, whichever is higher).
  const HIDE_EMPTY_MIN = 0.0001
  const effectiveStockGte = hideEmpty
    ? String(Math.max(HIDE_EMPTY_MIN, Number(debouncedStockGte) || 0))
    : debouncedStockGte

  // Shared by the list query and the Excel export so both apply the same filters.
  const filterParams = {
    'filter[search]': debouncedSearch || undefined,
    // Default hanya inventori aktif (kolom Status sudah tidak ditampilkan).
    'filter[status]': statusFilter || undefined,
    'filter[branch_type]': branchTypeFilter || undefined,
    'filter[stock_gte]': effectiveStockGte || undefined,
    'filter[stock_lte]': debouncedStockLte || undefined,
    'filter[expiry_date_gte]': debouncedExpiryDateGte || undefined,
    'filter[expiry_date_lte]': debouncedExpiryDateLte || undefined,
    'filter[product_category_id]': categoryFilter === '' ? undefined : String(categoryFilter),
    // Backend hanya menerima SATU nilai untuk filter[product_type] —
    // nilai berkoma ("raw,wip,final,supply") menghasilkan 0 baris.
    // Kirim hanya saat tipe tunggal; multi-tipe disaring di FE (lihat items).
    'filter[product_type]': requestedType || undefined,
    'filter[owner_refs]': debouncedOwnerRef.length > 0 ? debouncedOwnerRef.join(',') : undefined,
    'filter[stages]': debouncedStage.length > 0 ? debouncedStage.join(',') : undefined,
    'filter[location_refs]': debouncedLocationRef.length > 0 ? debouncedLocationRef.join(',') : undefined,
  }

  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['product-inventories', page, perPage, debouncedSearch, effectiveStockGte, debouncedStockLte, debouncedExpiryDateGte, debouncedExpiryDateLte, categoryFilter, typeFilter, activeProductTypes, debouncedOwnerRef, debouncedStage, debouncedLocationRef, statusFilter, branchTypeFilter],
    queryFn: () =>
      productInventoriesService
        .list({
          page,
          per_page: perPage,
          sort: '-id',
          include: 'branch,product_uom_batch,product_uom,product,uom',
          ...filterParams,
        } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const rawItems: ProductInventory[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta
  // Multi-tipe tidak bisa difilter di API (lihat requestedType), jadi baris
  // halaman ini disaring di FE. Baris tanpa info tipe tetap ditampilkan.
  const needsClientTypeFilter = typeFilter === '' && activeTypeList.length > 1
  const activeTypeKey = activeTypeList.join(',')
  const items = useMemo(() => {
    if (!needsClientTypeFilter) return rawItems
    const allowed = new Set(activeTypeKey.split(',').filter(Boolean))
    return rawItems.filter((row) => {
      const t = (
        row.product_uom_batch?.product_uom?.product?.type ??
        row.product_uom?.product?.type ??
        ''
      ).toLowerCase()
      return t ? allowed.has(t) : true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawItems, needsClientTypeFilter, activeTypeKey])

  const { data: puData } = useQuery({
    queryKey: ['product-uoms-all', activeProductTypes],
    queryFn: () =>
      productUomsService
        .list({ per_page: 1000, include: 'product,uom', 'filter[product_types]': activeProductTypes } as any)
        .then((r) => r.data),
  })
  const productUomsAll = (puData as any)?.data ?? []
  const getProductUom = (id: number) =>
    productUomsAll.find((pu: any) => pu.id === id)

  // Branch-type display (shared with Stock Movements' Balance column).
  const { toBranchUnit } = useBranchUomDisplay(productUomsAll)

  const filteredItems = items.filter((i) => {
    const currentStock = Number(i.stock ?? i.qty ?? 0)
    if (hideEmpty && currentStock <= 0) return false
    const puFallback = getProductUom(i.product_uom_id)
    const productObj =
      i.product_uom_batch?.product_uom?.product ??
      i.product_uom?.product ??
      puFallback?.product
    if (!isProductTypeAllowed(productObj, activeProductTypes)) return false
    return true
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productInventoriesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      toast.success('Inventory item deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 24,
              fontWeight: 500,
              margin: 0,
              color: 'var(--foreground)',
            }}
          >
            {defaultType === 'raw' ? 'Raw Material Inventory' :
              defaultType === 'wip' ? 'WIP Inventory' :
                defaultType === 'final' ? 'Finish Good Inventory' :
                  defaultType === 'supply' ? 'Supplies Inventory' :
                    'Product Inventory'}
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--foreground-muted)',
              margin: '4px 0 0 0',
            }}
          >
            Track stock levels per product and branch
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--foreground)',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              opacity: isExporting ? 0.7 : 1,
            }}
          >
            {isExporting ? (
              <Loader2
                size={14}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            ) : (
              <Download size={14} />
            )}
            <span>{isExporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>
        </div>
      </div>
      {/* Toolbar */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search inventory..."
        activeCount={countActive(
          statusFilter !== 'active', categoryFilter, defaultType ? '' : typeFilter,
          stockGte, stockLte, expiryDateGte, expiryDateLte,
          ownerRefFilter, stageFilter, locationRefFilter,
          branchTypeFilter,
        )}
        onClear={() => {
          setStatusFilter('active')
          setCategoryFilter('')
          setTypeFilter(defaultType ?? '')
          setStockGte('')
          setStockLte('')
          setExpiryDateGte('')
          setExpiryDateLte('')
          setOwnerRefFilter([])
          setStageFilter([])
          setLocationRefFilter([])
          setBranchTypeFilter('')
          setPage(1)
        }}
        quick={
          <>
            <ActiveSegment
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v)
                setPage(1)
              }}
              active="active"
              inactive="inactive"
              label="Inventory status"
            />
            <FilterSelect
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value === '' ? '' : Number(e.target.value))
                setPage(1)
              }}
              style={{ maxWidth: 180 }}
            >
              <option value="">All Categories</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FilterSelect>
            {!defaultType && (
              <FilterSelect
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value)
                  setPage(1)
                }}
                style={{ maxWidth: 160 }}
              >
                <option value="">All Types</option>
                {availableTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </FilterSelect>
            )}
          </>
        }
        actions={
          <>
            {/* Unit display mode toggle */}
            <div
              role="group"
              aria-label="Unit display mode"
              style={{
                display: 'inline-flex',
                flexShrink: 0,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: 'var(--surface-raised)',
              }}
            >
              {([
                { key: 'smallest', label: 'Smallest', hint: 'base_qty + base_uom (e.g. 4.200 GR)' },
                { key: 'largest', label: 'Largest', hint: 'convert to largest UOM (e.g. 1 PACK)' },
                { key: 'branch', label: 'Branch Type', hint: 'convert ke UOM sesuai branch type kamu (e.g. 50 KG)' },
              ] as { key: UnitDisplayMode; label: string; hint: string }[]).map((opt) => {
                const active = unitMode === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setUnitMode(opt.key)}
                    title={opt.hint}
                    style={{
                      padding: '8px 12px',
                      border: 'none',
                      background: active ? 'var(--accent)' : 'transparent',
                      color: active ? 'white' : 'var(--foreground-muted)',
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            {/* Hide empty batches toggle */}
            <button
              onClick={() => setHideEmpty(!hideEmpty)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 36,
                padding: '0 12px',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                background: hideEmpty ? 'var(--accent-light-bg)' : 'var(--surface)',
                border: `1px solid ${hideEmpty ? 'var(--accent-light)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                fontWeight: 500,
                color: hideEmpty ? 'var(--accent)' : 'var(--foreground-muted)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <Boxes size={13} />
              Hide empty batches
            </button>
          </>
        }
      >
        <FilterGroup title="Stock">
          <FilterField label="Stock range">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FilterInput
                type="number"
                value={stockGte}
                onChange={(e) => setStockGte(e.target.value)}
                placeholder="Min stock"
                style={{ flex: 1, minWidth: 0 }}
              />
              <span style={{ color: 'var(--foreground-subtle)', fontSize: 12 }}>–</span>
              <FilterInput
                type="number"
                value={stockLte}
                onChange={(e) => setStockLte(e.target.value)}
                placeholder="Max stock"
                style={{ flex: 1, minWidth: 0 }}
              />
            </div>
          </FilterField>
          <FilterField label="Expiry date">
            <DateRange
              from={expiryDateGte}
              to={expiryDateLte}
              onFromChange={setExpiryDateGte}
              onToChange={setExpiryDateLte}
            />
          </FilterField>
        </FilterGroup>
        <FilterGroup title="Dimensions">
          <FilterField label="Owner">
            <MultiSearchableSelect
              value={ownerRefFilter}
              onChange={setOwnerRefFilter}
              options={ownerOptions}
              placeholder="Semua Owner"
              searchPlaceholder="Cari owner..."
            />
          </FilterField>
          <FilterField label="Stage">
            <MultiSearchableSelect
              value={stageFilter}
              onChange={setStageFilter}
              options={stageOptions}
              placeholder="Semua Stage"
              searchPlaceholder="Cari stage..."
            />
          </FilterField>
          <FilterField label="Location">
            <MultiSearchableSelect
              value={locationRefFilter}
              onChange={setLocationRefFilter}
              options={[{ value: 'GENERAL', label: 'General' }]}
              placeholder="Semua Lokasi"
              searchPlaceholder="Cari lokasi..."
            />
          </FilterField>
        </FilterGroup>
        <FilterGroup title="Branches">
          <FilterField label="Branch type">
            <FilterSelect
              block
              value={branchTypeFilter}
              onChange={(e) => {
                setBranchTypeFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All Branch Types</option>
              <option value="warehouse">Warehouse</option>
              <option value="production">Production</option>
              <option value="outlet">Outlet</option>
              <option value="other">Other</option>
            </FilterSelect>
          </FilterField>
        </FilterGroup>
      </FilterBar>
      {/* Summary bar */}
      {meta && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '10px 16px',
            background: 'var(--background)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            fontSize: 12,
            color: 'var(--foreground-muted)',
          }}
        >
          <span>Total items: {meta?.total ?? 0}</span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span>
            {filteredItems.length} listed
          </span>
        </div>
      )}
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
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--border)',
                background: 'var(--background)',
              }}
            >
              {[
                { label: 'No.', width: 50 },
                { label: 'Product', width: undefined },
                { label: 'UOM', width: 100 },
                { label: 'Packaging (Largest - Smallest)', width: 150 },
                { label: 'Batch Code', width: 160 },
                { label: 'Stage', width: 110 },
                { label: 'Qty', width: 100 },
                { label: '', width: 110 },
              ].map(({ label, width }, i) => (
                <th
                  key={i}
                  style={{
                    padding: '10px 16px',
                    textAlign: label === 'No.' ? 'center' : 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--foreground-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    width,
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    {[60, 40, 80, 50, 70].map((w, i) => (
                      <div
                        key={i}
                        style={{
                          height: 16,
                          borderRadius: 4,
                          background: 'var(--border)',
                          width: `${w}%`,
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                    ))}
                  </div>
                </td>
              </tr>
            )}

            {isError && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    textAlign: 'center',
                    padding: 48,
                    fontSize: 13,
                    color: 'var(--destructive)',
                  }}
                >
                  Failed to load inventory
                </td>
              </tr>
            )}

            {!isLoading && !isError && filteredItems.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div
                    style={{
                      padding: 48,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Boxes size={32} style={{ color: 'var(--foreground-subtle)' }} />
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                      No inventory items found
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              filteredItems.map((item, idx) => {
                const conversions: ConversionEntry[] | undefined =
                  item.product_uom_batch?.product_uom?.product?.conversions ??
                  item.product_uom?.product?.conversions ??
                  undefined
                const baseQty = item.base_stock ?? item.stock ?? item.qty ?? 0
                const baseUomCode = item.base_uom_code ??
                  item.product_uom_batch?.product_uom?.uom?.code ??
                  item.product_uom?.uom?.code ?? ''
                const puFallback = getProductUom(item.product_uom_id)

                // Convert a base-unit qty into the display unit of the active
                // mode.
                //   largest: walk the conversion chain from base → top, dividing
                //            by each amount; falls back to base if incomplete.
                //   branch : convert base → the product-UOM whose branch_types
                //            contain the user's branch.type; falls back to base
                //            if the product has no matching UOM / conversion.
                //   smallest: no match, so the base unit is returned as-is.
                const toDisplayUnit = (value: number): { qty: number; unit: string } => {
                  if (unitMode === 'largest' && conversions && conversions.length > 0) {
                    let qty = value
                    let unit = baseUomCode
                    const chain = [...conversions].sort((a, b) => a.amount - b.amount)
                    for (const step of chain) {
                      const next = qty / step.amount
                      if (next < 1) break
                      qty = next
                      unit = step.uom_code
                    }
                    return { qty, unit }
                  }
                  if (unitMode === 'branch' && userBranchType) {
                    const productId =
                      item.product_uom_batch?.product_uom?.product?.id ??
                      item.product_uom?.product?.id ??
                      puFallback?.product?.id
                    return toBranchUnit(value, baseUomCode, productId, conversions)
                  }
                  return { qty: value, unit: baseUomCode }
                }

                // `toDisplayUnit` falls back to the base unit for "smallest"
                // mode, so one call covers every mode. The UOM column reads
                // `stockUnit`, so both cells always agree.
                const stock = toDisplayUnit(baseQty)
                const stockUnit = stock.unit
                const stockDisplay = `${stock.qty.toLocaleString('id-ID', { maximumFractionDigits: 2 })} ${stock.unit}`

                // A row is "low" when nothing is left to sell.
                const isLow = availableStockOf(item) <= 0

                return (
                  <tr
                    key={item.id}
                    onMouseEnter={() => setHoveredRow(item.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background:
                        hoveredRow === item.id
                          ? 'var(--background)'
                          : isLow
                            ? 'rgba(146, 96, 10, 0.03)'
                            : 'transparent',
                    }}
                  >
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13, width: 50 }}>
                      {(page - 1) * perPage + idx + 1}
                    </td>
                    {/* Product */}
                    <td style={{ padding: '12px 16px' }}>
                      <div>
                        <div
                          style={{
                            fontWeight: 500,
                            fontSize: 14,
                            color: 'var(--foreground)',
                          }}
                        >
                          {getProductUomName(item.product_uom_batch?.product_uom, undefined)
                            || getProductUomName(item.product_uom, undefined)
                            || getProductUomName(puFallback, undefined)
                            || item.product_uom_batch?.product_uom?.code
                            || item.product_uom?.code
                            || puFallback?.code
                            || `Item #${item.id}`}
                        </div>
                        {(() => {
                          // Product UoM code (SKU), else the product code, then the
                          // inventory code when it differs.
                          const pu = item.product_uom_batch?.product_uom ?? item.product_uom ?? puFallback
                          const skuCode = pu?.code || (pu?.product as any)?.code
                          const codes = [skuCode, item.code !== skuCode ? item.code : null].filter(Boolean)
                          return codes.length > 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--foreground-muted)', fontVariantNumeric: 'tabular-nums' }}>
                              {codes.join(' · ')}
                            </div>
                          ) : null
                        })()}
                      </div>
                    </td>
                    {/* UOM */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '2px 8px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--foreground-muted)',
                        }}
                      >
                        {stockUnit || '—'}
                      </span>
                    </td>
                    {/* Packaging — conversion chain from the largest unit down,
                        e.g. "1 PACK → 6 PCS → 12 KG → 12.000 GR" */}
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        color: 'var(--foreground-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {(() => {
                        const chains = packagingChains(conversions)
                        return chains.length > 0
                          ? chains.map((chain, i) => <div key={i}>{chain}</div>)
                          : '—'
                      })()}
                    </td>
                    {/* Batch Code */}
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      {canRead ? item.product_uom_batch?.batch_code ?? '—' : "***"}
                    </td>
                    {/* Stage */}
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      {/* Change dimension — klik nama stage untuk pindah stage
                          (endpoint sama dgn Dimension Transfer) */}
                      {canAdjustStock && (item.display_qty ?? item.stock ?? item.qty ?? 0) > 0 ? (
                        <button
                          title="Ubah stage (Change Dimension)"
                          onClick={() => setDimensionItem(item)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: 0,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 13,
                            fontFamily: 'var(--font-sans)',
                            color: 'var(--accent-light)',
                            fontWeight: 600,
                            textDecoration: 'underline',
                            textUnderlineOffset: 3,
                          }}
                        >
                          <span className="v2-link">{item.stage ? item.stage.toUpperCase() : '—'}</span>
                          <Pencil size={12} />
                        </button>
                      ) : item.stage ? (
                        item.stage.toUpperCase()
                      ) : (
                        '—'
                      )}
                    </td>
                    {/* Qty / System Stock */}
                    <td style={{ padding: '12px 16px' }}>
                      {/* Highlighted pill: bold number + smaller unit; amber when nothing is left. */}
                      <span
                        title={stockDisplay}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'baseline',
                          gap: 4,
                          padding: '4px 10px',
                          borderRadius: 999,
                          whiteSpace: 'nowrap',
                          background: isLow ? 'var(--warning-bg)' : 'var(--accent-light-bg)',
                          border: `1px solid ${isLow ? 'var(--warning)' : 'rgba(198, 139, 78, 0.3)'}`,
                          color: isLow ? 'var(--warning)' : 'var(--accent)',
                        }}
                      >
                        <span style={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          {stock.qty.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' }}>{stock.unit}</span>
                      </span>
                    </td>

                    <>
                      {/* Actions */}
                      <td style={{ padding: '12px 16px' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            justifyContent: 'flex-end',
                          }}
                        >
                          {/* Adjust stock — sheet Record Movement, product sudah terpilih */}
                          {canAdjustStock && (
                            <button
                              title="Adjust Stock"
                              onClick={() => setAdjustItem(item)}
                              style={{ ...actionBtnStyle, color: 'var(--accent)' }}
                            >
                              <SlidersHorizontal size={14} />
                            </button>
                          )}
                          {/* Show stock movement — redirect dgn filter product inventory (batch) baris ini */}
                          {canViewStockMovement && (
                            <Link
                              href={`/products/product-inventory/stock-movements?product_inventory_id=${item.id}`}
                              title="Show Stock Movement"
                              style={{ ...actionBtnStyle, color: 'var(--info)' }}
                            >
                              <History size={14} />
                            </Link>
                          )}
                          {canEdit && (<button
                            onClick={() => {
                              setEditData(item)
                              setSheetOpen(true)
                            }}
                            style={{
                              padding: 6,
                              background: 'none',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              color: 'var(--foreground-muted)',
                              display: 'flex',
                            }}>
                            <Pencil size={14} />
                          </button>)}
                          {canDelete && (<button
                            onClick={() => setDeleteConfirmId(item.id)}
                            style={{
                              padding: 6,
                              background: 'none',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              color: 'var(--destructive)',
                              display: 'flex',
                            }}>
                            <Trash2 size={14} />
                          </button>)}
                        </div>
                      </td>
                    </>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
      {/* Delete confirm dialog */}
      {deleteConfirmId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={() => setDeleteConfirmId(null)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.25)',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 51,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              width: 360,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3
              style={{
                fontSize: 15,
                fontWeight: 600,
                margin: '0 0 8px',
                color: 'var(--foreground)',
              }}
            >
              Delete Inventory Item
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--foreground-muted)',
                margin: '0 0 20px',
              }}
            >
              This will remove the stock record for this product at this branch.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
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
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                style={{
                  padding: '8px 16px',
                  background: 'var(--destructive)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: deleteMutation.isPending ? 0.7 : 1,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Sheet */}
      <ProductInventorySheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setEditData(null)
        }}
        editData={editData}
      />
      {/* Adjust stock — Record Movement sheet dengan batch produk terpilih.
          Dirender hanya saat dibuka agar query inventori sheet tidak berjalan
          di setiap kunjungan halaman Product Inventory. */}
      {adjustItem && (
        <StockMovementSheet
          open
          onClose={() => setAdjustItem(null)}
          initialBatchId={adjustItem.product_uom_batch?.id ?? null}
        />
      )}
      {dimensionItem && (
        <ChangeDimensionModal inventory={dimensionItem} onClose={() => setDimensionItem(null)} />
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
