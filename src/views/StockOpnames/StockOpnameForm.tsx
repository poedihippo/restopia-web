'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { stockOpnamesService } from '@/services/stock-opnames.service'
import { useAuth } from '@/hooks/useAuth'
import { toastMutationApiError } from '@/utils/apiError'
import {
  ChevronLeft,
  Loader2,
  Sparkles,
  Building,
  Boxes,
} from 'lucide-react'

export default function StockOpnameForm() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [description, setDescription] = useState('')
  const [productCategoryId, setProductCategoryId] = useState<number | ''>('')
  const [productType, setProductType] = useState('')

  const createMutation = useMutation({
    mutationFn: (payload: { date: string; description?: string; product_category_id?: number; product_type?: string }) =>
      stockOpnamesService.create(payload),
    onSuccess: (res) => {
      const body = res.data as any
      // API may return { data: { id, code, ... } } or only { message }
      const newOpname = body?.data ?? body
      const newId = newOpname?.id

      queryClient.invalidateQueries({ queryKey: ['stock-opnames'] })

      if (newId) {
        toast.success(`Stock Opname ${newOpname.code || ''} created.`)
        router.push(`/products/product-inventory/stock-opname/${newId}`)
        return
      }

      toast.success('Stock Opname created. Open the latest document from the list to start counting.')
      router.push('/products/product-inventory/stock-opname')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create Stock Opname'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!date) {
      toast.error('Date is required')
      return
    }

    createMutation.mutate({
      date,
      description: description.trim() || undefined,
      product_category_id: productCategoryId !== '' ? Number(productCategoryId) : undefined,
      product_type: productType || undefined,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 880, margin: '0 auto' }}>
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
            onClick={() => router.push('/products/product-inventory/stock-opname')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--foreground)',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 24,
                fontWeight: 600,
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
              Initialize a physical stock opname session for your branch
            </p>
          </div>
        </div>
      </div>

      {/* ERP Info Banner */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          padding: 20,
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.05) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-md)',
            background: 'var(--primary)',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          <Boxes size={22} />
        </div>
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--foreground)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Automated ERP Count Sheet Generation
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--primary-light, rgba(99, 102, 241, 0.15))',
                color: 'var(--primary)',
                fontWeight: 600,
              }}
            >
              ERP Master Snapshot
            </span>
          </h3>
          <p
            style={{
              margin: '6px 0 0 0',
              fontSize: 13,
              color: 'var(--foreground-muted)',
              lineHeight: 1.5,
            }}
          >
            Count lines are now automatically generated from your branch&apos;s product inventory
            master list. The system will snapshot all active product UoM batches and dimensions,
            generating the count sheet ready for physical counting.
          </p>
        </div>
      </div>

      {/* Form Card */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          background: 'var(--surface)',
          padding: 28,
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
          }}
        >
          {/* Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>
              Opname Date <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="input-opname-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
            <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              Scheduled date for physical counting
            </span>
          </div>

          {/* Branch (Read Only) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Branch</label>
            <div
              style={{
                ...inputStyle,
                background: 'var(--surface-muted, rgba(0,0,0,0.02))',
                color: 'var(--foreground)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Building size={16} style={{ color: 'var(--foreground-muted)' }} />
              <span style={{ fontWeight: 500 }}>{user?.branch?.name || 'Active Branch'}</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              Count sheet will be created for this branch
            </span>
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Description / Notes (Optional)</label>
            <textarea
              id="input-opname-description"
              rows={3}
              placeholder="e.g. End of month physical inventory count, quarterly warehouse audit..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                ...inputStyle,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Product Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Product Type (Optional)</label>
            <select
              id="input-opname-product-type"
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              style={inputStyle}
            >
              <option value="">All Types</option>
              <option value="raw">Raw Material</option>
              <option value="wip">Work In Progress</option>
              <option value="final">Final Product</option>
              <option value="supply">Supply / Packaging</option>
            </select>
            <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              Filter which product type to count
            </span>
          </div>

          {/* Product Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Product Category (Optional)</label>
            <input
              id="input-opname-category-id"
              type="number"
              min={1}
              placeholder="Category ID (e.g. 1 = MATERIAL)"
              value={productCategoryId}
              onChange={(e) => setProductCategoryId(e.target.value ? Number(e.target.value) : '')}
              style={inputStyle}
            />
            <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              Leave empty for all categories
            </span>
          </div>
        </div>

        {/* Submit Action */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            borderTop: '1px solid var(--border)',
            paddingTop: 20,
            marginTop: 8,
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            disabled={createMutation.isPending}
            style={{
              padding: '9px 18px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--foreground)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            id="btn-generate-opname"
            type="submit"
            disabled={createMutation.isPending || !date}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 22px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--primary)',
              background: 'var(--primary)',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              cursor: createMutation.isPending || !date ? 'not-allowed' : 'pointer',
              opacity: createMutation.isPending || !date ? 0.6 : 1,
              boxShadow: '0 2px 4px rgba(99, 102, 241, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Generating Count Sheet...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Generate Count Sheet</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  color: 'var(--foreground)',
  outline: 'none',
  transition: 'border-color 0.15s ease',
}
