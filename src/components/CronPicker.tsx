'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

type Frequency = 'daily' | 'weekly' | 'monthly'

interface CronState {
  frequency: Frequency
  hour: number
  minute: number
  dayOfWeek: string
  dayOfMonth: number
}

interface CronPickerProps {
  value?: string
  onChange: (cron: string) => void
  error?: string
  disabled?: boolean
}

const DEFAULT_STATE: CronState = {
  frequency: 'daily',
  hour: 0,
  minute: 0,
  dayOfWeek: 'MON',
  dayOfMonth: 1,
}

const DOW_OPTIONS = [
  { value: 'MON', label: 'Monday' },
  { value: 'TUE', label: 'Tuesday' },
  { value: 'WED', label: 'Wednesday' },
  { value: 'THU', label: 'Thursday' },
  { value: 'FRI', label: 'Friday' },
  { value: 'SAT', label: 'Saturday' },
  { value: 'SUN', label: 'Sunday' },
]

const DOW_LABELS: Record<string, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
}

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i)
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i)
const DATE_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1)

function clamp(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function normalizeDow(dow: string): string {
  const upper = (dow || '').toUpperCase().slice(0, 3)
  return DOW_LABELS[upper] ? upper : 'MON'
}

function generateCron(state: CronState): string {
  const { frequency, hour, minute, dayOfWeek, dayOfMonth } = state
  if (frequency === 'weekly') return `0 ${minute} ${hour} ? * ${dayOfWeek}`
  if (frequency === 'monthly') return `0 ${minute} ${hour} ${dayOfMonth} * ?`
  return `0 ${minute} ${hour} * * ?`
}

function describeCron(state: CronState): string {
  const time = `${String(state.hour).padStart(2, '0')}:${String(state.minute).padStart(2, '0')}`
  if (state.frequency === 'weekly') {
    return `Every ${DOW_LABELS[state.dayOfWeek] ?? state.dayOfWeek} at ${time}`
  }
  if (state.frequency === 'monthly') {
    return `Every ${state.dayOfMonth} at ${time}`
  }
  return `Every day at ${time}`
}

function parseCron(value?: string): CronState {
  const v = (value || '').trim()
  if (!v) return { ...DEFAULT_STATE }

  const timeMatch = v.match(/^(\d{1,2}):(\d{2})$/)
  if (timeMatch) {
    return {
      ...DEFAULT_STATE,
      hour: clamp(parseInt(timeMatch[1], 10), 0, 23, 0),
      minute: clamp(parseInt(timeMatch[2], 10), 0, 59, 0),
    }
  }

  const parts = v.split(/\s+/)
  if (parts.length === 6) {
    const minute = clamp(parseInt(parts[1], 10), 0, 59, 0)
    const hour = clamp(parseInt(parts[2], 10), 0, 23, 0)
    const domAny = parts[3] === '*' || parts[3] === '?'
    const monthAny = parts[4] === '*' || parts[4] === '?'
    const dowAny = parts[5] === '*' || parts[5] === '?'

    if (!domAny && monthAny) {
      return {
        frequency: 'monthly',
        hour,
        minute,
        dayOfWeek: 'MON',
        dayOfMonth: clamp(parseInt(parts[3], 10), 1, 31, 1),
      }
    }

    if (!dowAny && monthAny) {
      return {
        frequency: 'weekly',
        hour,
        minute,
        dayOfWeek: normalizeDow(parts[5]),
        dayOfMonth: 1,
      }
    }

    return {
      frequency: 'daily',
      hour,
      minute,
      dayOfWeek: 'MON',
      dayOfMonth: 1,
    }
  }

  return { ...DEFAULT_STATE }
}

const controlStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface)',
  color: 'var(--foreground)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  cursor: 'pointer',
}

