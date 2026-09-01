'use client'

import React, { useState,  useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productUomBatchesService } from '@/services/product-uom-batches.service'
import { productUomsService } from '@/services/product-uoms.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useActiveBranchProductTypes, isProductTypeAllowed } from '@/hooks/useProductTypes'
import SearchableSelect from '@/components/SearchableSelect'
import { X, Loader2 } from 'lucide-react'

const INCLUDE =
  'product_uom,product_uom.product,product_uom.product.product_category,product_uom.uom,created_by'

const schema = z.object({
  product_uom_id: z.coerce.number().min(1, 'Product UOM is required'),
  batch_code: z.string().optional(),
  expiry_date: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface ProductUomBatchSheetProps {
  open: boolean
  onClose: () => void
  batchId?: number | null
}

export default function ProductUomBatchSheet({
  open,
  onClose,
  batchId,
}: ProductUomBatchSheetProps) {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const queryClient = useQueryClient()
  const isEdit = !!batchId

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      product_uom_id: 0,
      batch_code: '',
      expiry_date: '',
    },
  })

  // Edit mode — fetch the batch being edited
  const { data: batchResp, isLoading: batchLoading } = useQuery({
    queryKey: ['product-uom-batch', batchId],
    enabled: open && isEdit,
    queryFn: () =>
      productUomBatchesService
        .findById(batchId as number, { include: INCLUDE })
        .then((r) => r.data),
  })
  const batch = (batchResp as any)?.data

  const activeProductTypes = useActiveBranchProductTypes()

  // Create mode — product UOMs for the picker (paginate all pages)
  const { data: puData, isLoading: puLoading } = useQuery({
    queryKey: ['product-uoms-all', activeProductTypes, debouncedDropdownSearch],
    enabled: open,
    queryFn: async () => {
      let all: any[] = []
      let p = 1
      let totalPages = 1
      do {
        const res = await productUomsService
          .list({ 'filter[search]': debouncedDropdownSearch || undefined,  page: p, per_page: 100, include: 'product,uom,product.product_category', 'filter[product_types]': activeProductTypes } as any)
          .then((r) => r.data)
        all = all.concat((res as any)?.data ?? [])
        totalPages =
          (res as any)?.meta?.last_page ??
          (res as any)?.meta?.total_pages ??
          1
        p += 1
      } while (p <= totalPages)
      return { data: all }
    },
  })
  const allProductUoms = (puData as any)?.data ?? []
  const productUoms = allProductUoms.filter((pu: any) => isProductTypeAllowed(pu.product, activeProductTypes))

  const productUomOptions = productUoms.map((pu: any) => ({
    value: pu.id as number,
    label: `${pu.product?.name ?? 'Product'} — ${
      pu.uom?.name ?? pu.uom?.code ?? 'UOM'
    }`,
    sublabel: pu.code ?? undefined,
  }))

  // Populate / reset the form whenever the sheet opens
  useEffect(() => {
    if (!open) return
    if (isEdit) {
      if (batch) {
        reset({
          product_uom_id:
            batch.product_uom_id ?? batch.product_uom?.id ?? 0,
          batch_code: batch.batch_code ?? '',
          expiry_date: batch.expiry_date
            ? String(batch.expiry_date).slice(0, 10)
            : '',
        })
      }
    } else {
      reset({ product_uom_id: 0, batch_code: '', expiry_date: '' })
    }
  }, [open, isEdit, batch, reset])

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const body: any = {
        product_uom_id: values.product_uom_id,
        expiry_date: values.expiry_date || null,
      }
      if (values.batch_code?.trim()) body.batch_code = values.batch_code.trim()
      return productUomBatchesService.create(body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-uom-batches'] })
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      toast.success('Batch created')
      reset()
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to create batch'),
  })

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const body: any = {
        product_uom_id: values.product_uom_id,
        expiry_date: values.expiry_date || null,
      }
      if (values.batch_code?.trim()) body.batch_code = values.batch_code.trim()
      return productUomBatchesService.update(batchId as number, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-uom-batches'] })
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      toast.success('Batch updated')
      reset()
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to update batch'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const onSubmit = (values: FormValues) => {
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch]);

    if (isEdit) updateMutation.mutate(values)
    else createMutation.mutate(values)
  }

  if (!open) return null

  const editProductName =
    batch?.product_uom?.product?.name ?? '—'
  const editUomName =
    batch?.product_uom?.uom?.name ?? batch?.product_uom?.uom?.code ?? '—'
  const editPuCode = batch?.product_uom?.code

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.18)',
        }}
      />

      {/* Sheet panel */}
      <div
        style={{
          position: 'relative',
          zIndex: 50,
          width: 460,
          height: '100%',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
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
                fontWeight: 500,
                margin: 0,
                color: 'var(--foreground)',
              }}
            >
              {isEdit ? 'Edit Batch' : 'New Batch'}
            </h2>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: 12,
                color: 'var(--foreground-muted)',
              }}
            >
              Track a production batch and its expiry date
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--foreground-muted)',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form body */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {isEdit && batchLoading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '40px 0',
                fontSize: 13,
                color: 'var(--foreground-muted)',
              }}
            >
              <Loader2
                size={16}
                style={{ animation: 'spin 1s linear infinite' }}
              />
              Loading batch...
            </div>
          ) : (
            <>
              {/* Product UOM */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--foreground)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  Product UOM
                </label>
                <Controller
                  name="product_uom_id"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? 0}
                      onChange={(v) => field.onChange(v)}
                      options={productUomOptions}
                      placeholder="Select product UOM"
                      searchPlaceholder="Search product UOM..."
                      loading={puLoading}
                      error={errors.product_uom_id?.message}
                      onSearchChange={setDropdownSearch}
/>
                  )}
                />
              </div>

              {/* Batch Code */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--foreground)',
                  }}
                >
                  Batch Code
                </label>
                <input
                  {...register('batch_code')}
                  type="text"
                  placeholder="Leave blank to auto-generate"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 14,
                    color: 'var(--foreground)',
                    background: 'var(--surface)',
                    outline: 'none',
                    fontFamily: 'var(--font-sans)',
                    boxSizing: 'border-box',
                  }}
                />
                <span
                  style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}
                >
                  Optional — the system will generate a code if left blank.
                </span>
              </div>

              {/* Expiry Date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--foreground)',
                  }}
                >
                  Expiry Date
                </label>
                <input
                  {...register('expiry_date')}
                  type="date"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 14,
                    color: 'var(--foreground)',
                    background: 'var(--surface)',
                    outline: 'none',
                    fontFamily: 'var(--font-sans)',
                    boxSizing: 'border-box',
                  }}
                />
                <span
                  style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}
                >
                  Optional — leave blank for batches with no expiry.
                </span>
              </div>
            </>
          )}
        </form>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
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
            type="button"
            disabled={isPending || (isEdit && batchLoading)}
            onClick={handleSubmit(onSubmit)}
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              color: 'white',
              cursor:
                isPending || (isEdit && batchLoading)
                  ? 'not-allowed'
                  : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: isPending || (isEdit && batchLoading) ? 0.7 : 1,
            }}
          >
            {isPending && (
              <Loader2
                size={14}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            )}
            {isEdit ? 'Save Changes' : 'Create Batch'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
