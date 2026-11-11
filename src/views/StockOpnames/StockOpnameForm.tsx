'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { stockOpnamesService } from '@/services/stock-opnames.service'
import { toastMutationApiError } from '@/utils/apiError'
import { Loader2 } from 'lucide-react'
import BackLink from '@/components/BackLink'

export default function StockOpnameForm() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [description, setDescription] = useState('')
  const [productType, setProductType] = useState('')

  const createMutation = useMutation({
    mutationFn: (payload: { date: string; description?: string; product_type?: string }) =>
      stockOpnamesService.create(payload),
    onSuccess: (res) => {
      const body = res.data as any
      const newOpname = body?.data ?? body
      const newId = newOpname?.id

      queryClient.invalidateQueries({ queryKey: ['stock-opnames'] })

      if (newId) {
        toast.success(`Stock Opname ${newOpname.code || ''} created. Please fill in the physical counts.`)
        router.push(`/products/product-inventory/stock-opname/${newId}`)
        return
      }

      toast.success('Stock Opname created. Open it from the list to fill in the counts.')
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
      product_type: productType || undefined,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, margin: '0 auto' }}>
      <BackLink href="/products/product-inventory/stock-opname" label="Stock Opnames" />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 600,
              margin: 0,
              color: 'var(--foreground)',
            }}
          >
            Create Stock Opname
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--foreground-muted)' }}>
            Fill in the details below, then count the physical stock
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          background: 'var(--surface)',
          padding: 24,
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)' }}>
            Opname Date <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              color: 'var(--foreground)',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)' }}>
            Product Type (Optional)
          </label>
          <select
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              color: 'var(--foreground)',
              outline: 'none',
            }}
          >
            <option value="">All Types</option>
            <option value="raw">Raw Material</option>
            <option value="wip">Work In Progress</option>
            <option value="final">Final Product</option>
            <option value="supply">Supply / Packaging</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)' }}>
            Description (Optional)
          </label>
          <textarea
            rows={3}
            placeholder="e.g. End of month physical inventory count..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              color: 'var(--foreground)',
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <p style={{ margin: 0, fontSize: 12, color: 'var(--foreground-muted)', lineHeight: 1.5 }}>
          After creating, the item list will appear automatically. Fill in the{' '}
          <strong>Counted Qty</strong> column, then click <strong>Save Progress</strong> and{' '}
          <strong>Complete</strong>.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => router.push('/products/product-inventory/stock-opname')}
            disabled={createMutation.isPending}
            style={{
              padding: '9px 16px',
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
            type="submit"
            disabled={createMutation.isPending || !date}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 20px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--accent)',
              background: 'var(--accent)',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              cursor: createMutation.isPending || !date ? 'not-allowed' : 'pointer',
              opacity: createMutation.isPending || !date ? 0.6 : 1,
            }}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Creating...
              </>
            ) : (
              'Create Stock Opname'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