export default function CronPicker({ value, onChange, error, disabled }: CronPickerProps) {
  const parsed = useMemo(() => parseCron(value), [value])
  const [frequency, setFrequency] = useState<Frequency>(parsed.frequency)
  const [hour, setHour] = useState(parsed.hour)
  const [minute, setMinute] = useState(parsed.minute)
  const [dayOfWeek, setDayOfWeek] = useState(parsed.dayOfWeek)
  const [dayOfMonth, setDayOfMonth] = useState(parsed.dayOfMonth)
  const [touched, setTouched] = useState(Boolean(value && value.trim()))
  const lastEmitted = useRef<string>(value ?? '')

  useEffect(() => {
    if ((value ?? '') === lastEmitted.current) return
    lastEmitted.current = value ?? ''
    setTouched(Boolean(value && value.trim()))
    setFrequency(parsed.frequency)
    setHour(parsed.hour)
    setMinute(parsed.minute)
    setDayOfWeek(parsed.dayOfWeek)
    setDayOfMonth(parsed.dayOfMonth)
  }, [value, parsed])

  const emit = (next: CronState) => {
    const cron = generateCron(next)
    lastEmitted.current = cron
    setTouched(true)
    onChange(cron)
  }

  const current: CronState = { frequency, hour, minute, dayOfWeek, dayOfMonth }
  const cronPreview = generateCron(current)
  const description = describeCron(current)

  const handleFrequency = (next: Frequency) => {
    setFrequency(next)
    emit({ ...current, frequency: next })
  }

  const handleHour = (next: number) => {
    setHour(next)
    emit({ ...current, hour: next })
  }

  const handleMinute = (next: number) => {
    setMinute(next)
    emit({ ...current, minute: next })
  }

  const handleDayOfWeek = (next: string) => {
    setDayOfWeek(next)
    emit({ ...current, dayOfWeek: next })
  }

  const handleDayOfMonth = (next: number) => {
    setDayOfMonth(next)
    emit({ ...current, dayOfMonth: next })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FREQUENCIES.map((item) => {
          const active = frequency === item.value
          return (
            <button
              key={item.value}
              type="button"
              disabled={disabled}
              onClick={() => handleFrequency(item.value)}
              style={{
                padding: '5px 10px',
                background: active ? 'var(--accent-light-bg)' : 'var(--background)',
                border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: 500,
                color: active ? 'var(--accent)' : 'var(--foreground-muted)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: frequency === 'daily' ? '1fr 1fr' : '1fr 1fr', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>Hour</label>
          <select
            value={hour}
            disabled={disabled}
            onChange={(e) => handleHour(Number(e.target.value))}
            style={{
              ...controlStyle,
              borderColor: error ? 'var(--destructive)' : controlStyle.border as string,
            }}
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>Minute</label>
          <select
            value={minute}
            disabled={disabled}
            onChange={(e) => handleMinute(Number(e.target.value))}
            style={{
              ...controlStyle,
              borderColor: error ? 'var(--destructive)' : controlStyle.border as string,
            }}
          >
            {MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {frequency === 'weekly' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>Day</label>
          <select
            value={dayOfWeek}
            disabled={disabled}
            onChange={(e) => handleDayOfWeek(e.target.value)}
            style={{
              ...controlStyle,
              borderColor: error ? 'var(--destructive)' : controlStyle.border as string,
            }}
          >
            {DOW_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {frequency === 'monthly' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>Date</label>
          <select
            value={dayOfMonth}
            disabled={disabled}
            onChange={(e) => handleDayOfMonth(Number(e.target.value))}
            style={{
              ...controlStyle,
              borderColor: error ? 'var(--destructive)' : controlStyle.border as string,
            }}
          >
            {DATE_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        style={{
          padding: '8px 10px',
          background: touched ? 'var(--accent-light-bg)' : 'var(--background)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {touched ? (
          <>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent)' }}>{description}</span>
            <span style={{ fontSize: 11, color: 'var(--foreground-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
              cron: {cronPreview}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>
            Not set — choose frequency and time
          </span>
        )}
      </div>

      {error && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{error}</span>}
    </div>
  )
}
