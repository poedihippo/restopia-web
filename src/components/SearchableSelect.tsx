'use client'

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

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
}

/** Helper to find and focus the next/previous focusable element in DOM sequence */
function focusNextElement(fromElement: HTMLElement, reverse = false) {
  const focusableSelectors = [
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    '[tabindex]:not([tabindex="-1"]):not([disabled])',
  ].join(', ')

  const focusables = Array.from(document.querySelectorAll<HTMLElement>(focusableSelectors)).filter(
    (el) => {
      return el.offsetParent !== null && !el.closest('[aria-hidden="true"]')
    },
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
    },
    ref,
  ) {
    const { user } = useAuth()
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [highlightedIndex, setHighlightedIndex] = useState(0)
    const [dropdownPos, setDropdownPos] = useState<{
      top: number
      left: number
      width: number
    } | null>(null)

    const triggerRef = useRef<HTMLButtonElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
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

    // Focus search input whenever open state becomes true
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

    // Reset highlighted index when options or search term change
    useEffect(() => {
      if (filteredOptions.length > 0) {
        const currentIndex = filteredOptions.findIndex((o) => o.value === value)
        setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0)
      } else {
        setHighlightedIndex(-1)
      }
    }, [search, options.length])

    const handleSelectOption = (option: SearchableSelectOption) => {
      setCachedOption(option)
      onChange(option.value)
      setOpen(false)
      setSearch('')
      onSearchChange?.('')
    }

    // Trigger keydown: allow direct typing or ArrowDown/Enter to open dropdown
    const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return

      // Don't intercept global shortcuts like Ctrl+B, Ctrl+S, etc.
      if (e.ctrlKey || e.metaKey || e.altKey) return

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
        updatePosition()
        return
      }

      // If user starts typing alphanumeric characters while focused on trigger
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setOpen(true)
        setSearch(e.key)
        onSearchChange?.(e.key)
        updatePosition()
      }
    }

    // Input keydown: Arrow keys, Enter, Escape, and Tab
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
        setOpen(false)
        setSearch('')
        onSearchChange?.('')
        triggerRef.current?.focus()
        return
      }

      if (e.key === 'Tab') {
        e.preventDefault()
        // Auto-select highlighted option on Tab
        if (filteredOptions.length > 0) {
          const opt = filteredOptions[highlightedIndex >= 0 ? highlightedIndex : 0]
          if (opt) {
            handleSelectOption(opt)
          }
        } else {
          setOpen(false)
          setSearch('')
          onSearchChange?.('')
        }
        // Seamlessly move focus to next/previous element
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
            setOpen((v) => {
              const next = !v
              if (next) updatePosition()
              return next
            })
          }}
          disabled={disabled}
          style={{
            width: '100%',
            minWidth: 0,
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
              placeholder ?? 'Select...'
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
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  onSearchChange?.(e.target.value)
                }}
                onKeyDown={handleInputKeyDown}
                onClick={(e) => e.stopPropagation()}
                placeholder={searchPlaceholder ?? 'Search... (Use Tab/Enter to select)'}
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
                        padding: '9px 12px',
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
                          fontSize: 13,
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
                            fontSize: 11,
                            color: 'var(--foreground-muted)',
                            marginTop: 1,
                            display: 'flex',
                            gap: 6,
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
  },
)

export default SearchableSelect
