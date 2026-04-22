'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SearchableSelectOption {
  value: number
  label: string
  sublabel?: string
}

export interface SearchableSelectProps {
  value: number
  onChange: (value: number) => void
  options: SearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  loading?: boolean
  onSearchChange?: (search: string) => void
  error?: string
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  disabled,
  loading,
  onSearchChange,
  error,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const needle = search.toLowerCase()
  const filteredOptions = needle
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(needle) ||
          (o.sublabel ?? '').toLowerCase().includes(needle),
      )
    : options

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => {
          if (!disabled) setOpen((v) => !v)
        }}
        disabled={disabled}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 12px',
          border: `1px solid ${error ? 'var(--destructive)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-md)',
          background: disabled ? 'var(--background)' : 'var(--surface)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 13,
          textAlign: 'left',
          color: selectedOption
            ? 'var(--foreground)'
            : 'var(--foreground-subtle)',
          fontFamily: 'var(--font-sans)',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {selectedOption ? (
            <span>
              {selectedOption.label}
              {selectedOption.sublabel && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--foreground-muted)',
                    marginLeft: 6,
                  }}
                >
                  {selectedOption.sublabel}
                </span>
              )}
            </span>
          ) : (
            (placeholder ?? 'Select...')
          )}
        </div>
        <ChevronDown
          size={14}
          color="var(--foreground-muted)"
          style={{
            flexShrink: 0,
            marginLeft: 8,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms',
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 300,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: 8,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                onSearchChange?.(e.target.value)
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder={searchPlaceholder ?? 'Search...'}
              style={{
                width: '100%',
                padding: '7px 10px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                outline: 'none',
                background: 'var(--background)',
                fontFamily: 'var(--font-sans)',
                color: 'var(--foreground)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {loading ? (
              <div
                style={{
                  padding: 12,
                  textAlign: 'center',
                  fontSize: 13,
                  color: 'var(--foreground-muted)',
                }}
              >
                Loading...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: 12,
                  textAlign: 'center',
                  fontSize: 13,
                  color: 'var(--foreground-muted)',
                }}
              >
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSel = option.value === value
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                      setSearch('')
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '9px 12px',
                      background: isSel
                        ? 'var(--accent-light-bg)'
                        : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: isSel
                          ? 'var(--accent)'
                          : 'var(--foreground)',
                      }}
                    >
                      {option.label}
                    </span>
                    {option.sublabel && (
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: 'var(--foreground-muted)',
                          marginTop: 1,
                        }}
                      >
                        {option.sublabel}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      {error && (
        <span
          style={{
            fontSize: 12,
            color: 'var(--destructive)',
            marginTop: 4,
            display: 'block',
          }}
        >
          {error}
        </span>
      )}
    </div>
  )
}
