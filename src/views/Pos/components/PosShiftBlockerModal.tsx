'use client'

import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { shiftsService } from '@/services/shifts.service'
import { Loader2, Clock, ArrowLeft } from 'lucide-react'

export default function PosShiftBlockerModal() {
  const qc = useQueryClient()
  const router = useRouter()

  // Check current shift
  const { 
    data: shiftData, 
    isLoading: isShiftLoading, 
  } = useQuery({
    queryKey: ['shifts-current'],
    queryFn: () => shiftsService.current().then(r => r.data),
    retry: false,
  })

  const startShiftMutation = useMutation({
    mutationFn: () => shiftsService.start({}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts-current'] })
      toast.success('Shift started successfully')
    },
    onError: () => toast.error('Failed to start shift')
  })

  const isLoading = isShiftLoading
  const isShiftActive = !!shiftData?.data

  // If loading or if shift is active, do not render the blocker
  if (isLoading || isShiftActive) {
    return null
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, 
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)'
    }}>
      <div style={{
        background: 'var(--surface)', padding: 32, borderRadius: 'var(--radius-xl)', 
        maxWidth: 420, width: '100%', textAlign: 'center',
        boxShadow: 'var(--shadow-2xl)', border: '1px solid var(--border)'
      }}>
        <div style={{ display: 'inline-flex', padding: 16, borderRadius: '50%', background: 'var(--accent-subtle)', color: 'var(--accent)', marginBottom: 24 }}>
          <Clock size={36} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, margin: '0 0 12px', color: 'var(--foreground)' }}>
          Shift Inactive
        </h2>
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '0 0 32px', lineHeight: 1.5 }}>
          You don't have an active shift. Please start your shift to continue to Point of Sales.
        </p>
        <button
          onClick={() => startShiftMutation.mutate()}
          disabled={startShiftMutation.isPending}
          style={{
            width: '100%', padding: '14px 20px', background: 'var(--accent)', color: 'white', 
            border: 'none', borderRadius: 'var(--radius-md)', fontSize: 15, fontWeight: 500, 
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            opacity: startShiftMutation.isPending ? 0.7 : 1
          }}
        >
          {startShiftMutation.isPending && <Loader2 size={18} className="animate-spin" />}
          Start Shift
        </button>
        <button
          onClick={() => router.push('/settings/shifts')}
          style={{
            width: '100%', padding: '14px 20px', background: 'transparent', color: 'var(--foreground-muted)', 
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 15, fontWeight: 500, 
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            marginTop: 12
          }}
        >
          <ArrowLeft size={18} />
          Go to Shifts Menu
        </button>
      </div>
    </div>
  )
}
