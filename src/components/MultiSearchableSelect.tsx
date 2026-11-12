'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, X } from 'lucide-react'

export interface MultiSearchableSelectOption {
  value: number | string
  label: string
  sublabel?: string
}

export interface MultiSearchableSelectProps {
  value: (number | string)[]
  onChange: (values: (number | string)[]) => void
  options: MultiSearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  loading?: boolean
  onSearchChange?: (search: string) => void
  error?: string
  /** Paged sources (see useInfiniteOptions): called when the list is scrolled to the bottom. */
  onLoadMore?: () => void
  hasMore?: boolean
  loadingMore?: boolean
}

export default function MultiSearchableSelect({
  value = [],
  onChange,
  options,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  disabled = false,
  loading = false,
  onSearchChange,
  error,
  onLoadMore,
  hasMore,
  loadingMore,
}: MultiSearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const dropdownHeight = 260
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const showAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow
    setDropdownPos({
      top: showAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }

  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => {
      updatePosition()
    })
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (!triggerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open])

  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 30)
    }
  }, [open])

  const needle = search.toLowerCase()
  const filteredOptions = needle
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(needle) ||
          (o.sublabel ?? '').toLowerCase().includes(needle),
      )
    : options

  const toggleOption = (val: number | string) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val))
    } else {
      onChange([...value, val])
    }
  }

  const removeValue = (val: number | string) => {
    onChange(value.filter((v) => v !== val))
  }

  const selectedLabels = value
    .map((v) => options.find((o) => o.value === v))
    .filter(Boolean)

  const displayText =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.map((o) => o!.label).join(', ')
        : `${selectedLabels.length} selected`

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((v) => !v)
        }}
        style={{
          width: '100%',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          border: `1px solid ${error ? 'var(--destructive)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-md)',
          background: disabled ? 'var(--muted)' : 'var(--surface-raised)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 12,
          textAlign: 'left',
          color: value.length > 0 ? 'var(--foreground)' : 'var(--foreground-subtle)',
          fontFamily: 'var(--font-sans)',
          boxSizing: 'border-box',
          minHeight: 32,
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {selectedLabels.length > 0 ? (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', alignItems: 'center' }}>
              {selectedLabels.length <= 3 ? (
                selectedLabels.map((o) => (
                  <span
                    key={String(o!.value)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: 'var(--accent-light-bg)',
                      color: 'var(--accent)',
                      fontSize: 11,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {o!.label}
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        removeValue(o!.value)
                      }}
                      style={{ cursor: 'pointer', display: 'flex' }}
                    >
                      <X size={10} />
                    </span>
                  </span>
                ))
              ) : (
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  {displayText}
                </span>
              )}
            </div>
          ) : (
            <span>{placeholder}</span>
          )}
        </div>
        <ChevronDown
          size={12}
          color="var(--foreground-muted)"
          style={{
            flexShrink: 0,
            marginLeft: 4,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms',
          }}
        />
      </button>

      {open && dropdownPos && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                onSearchChange?.(e.target.value)
              }}
              placeholder={searchPlaceholder}
              style={{
                width: '100%',
                padding: '5px 8px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 11,
                outline: 'none',
                background: 'var(--surface-raised)',
                fontFamily: 'var(--font-sans)',
                color: 'var(--foreground)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div
            style={{ maxHeight: 200, overflowY: 'auto', overflowX: 'hidden' }}
            onScroll={(e) => {
              const el = e.currentTarget
              if (hasMore && !loadingMore && el.scrollTop + el.clientHeight >= el.scrollHeight - 24) onLoadMore?.()
            }}
          >
            {loading ? (
              <div style={{ padding: 10, textAlign: 'center', fontSize: 12, color: 'var(--foreground-muted)' }}>
                Loading...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div style={{ padding: 10, textAlign: 'center', fontSize: 12, color: 'var(--foreground-muted)' }}>
                No options
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = value.includes(option.value)
                return (
                  <button
                    type="button"
                    key={String(option.value)}
                    onClick={() => toggleOption(option.value)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      background: isSelected ? 'var(--accent-light-bg)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                        background: isSelected ? 'var(--accent)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? 'var(--accent)' : 'var(--foreground)',
                      }}
                    >
                      {option.label}
                    </span>
                    {option.sublabel && (
                      <span style={{ fontSize: 10, color: 'var(--foreground-muted)', marginLeft: 'auto' }}>
                        {option.sublabel}
                      </span>
                    )}
                  </button>
                )
              })
            )}
            {!loading && (loadingMore || hasMore) && (
              <div style={{ padding: 8, textAlign: 'center', fontSize: 10, color: 'var(--foreground-muted)' }}>
                {loadingMore ? 'Memuat...' : 'Scroll untuk memuat lebih banyak'}
              </div>
            )}
          </div>

          {value.length > 0 && (
            <div
              style={{
                padding: '6px 8px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 10, color: 'var(--foreground-muted)' }}>
                {value.length} selected
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                style={{
                  fontSize: 10,
                  color: 'var(--destructive)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <span style={{ fontSize: 11, color: 'var(--destructive)', marginTop: 2, display: 'block' }}>
          {error}
        </span>
      )}
    </div>
  )
}
