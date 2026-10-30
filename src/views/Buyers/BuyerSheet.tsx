'use client'

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { buyersService } from '@/services/buyers.service'
import { toastMutationApiError } from '@/utils/apiError'
import { X, Loader2 } from 'lucide-react'

const schema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  pic: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface BuyerSheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    code: string
    name: string
    pic?: string
    phone?: string
    email?: string
  } | null
}

const EMPTY: FormValues = { code: '', name: '', pic: '', phone: '', email: '' }

export default function BuyerSheet({ open, onClose, editData }: BuyerSheetProps) {
  const queryClient = useQueryClient()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (editData) {
      reset({
        code: editData.code ?? '',
        name: editData.name ?? '',
        pic: editData.pic ?? '',
        phone: editData.phone ?? '',
        email: editData.email ?? '',
      })
    } else {
      reset(EMPTY)
    }
  }, [editData, open, reset])

  const onSuccess = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ['buyers'] })
    queryClient.invalidateQueries({ queryKey: ['buyers-all'] })
    queryClient.invalidateQueries({ queryKey: ['buyer'] })
    toast.success(message)
    onClose()
  }

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => buyersService.create(data as any),
    onSuccess: () => onSuccess('Buyer created'),
    onError: (err: any) => toastMutationApiError(err, 'Failed to create buyer'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => buyersService.update(editData!.id, data as any),
    onSuccess: () => onSuccess('Buyer updated'),
    onError: (err: any) => toastMutationApiError(err, 'Failed to update buyer'),
  })

  const onSubmit = (values: FormValues) => {
    if (editData) updateMutation.mutate(values)
    else createMutation.mutate(values)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!open) return null

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 14, color: 'var(--foreground)', background: 'var(--surface-raised)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }
  const inputError: React.CSSProperties = { ...inputStyle, border: '1px solid var(--destructive)' }
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 2 }
  const errorStyle: React.CSSProperties = { fontSize: 12, color: 'var(--destructive)' }
  const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />

      <div style={{ position: 'relative', zIndex: 50, width: 460, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
            {editData ? 'Edit Buyer' : 'New Buyer'}
          </h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 'var(--radius-sm)', color: 'var(--foreground-muted)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, fontSize: 11, color: 'var(--foreground-subtle)' }}>
            <span style={{ color: 'var(--destructive)' }}>*</span>
            <span>Required fields</span>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Buyer Code <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span></label>
            <input {...register('code')} placeholder="e.g. BUY-001" style={errors.code ? inputError : inputStyle} />
            {errors.code && <span style={errorStyle}>{errors.code.message}</span>}
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Buyer Name <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span></label>
            <input {...register('name')} placeholder="e.g. Buyer A" style={errors.name ? inputError : inputStyle} />
            {errors.name && <span style={errorStyle}>{errors.name.message}</span>}
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>PIC (Person in Charge)</label>
            <input {...register('pic')} placeholder="Contact person name" style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Phone</label>
              <input {...register('phone')} placeholder="e.g. 08123456789" style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Email</label>
              <input {...register('email')} placeholder="e.g. buyer@email.com" style={inputStyle} />
            </div>
          </div>
        </form>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" disabled={isPending} onClick={handleSubmit(onSubmit)} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: isPending ? 0.7 : 1 }}>
            {isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {editData ? 'Save Changes' : 'Create Buyer'}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
