'use client'

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { uomsService } from '@/services/uoms.service'
import { toastMutationApiError } from '@/utils/apiError'
import { X, Loader2 } from 'lucide-react'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
})
type FormValues = z.infer<typeof schema>

interface UomSheetProps {
  open: boolean
  onClose: () => void
  editData?: { id: number; name: string; code: string } | null
}

export default function UomSheet({ open, onClose, editData }: UomSheetProps) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { name: '', code: '' },
  })

  useEffect(() => {
    if (editData) {
      reset({ name: editData.name, code: editData.code })
    } else {
      reset({ name: '', code: '' })
    }
  }, [editData, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => uomsService.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uoms'] })
      toast.success('UOM created')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create UOM'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => uomsService.update(editData!.id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uoms'] })
      toast.success('UOM updated')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update UOM'),
  })

  const onSubmit = (values: FormValues) => {
    if (editData) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

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
          width: 380,
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
            {editData ? 'Edit UOM' : 'New UOM'}
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
          {/* Name field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}
            >
              Name
            </label>
            <input
              {...register('name')}
              placeholder="e.g. Kilogram"
              style={{
                width: '100%',
                padding: '9px 12px',
                border: `1px solid ${errors.name ? 'var(--destructive)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                color: 'var(--foreground)',
                background: 'var(--surface)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                boxSizing: 'border-box',
              }}
            />
            {errors.name && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {errors.name.message}
              </span>
            )}
          </div>

          {/* Code field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}
            >
              Code
            </label>
            <input
              {...register('code')}
              placeholder="e.g. KG"
              style={{
                width: '100%',
                padding: '9px 12px',
                border: `1px solid ${errors.code ? 'var(--destructive)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                color: 'var(--foreground)',
                background: 'var(--surface)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                boxSizing: 'border-box',
                textTransform: 'uppercase',
              }}
            />
            {errors.code && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {errors.code.message}
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
              Short identifier used across the system
            </span>
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
            {editData ? 'Save Changes' : 'Create UOM'}
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
