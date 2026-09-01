'use client'

import React, { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { priceListsService } from '@/services/price-lists.service'
import { toastMutationApiError } from '@/utils/apiError'
import { X, Loader2, Plus, Trash } from 'lucide-react'
import useGetProductUomsList from '@/hooks/product-uoms/useGetProductUomsList'
import SearchableSelect from '@/components/SearchableSelect'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes, isProductTypeAllowed } from '@/hooks/useProductTypes'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const schema = z.object({
  items: z.array(z.object({
    id: z.number().optional(),
    product_uom_id: z.number().min(1, 'Product UOM is required'),
    base_price: z.number().min(0, 'Must be at least 0'),
    online_price: z.number().min(0, 'Must be at least 0'),
    franchise_price: z.number().min(0, 'Must be at least 0'),
  })).min(1, 'At least one item is required'),
})

type FormValues = z.infer<typeof schema>

interface PriceListItemSheetProps {
  priceListId: number
  open: boolean
  onClose: () => void
  editData?: { id: number; product_uom_id: number; base_price: number; online_price: number; franchise_price: number } | null
}

export default function PriceListItemSheet({ priceListId, open, onClose, editData }: PriceListItemSheetProps) {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canReadFranchisePrice = hasPermission('common.franchise-price.read')

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { items: [] },
  })

  const activeProductTypes = useActiveBranchProductTypes()
  const { data: productUomData, isLoading: isLoadingProductUom } = useGetProductUomsList({ include: 'product,uom,product.product_category' }, { enabled: open })

  useEffect(() => {
    if (open) {
      if (editData) {
        reset({ items: [editData] })
      } else {
        reset({ items: [{ product_uom_id: 0, base_price: 0, online_price: 0, franchise_price: 0 }] })
      }
    }
  }, [editData, reset, open])

  const items = watch('items')

  const upsertMutation = useMutation({
    mutationFn: (data: FormValues) => priceListsService.bulkUpsertItems(priceListId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-list-items', priceListId] })
      toast.success(editData ? 'Item updated' : 'Items saved')
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to save items'),
  })

  const onSubmit = (values: FormValues) => {
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch]);

    upsertMutation.mutate(values)
  }

  if (!open) return null

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
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />

      <div
        style={{
          position: 'relative',
          zIndex: 50,
          width: 600,
          height: '100%',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
            {editData ? 'Edit Price List Item' : 'New Price List Items'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <form id="items-form" onSubmit={handleSubmit(onSubmit)} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {items.map((item, index) => (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, border: '1px solid var(--border)', borderRadius: 8, position: 'relative' }}>
              {!editData && items.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const newItems = [...items]
                    newItems.splice(index, 1)
                    setValue('items', newItems)
                  }}
                  style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--destructive)' }}
                >
                  <Trash size={16} />
                </button>
              )}
              
              <div className="flex flex-col gap-2">
                <Label>Product UOM *</Label>
                <Controller
                  control={control}
                  name={`items.${index}.product_uom_id`}
                  render={({ field, fieldState }) => (
                    <>
                      <SearchableSelect
                        disabled={!!editData}
                        loading={isLoadingProductUom}
                        placeholder="Select product UOM..."
                        options={productUomData?.data
                          ?.filter((uom: any) => isProductTypeAllowed(uom.product, activeProductTypes))
                          ?.map((uom: any) => ({
                            value: uom.id,
                            label: `${uom.product?.name} - ${uom.uom?.code}`,
                          })) ?? []}
                        value={field.value ?? 0}
                        onChange={field.onChange}
                        onSearchChange={setDropdownSearch}
/>
                      {fieldState.error && <p className="text-destructive text-xs">{fieldState.error.message}</p>}
                    </>
                  )}
                />
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <Label>Offline Price *</Label>
                  <Controller
                    control={control}
                    name={`items.${index}.base_price`}
                    render={({ field, fieldState }) => (
                      <>
                        <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} />
                        {fieldState.error && <p className="text-destructive text-xs">{fieldState.error.message}</p>}
                      </>
                    )}
                  />
                </div>
                
                <div className="flex flex-col gap-2 flex-1">
                  <Label>Online Price *</Label>
                  <Controller
                    control={control}
                    name={`items.${index}.online_price`}
                    render={({ field, fieldState }) => (
                      <>
                        <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} />
                        {fieldState.error && <p className="text-destructive text-xs">{fieldState.error.message}</p>}
                      </>
                    )}
                  />
                </div>

                {canReadFranchisePrice && (
                  <div className="flex flex-col gap-2 flex-1">
                    <Label>Franchise Price *</Label>
                    <Controller
                      control={control}
                      name={`items.${index}.franchise_price`}
                      render={({ field, fieldState }) => (
                        <>
                          <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} />
                          {fieldState.error && <p className="text-destructive text-xs">{fieldState.error.message}</p>}
                        </>
                      )}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}

          {!editData && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setValue('items', [...items, { product_uom_id: 0, base_price: 0, online_price: 0, franchise_price: 0 }])}
            >
              <Plus size={16} className="mr-2" /> Add Another Item
            </Button>
          )}
        </form>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="items-form" disabled={upsertMutation.isPending}>
            {upsertMutation.isPending && <Loader2 size={14} className="animate-spin mr-2" />}
            {editData ? 'Save Changes' : 'Save Items'}
          </Button>
        </div>
      </div>
    </div>
  )
}
