'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import customerService from '@/services/customer.service'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  editing?: any
}

export default function CustomerSheet({ open, onClose, editing }: Props) {
  const qc = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { name: '', phone: '', email: '', address: '' },
  })

  useEffect(() => {
    if (editing) {
      reset({
        name: editing.name,
        phone: editing.phone ?? '',
        email: editing.email ?? '',
        address: editing.address ?? '',
      })
    } else {
      reset({ name: '', phone: '', email: '', address: '' })
    }
  }, [editing, reset])

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) =>
      editing
        ? customerService.update(editing.id, data as any)
        : customerService.create(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success(editing ? 'Customer updated' : 'Customer created')
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Error'),
  })

  if (!open) return null

  const fieldStyle = {
    width: '100%',
    height: 38,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0 12px',
    fontSize: 14,
    color: 'var(--foreground)',
    background: 'var(--surface)',
    boxSizing: 'border-box' as const,
  }
  const labelStyle = {
    fontSize: 13,
    color: 'var(--foreground-muted)',
    display: 'block',
    marginBottom: 4,
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 50,
          width: 440,
          height: '100%',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--foreground)',
            }}
          >
            {editing ? 'Edit Customer' : 'New Customer'}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 22,
              cursor: 'pointer',
              color: 'var(--foreground-muted)',
            }}
          >
            ×
          </button>
        </div>
        <form
          onSubmit={handleSubmit((d) => mutate(d))}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div>
            <label style={labelStyle}>Name *</label>
            <input {...register('name')} style={fieldStyle} placeholder="Customer name" />
            {errors.name && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {errors.name.message}
              </span>
            )}
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input {...register('phone')} style={fieldStyle} placeholder="e.g. 08123456789" />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input {...register('email')} style={fieldStyle} placeholder="email@example.com" />
          </div>
          <div>
            <label style={labelStyle}>Address</label>
            <textarea
              {...register('address')}
              rows={3}
              placeholder="Full address"
              style={{ ...fieldStyle, height: 'auto', padding: '8px 12px', resize: 'none' }}
            />
          </div>
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: 12,
              marginTop: 'auto',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                height: 40,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface)',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                flex: 1,
                height: 40,
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent)',
                color: 'white',
                cursor: isPending ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
