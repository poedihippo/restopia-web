'use client'

import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { shiftsService } from '@/services/shifts.service'
import { operationsService } from '@/services/operations.service'
import { Loader2, Clock, ArrowLeft } from 'lucide-react'

export default function PosShiftBlockerModal() {
  const qc = useQueryClient()
  const router = useRouter()

  // Check current operation
  const { 
    data: operationData, 
    isLoading: isOperationLoading, 
  } = useQuery({
    queryKey: ['operations-current'],
    queryFn: () => operationsService.current().then(r => r.data),
    retry: false,
  })

  // Check current shift
  const { 
    data: shiftData, 
    isLoading: isShiftLoading, 
  } = useQuery({
    queryKey: ['shifts-current'],
    queryFn: () => shiftsService.current().then(r => r.data),
    retry: false,
    enabled: !!operationData?.data,
  })

  const startOperationMutation = useMutation({
    mutationFn: () => operationsService.open({}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operations-current'] })
      toast.success('Operation started successfully')
    },
    onError: () => toast.error('Failed to start operation')
  })

  const startShiftMutation = useMutation({
    mutationFn: () => shiftsService.start({}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts-current'] })
      toast.success('Shift started successfully')
    },
    onError: () => toast.error('Failed to start shift')
  })

  const isLoading = isOperationLoading || (!!operationData?.data && isShiftLoading)
  const isOperationActive = !!operationData?.data
  const isShiftActive = !!shiftData?.data

  // If loading or if both are active, do not render the blocker
  if (isLoading || (isOperationActive && isShiftActive)) {
    return null
  }

  // If operation is not active
  if (!isOperationActive) {
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
            Operation Inactive
          </h2>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '0 0 32px', lineHeight: 1.5 }}>
            You don't have an active operation. Please start your operation to continue to Point of Sales.
          </p>
          <button
            onClick={() => startOperationMutation.mutate()}
            disabled={startOperationMutation.isPending}
            style={{
              width: '100%', padding: '14px 20px', background: 'var(--accent)', color: 'white', 
              border: 'none', borderRadius: 'var(--radius-md)', fontSize: 15, fontWeight: 500, 
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              opacity: startOperationMutation.isPending ? 0.7 : 1
            }}
          >
            {startOperationMutation.isPending && <Loader2 size={18} className="animate-spin" />}
            Start Operation
          </button>
          <button
            onClick={() => router.push('/')}
            style={{
              width: '100%', padding: '14px 20px', background: 'transparent', color: 'var(--foreground-muted)', 
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 15, fontWeight: 500, 
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              marginTop: 12
            }}
          >
            <ArrowLeft size={18} />
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // If shift is not active (and operation is active)
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
