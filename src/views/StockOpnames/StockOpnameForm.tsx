'use client'
import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { stockOpnamesService } from '@/services/stock-opnames.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { branchesService } from '@/services/branches.service'
import { productCategoriesService } from '@/services/product-categories.service'
import { toastMutationApiError } from '@/utils/apiError'
import {
  Boxes,
  Loader2,
  Save,
  AlertCircle,
  ChevronLeft
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes, isProductTypeAllowed } from '@/hooks/useProductTypes'

export default function StockOpnameForm() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { user } = useAuth()
  const branchId = user?.branch_id ?? ''

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // selectedItems maps product_inventory_id to boolean
  const [selectedItems, setSelectedItems] = useState<Record<number, boolean>>({})

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 500)
    return () => clearTimeout(t)
  }, [search])

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories-all'],
    queryFn: () => productCategoriesService.list({ per_page: 100 }).then(r => r.data),
  })
  const categories = (categoriesData as any)?.data ?? []

  const activeProductTypes = useActiveBranchProductTypes()
  const allowedTypes = activeProductTypes
    ? activeProductTypes.split(',').map((s) => s.trim().toLowerCase())
    : null

  const allTypeOptions = [
    { value: 'raw', label: 'Raw Material' },
    { value: 'wip', label: 'Unfinish (WIP)' },
    { value: 'final', label: 'Finish Good' },
    { value: 'supply', label: 'Supplies' },
  ]

  const availableTypeOptions = allowedTypes
    ? allTypeOptions.filter(
        (o) =>
          allowedTypes.includes(o.value) ||
          (o.value === 'supply' && allowedTypes.includes('supplies')),
      )
    : allTypeOptions

  const { data: inventoryData, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['product-inventories', branchId, categoryFilter, debouncedSearch, typeFilter, activeProductTypes],
    queryFn: () =>
      productInventoriesService
        .list({
          page: 1,
          per_page: 500,
          include: 'product_uom,product_uom.product,product_uom_batch,product_uom_batch.product_uom,product_uom_batch.product_uom.product',
          'filter[branch_id]': branchId === '' ? undefined : String(branchId),
          'filter[search]': debouncedSearch || undefined,
          'filter[product_category_id]': categoryFilter === '' ? undefined : String(categoryFilter),
          'filter[product_types]': typeFilter === '' ? (activeProductTypes || undefined) : String(typeFilter),
        } as any)
        .then(r => r.data),
    enabled: branchId !== '',
  })
  const rawItems = (inventoryData as any)?.data ?? []
  const items = rawItems.filter((i: any) => {
    const productObj =
      i.product_uom_batch?.product_uom?.product ??
      i.product_uom?.product
    return isProductTypeAllowed(productObj, activeProductTypes)
  })

  const createMutation = useMutation({
    mutationFn: stockOpnamesService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-opnames'] })
      toast.success('Stock Opname created successfully')
      router.push('/products/product-inventory/stock-opname')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create Stock Opname'),
  })

  const handleSave = () => {
    const payloadItems = Object.entries(selectedItems)
      .filter(([_, isSelected]) => isSelected)
      .map(([id]) => ({
        product_inventory_id: Number(id),
      }))

    if (payloadItems.length === 0) {
      toast.error('Please select at least one item to opname')
      return
    }

    createMutation.mutate({
      date,
      description,
      details: payloadItems,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 20,
        }}
      >
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={() => router.back()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--foreground)',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={16} />
          </button>
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
              Create Stock Opname
            </h1>
            <p
              style={{
                fontSize: 13,
                color: 'var(--foreground-muted)',
                margin: '4px 0 0 0',
              }}
            >
              Fill in the form to start a new stock opname document
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={createMutation.isPending || Object.keys(selectedItems).filter(k => selectedItems[Number(k)]).length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: 'var(--primary)',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            fontWeight: 500,
            color: '#fff',
            cursor: createMutation.isPending || Object.keys(selectedItems).filter(k => selectedItems[Number(k)]).length === 0 ? 'not-allowed' : 'pointer',
            opacity: createMutation.isPending || Object.keys(selectedItems).filter(k => selectedItems[Number(k)]).length === 0 ? 0.6 : 1,
          }}
        >
          {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          <span>Save Document</span>
        </button>
      </div>

      {/* Main Form */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20,
          background: 'var(--surface)',
          padding: 24,
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle}>Date <span style={{ color: 'var(--destructive)' }}>*</span></label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle}>Branch</label>
          <div style={{ ...inputStyle, background: 'var(--surface)', color: 'var(--foreground-muted)' }}>
            {user?.branch?.name || '—'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Description (Optional)</label>
          <input
            type="text"
            placeholder="Opname reason or notes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Inventory Items Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
            Select Inventory Items
          </h3>
          <button
            type="button"
            onClick={() => {
              const allSelected = items.every((i: any) => selectedItems[i.id])
              const newSelected = { ...selectedItems }
              if (allSelected) {
                items.forEach((i: any) => delete newSelected[i.id])
              } else {
                items.forEach((i: any) => { newSelected[i.id] = true })
              }
              setSelectedItems(newSelected)
            }}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--primary)',
              background: 'var(--primary-light)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
            }}
          >
            {items.length > 0 && items.every((i: any) => selectedItems[i.id]) ? 'Deselect All' : 'Select All Listed'}
          </button>
        </div>

        {/* Filters for products */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            background: 'var(--surface)',
            padding: 16,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Product Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">All Types</option>
              {availableTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value === '' ? '' : Number(e.target.value))}
              style={inputStyle}
            >
              <option value="">All Categories</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Search Product</label>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Product Table */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                <th style={{ ...thStyle, width: 40, textAlign: 'center' }}>
                  #
                </th>
                <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>
                  Inc.
                </th>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>UOM</th>
                <th style={thStyle}>Batch Code</th>
                <th style={thStyle}>System Stock</th>
              </tr>
            </thead>
            <tbody>
              {branchId === '' ? (
                <tr>
                  <td colSpan={6} style={{ padding: 48 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <AlertCircle size={32} style={{ color: 'var(--foreground-muted)' }} />
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        Please select a branch to load inventory items.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : isLoadingInventory ? (
                <tr>
                  <td colSpan={6} style={{ padding: 48, textAlign: 'center' }}>
                    <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)', margin: '0 auto' }} />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 48 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <Boxes size={32} style={{ color: 'var(--foreground-muted)' }} />
                      <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                        No inventory found for this branch.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item: any, index: number) => {
                  const product = item.product_uom_batch?.product_uom?.product || item.product_uom?.product
                  const uom = item.product_uom_batch?.product_uom?.uom || item.product_uom?.uom
                  const batchCode = item.product_uom_batch?.batch_code || '—'
                  const isSelected = !!selectedItems[item.id]

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: isSelected ? 'var(--accent-light-bg)' : 'transparent'
                      }}
                    >
                      <td style={{ ...tdStyle, textAlign: 'center', width: 40, color: 'var(--foreground-muted)', fontSize: 12, fontWeight: 600 }}>
                        {index + 1}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const val = e.target.checked
                            if (!val) {
                              const newData = { ...selectedItems }
                              delete newData[item.id]
                              setSelectedItems(newData)
                            } else {
                              setSelectedItems({ ...selectedItems, [item.id]: true })
                            }
                          }}
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                            {product?.name || 'Unknown Product'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                            {item.code || '—'}
                          </span>
                        </div>
                      </td>
                      <td style={tdStyle}>{uom?.name || '—'}</td>
                      <td style={tdStyle}>{batchCode}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>
                          {(item.stock ?? 0).toLocaleString('id-ID')}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--foreground-muted)'
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  color: 'var(--foreground)',
  outline: 'none',
}

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
}

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 13,
  color: 'var(--foreground-muted)',
}
