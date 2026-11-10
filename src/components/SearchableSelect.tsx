'use client'

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { FloatingPanel } from '@/components/FloatingPanel'

export interface SearchableSelectOption {
  value: number | string
  label: string
  sublabel?: string
  description?: string
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
  dataFocusFirst?: boolean
  tabIndex?: number
  id?: string
  /** Extra inline styles for the trigger button (merged over the defaults). */
  triggerStyle?: React.CSSProperties
}

function focusNextElement(fromElement: HTMLElement, reverse = false) {
  const focusableSelectors = [
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    '[tabindex]:not([tabindex="-1"]):not([disabled])',
  ].join(', ')

  const focusables = Array.from(document.querySelectorAll<HTMLElement>(focusableSelectors)).filter(
    (el) => el.offsetParent !== null && !el.closest('[aria-hidden="true"]'),
  )

  const currentIndex = focusables.indexOf(fromElement)
  if (currentIndex > -1) {
    const targetIndex = reverse ? currentIndex - 1 : currentIndex + 1
    if (targetIndex >= 0 && targetIndex < focusables.length) {
      focusables[targetIndex].focus()
      return true
    }
  }
  return false
}

const SearchableSelect = forwardRef<HTMLButtonElement, SearchableSelectProps>(
  function SearchableSelect(
    {
      value,
      onChange,
      options,
      placeholder,
      searchPlaceholder,
      disabled,
      loading,
      onSearchChange,
      error,
      dataFocusFirst,
      tabIndex,
      id,
      triggerStyle,
    },
    ref,
  ) {
    const { user } = useAuth()
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [highlightedIndex, setHighlightedIndex] = useState(0)

    const triggerRef = useRef<HTMLButtonElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement)

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
      if (currentOption) setCachedOption(currentOption)
    }, [currentOption])

    const selectedOption = currentOption ?? (cachedOption?.value === value ? cachedOption : undefined)

    useEffect(() => {
      if (open) {
        const timer = setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus()
            const valLen = searchInputRef.current.value.length
            searchInputRef.current.setSelectionRange(valLen, valLen)
          }
        }, 30)
        return () => clearTimeout(timer)
      }
    }, [open])

    const needle = search.toLowerCase()
    const filteredOptions = needle
      ? options.filter(
          (o) =>
            o.label.toLowerCase().includes(needle) ||
            (o.sublabel ?? '').toLowerCase().includes(needle) ||
            (o.description ?? '').toLowerCase().includes(needle),
        )
      : options

    useEffect(() => {
      if (filteredOptions.length > 0) {
        const idx = filteredOptions.findIndex((o) => o.value === value)
        setHighlightedIndex(idx >= 0 ? idx : 0)
      } else {
        setHighlightedIndex(-1)
      }
    }, [search, options.length])

    const close = () => {
      setOpen(false)
      setSearch('')
      onSearchChange?.('')
    }

    const handleSelectOption = (option: SearchableSelectOption) => {
      setCachedOption(option)
      onChange(option.value)
      close()
    }

    const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
        return
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setOpen(true)
        setSearch(e.key)
        onSearchChange?.(e.key)
      }
    }

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (filteredOptions.length > 0) {
          setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0))
        }
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (filteredOptions.length > 0) {
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : Math.max(0, filteredOptions.length - 1),
          )
        }
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredOptions.length > 0 && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelectOption(filteredOptions[highlightedIndex])
          triggerRef.current?.focus()
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        triggerRef.current?.focus()
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        if (filteredOptions.length > 0) {
          const opt = filteredOptions[highlightedIndex >= 0 ? highlightedIndex : 0]
          if (opt) handleSelectOption(opt)
        } else {
          close()
        }
        if (triggerRef.current) {
          focusNextElement(triggerRef.current, e.shiftKey)
        }
      }
    }

    return (
      <div style={{ width: '100%', minWidth: 0 }}>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          tabIndex={tabIndex ?? 0}
          data-focus-first={dataFocusFirst ? 'true' : undefined}
          onKeyDown={handleTriggerKeyDown}
          onClick={() => {
            if (disabled) return
            setOpen((v) => !v)
          }}
          disabled={disabled}
          className="ss-trigger"
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
            fontSize: 11,
            textAlign: 'left',
            color: disabled
              ? 'var(--foreground-subtle)'
              : selectedOption
                ? 'var(--foreground)'
                : 'var(--foreground-subtle)',
            fontFamily: 'var(--font-sans)',
            boxSizing: 'border-box',
            ...triggerStyle,
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
            {selectedOption ? (
              <span
                style={{
                  display: 'inline-block',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  verticalAlign: 'bottom',
                }}
                title={`${selectedOption.label}${selectedOption.sublabel ? ` (${selectedOption.sublabel})` : ''}`}
              >
                {selectedOption.label}
                {selectedOption.sublabel && (
                  <span style={{ fontSize: 11, color: 'var(--foreground-muted)', marginLeft: 6 }}>
                    {selectedOption.sublabel}
                  </span>
                )}
              </span>
            ) : (
              placeholder ?? 'Select...'
            )}
          </div>
          <ChevronDown
            size={12}
            color="var(--foreground-muted)"
            style={{
              flexShrink: 0,
              marginLeft: 8,
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms',
            }}
          />
        </button>

        <FloatingPanel
          anchorRef={triggerRef}
          open={open}
          onClose={close}
          maxHeight={280}
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
              onKeyDown={handleInputKeyDown}
              onClick={(e) => e.stopPropagation()}
              placeholder={searchPlaceholder ?? 'Cari... (Tab/Enter untuk pilih)'}
              style={{
                width: '100%',
                padding: '5px 8px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 11,
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
              <div style={{ padding: 10, textAlign: 'center', fontSize: 11, color: 'var(--foreground-muted)' }}>
                Loading...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div style={{ padding: 10, textAlign: 'center', fontSize: 11, color: 'var(--foreground-muted)' }}>
                Tidak ditemukan
              </div>
            ) : (
              filteredOptions.map((option, idx) => {
                const isSel = option.value === value
                const isHighlighted = idx === highlightedIndex
                return (
                  <button
                    type="button"
                    key={option.value}
                    ref={(el) => {
                      if (isHighlighted && el) {
                        el.scrollIntoView({ block: 'nearest' })
                      }
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelectOption(option)
                      triggerRef.current?.focus()
                    }}
                    onClick={(e) => e.preventDefault()}
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '6px 10px',
                      background: isHighlighted
                        ? 'var(--accent-light-bg)'
                        : isSel
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
                        fontSize: 11,
                        fontWeight: isHighlighted || isSel ? 600 : 500,
                        color: isHighlighted || isSel ? 'var(--accent)' : 'var(--foreground)',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={option.label}
                    >
                      {option.label}
                    </span>
                    {(option.sublabel || option.description) && (
                      <span
                        style={{
                          fontSize: 10,
                          color: 'var(--foreground-muted)',
                          marginTop: 1,
                          display: 'flex',
                          gap: 4,
                          alignItems: 'center',
                        }}
                      >
                        {option.sublabel && (
                          <span style={{ fontFamily: 'monospace' }}>{option.sublabel}</span>
                        )}
                        {option.description && (
                          <span style={{ fontStyle: 'italic' }}>{option.description}</span>
                        )}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </FloatingPanel>

        {error && (
          <span style={{ fontSize: 10, color: 'var(--destructive)', marginTop: 2, display: 'block' }}>
            {error}
          </span>
        )}
      </div>
    )
  },
)

export default SearchableSelect
