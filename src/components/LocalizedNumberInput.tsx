'use client'

import React, { useEffect, useState } from 'react'
import { formatNumberId, formatWhileTyping, parseNumberId } from '@/utils/numberFormat'

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
  /** Select the whole value on focus/click so typing replaces it (e.g. POS qty). */
  selectOnFocus?: boolean
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
  selectOnFocus = false,
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
    // Saat mengetik: pemisah ribuan "." langsung tampil, bagian desimal
    // dibiarkan (tidak dipotong) sampai blur.
    const next = formatWhileTyping(e.target.value)
    setText(next)
    onChange?.(parseNumberId(next))
  }

  const handleBlur = () => {
    setFocused(false)
    const n = parseNumberId(text)
    // Saat blur: desimal dibatasi sesuai `decimals` dan dirapikan formatnya.
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
      onFocus={(e) => {
        setFocused(true)
        if (selectOnFocus) {
          // Next frame: a mouse click would otherwise collapse the selection.
          const el = e.currentTarget
          requestAnimationFrame(() => el.select())
        }
      }}
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
