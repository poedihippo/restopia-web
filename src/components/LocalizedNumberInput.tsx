'use client'

import React, { useEffect, useState } from 'react'
import { formatNumberId, parseNumberId, sanitizeNumberInput } from '@/utils/numberFormat'

interface LocalizedNumberInputProps {
  value?: number | string | null
  onChange?: (value: number) => void
  decimals?: number
  /** Pad display with trailing zeros (money). Qty uses false → shows 1 not 1,00 */
  padDecimals?: boolean
  placeholder?: string
  disabled?: boolean
  error?: boolean
  style?: React.CSSProperties
  id?: string
  name?: string
  'aria-label'?: string
}

const baseStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface)',
  color: 'var(--foreground)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

export default function LocalizedNumberInput({
  value,
  onChange,
  decimals = 2,
  padDecimals = true,
  placeholder,
  disabled,
  error,
  style,
  id,
  name,
  'aria-label': ariaLabel,
}: LocalizedNumberInputProps) {
  const numeric = typeof value === 'number' ? value : parseNumberId(value)
  const formatOpts = { pad: padDecimals }
  const [text, setText] = useState(() => formatNumberId(numeric, decimals, formatOpts))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) {
      setText(formatNumberId(numeric, decimals, formatOpts))
    }
  }, [numeric, decimals, padDecimals, focused])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = sanitizeNumberInput(e.target.value, decimals)
    setText(next)
    onChange?.(parseNumberId(next))
  }

  const handleBlur = () => {
    setFocused(false)
    const n = parseNumberId(text)
    setText(formatNumberId(n, decimals, formatOpts))
    onChange?.(n)
  }

  return (
    <input
      id={id}
      name={name}
      aria-label={ariaLabel}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      value={text}
      placeholder={placeholder}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      style={{
        ...baseStyle,
        ...(error ? { borderColor: 'var(--destructive)' } : null),
        ...(disabled ? { opacity: 0.6, cursor: 'not-allowed' } : null),
        ...style,
      }}
    />
  )
}
