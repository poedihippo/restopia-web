'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export interface SearchableSelectOption {
  value: number | string
  label: string
  sublabel?: string
}

export interface SearchableSelectProps {
  value: number | string
  onChange: (value: any) => void
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
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownPos, setDropdownPos] = useState<
    { top: number; left: number; width: number } | null
  >(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const lowerPlaceholder = placeholder?.toLowerCase() ?? ''
    const isOwnBranchSelect =
      lowerPlaceholder.includes('branch') &&
      !lowerPlaceholder.includes('target') &&
      !lowerPlaceholder.includes('supplier') &&
      !lowerPlaceholder.includes('buyer')

    if (!value && user?.branch_id && isOwnBranchSelect) {
      const hasBranchOption = options.some((o) => o.value === user.branch_id)
      if (hasBranchOption) {
        onChange(user.branch_id)
      }
    }
  }, [value, user, placeholder, options, onChange])

  const [cachedOption, setCachedOption] = useState<SearchableSelectOption | null>(null)

  const currentOption = options.find((o) => o.value === value)
  
  useEffect(() => {
    if (currentOption) {
      setCachedOption(currentOption)
    }
  }, [currentOption])

  const selectedOption = currentOption ?? (cachedOption?.value === value ? cachedOption : undefined)

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
    updatePosition()
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        !triggerRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
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

  return (
    <div style={{ width: '100%' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (disabled) return
          setOpen((v) => {
            const next = !v
            if (next) updatePosition()
            return next
          })
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
          background: disabled ? 'var(--muted)' : 'var(--surface-raised)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 13,
          textAlign: 'left',
          color: disabled
            ? 'var(--foreground-subtle)'
            : selectedOption
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
                background: 'var(--surface-raised)',
                fontFamily: 'var(--font-sans)',
                color: 'var(--foreground)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ maxHeight: 220, overflowY: 'auto', overflowX: 'hidden' }}>
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
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setCachedOption(option)
                      onChange(option.value)
                      setOpen(false)
                      setSearch('')
                      onSearchChange?.('')
                    }}
                    onClick={(e) => e.preventDefault()}
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
