'use client'

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { suppliersService } from '@/services/suppliers.service'
import { toastMutationApiError } from '@/utils/apiError'
import { X, Loader2 } from 'lucide-react'

const schema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  pic: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface SupplierSheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    code: string
    name: string
    address?: string
    phone?: string
    email?: string
    pic?: string
  } | null
}

export default function SupplierSheet({ open, onClose, editData }: SupplierSheetProps) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      code: '',
      name: '',
      address: '',
      phone: '',
      email: '',
      pic: '',
    },
  })

  useEffect(() => {
    if (editData) {
      reset({
        code: editData.code,
        name: editData.name,
        address: editData.address ?? '',
        phone: editData.phone ?? '',
        email: editData.email ?? '',
        pic: editData.pic ?? '',
      })
    } else {
      reset({ code: '', name: '', address: '', phone: '', email: '', pic: '' })
    }
  }, [editData, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => suppliersService.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier created')
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to create supplier'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => suppliersService.update(editData!.id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Supplier updated')
      onClose()
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to update supplier'),
  })

  const onSubmit = (values: FormValues) => {
    if (editData) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const inputStyle: React.CSSProperties = {
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
  }

  const inputError: React.CSSProperties = {
    ...inputStyle,
    border: '1px solid var(--destructive)',
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
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }}
      />

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
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 500,
              margin: 0,
              color: 'var(--foreground)',
            }}
          >
            {editData ? 'Edit Supplier' : 'New Supplier'}
          </h2>
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
          {/* Code */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
              Supplier Code
            </label>
            <input
              {...register('code')}
              placeholder="e.g. SUP-001"
              style={errors.code ? inputError : inputStyle}
            />
            {errors.code && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {errors.code.message}
              </span>
            )}
          </div>

          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
              Supplier Name
            </label>
            <input
              {...register('name')}
              placeholder="e.g. PT Coklat Makmur"
              style={errors.name ? inputError : inputStyle}
            />
            {errors.name && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {errors.name.message}
              </span>
            )}
          </div>

          {/* PIC */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
              PIC (Person in Charge)
            </label>
            <input
              {...register('pic')}
              placeholder="Contact person name"
              style={inputStyle}
            />
          </div>

          {/* Phone + Email row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                Phone
              </label>
              <input
                {...register('phone')}
                placeholder="e.g. 08123456789"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                Email
              </label>
              <input
                {...register('email')}
                placeholder="e.g. supplier@email.com"
                style={errors.email ? inputError : inputStyle}
              />
              {errors.email && (
                <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                  {errors.email.message}
                </span>
              )}
            </div>
          </div>

          {/* Address */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
              Address
            </label>
            <textarea
              {...register('address')}
              rows={3}
              placeholder="Full address"
              style={{
                ...inputStyle,
                resize: 'vertical',
                minHeight: 80,
              }}
            />
          </div>
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
            disabled={isPending}
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
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending && (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            )}
            {editData ? 'Save Changes' : 'Create Supplier'}
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
