'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/*
 * Styled calendar popup for every <input type="date"> on v2 routes.
 *
 * The browser's own date popup can't be styled, so clicks on date inputs are
 * intercepted (capture phase) and this calendar opens instead. The input itself
 * is untouched: typing still works, min/max/disabled/readOnly are respected,
 * and a picked date is written through the native value setter + input/change
 * events, so controlled inputs and react-hook-form `register` both see it.
 */

const PANEL_W = 268
const PANEL_H = 318
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseISO = (v: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

function commitValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

// Inside a Radix modal (legacy shadcn Dialog/Popover) the body is inert to
// outside clicks and the dialog would treat the portal as "outside", so those
// inputs keep the browser's native picker.
const insideRadixLayer = (el: Element) =>
  !!el.closest('[role="dialog"][data-state], [data-radix-popper-content-wrapper]')

const isPickable = (el: EventTarget | null): el is HTMLInputElement =>
  el instanceof HTMLInputElement && el.type === 'date' && !el.disabled && !el.readOnly && !insideRadixLayer(el)

export default function DatePopover() {
  const [target, setTarget] = useState<HTMLInputElement | null>(null)
  const [view, setView] = useState(() => new Date())
  const [mode, setMode] = useState<'days' | 'months'>('days')
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  const place = useCallback((el: HTMLInputElement) => {
    const r = el.getBoundingClientRect()
    const below = r.bottom + 6
    const top = below + PANEL_H > window.innerHeight - 8 && r.top - PANEL_H - 6 > 8 ? r.top - PANEL_H - 6 : below
    const left = Math.min(Math.max(8, r.left), window.innerWidth - PANEL_W - 8)
    setPos({ top, left })
  }, [])

  const open = useCallback(
    (el: HTMLInputElement) => {
      const selected = parseISO(el.value)
      const base = selected ?? new Date()
      setView(new Date(base.getFullYear(), base.getMonth(), 1))
      setMode('days')
      place(el)
      setTarget(el)
    },
    [place],
  )

  const close = useCallback((refocus = false) => {
    setTarget((t) => {
      if (refocus) t?.focus()
      return null
    })
  }, [])

  // Take over the browser popup for date inputs.
  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (!isPickable(e.target)) return
      e.preventDefault()
      if (e.type === 'mousedown') {
        e.target.focus()
        open(e.target)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (isPickable(e.target) && e.altKey && e.key === 'ArrowDown') {
        e.preventDefault()
        open(e.target)
      }
    }
    document.addEventListener('mousedown', onPointer, true)
    document.addEventListener('click', onPointer, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onPointer, true)
      document.removeEventListener('click', onPointer, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  // While open: follow the input, close on outside press / Escape / input gone.
  useEffect(() => {
    if (!target) return
    const follow = () => (target.isConnected ? place(target) : close())
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || t === target) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close(true)
      }
    }
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [target, place, close])

  if (!target) return null

  const min = target.min || ''
  const max = target.max || ''
  const inRange = (iso: string) => (!min || iso >= min) && (!max || iso <= max)
  const selected = target.value
  const today = toISO(new Date())
  const year = view.getFullYear()
  const month = view.getMonth()

  const pick = (iso: string) => {
    if (!inRange(iso)) return
    commitValue(target, iso)
    close(true)
  }

  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const cells = Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i))

  const shift = (delta: number) =>
    setView(mode === 'days' ? new Date(year, month + delta, 1) : new Date(year + delta, month, 1))

  return createPortal(
    <div
      ref={panelRef}
      className="dp-panel"
      role="dialog"
      aria-label="Choose date"
      style={{ top: pos.top, left: pos.left, width: PANEL_W }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="dp-head">
        <button type="button" className="dp-nav" aria-label="Previous" onClick={() => shift(-1)}>
          <ChevronLeft size={15} />
        </button>
        <button type="button" className="dp-title" onClick={() => setMode(mode === 'days' ? 'months' : 'days')}>
          {mode === 'days' ? `${MONTHS[month]} ${year}` : year}
        </button>
        <button type="button" className="dp-nav" aria-label="Next" onClick={() => shift(1)}>
          <ChevronRight size={15} />
        </button>
      </div>

      {mode === 'days' ? (
        <div className="dp-grid">
          {WEEKDAYS.map((w) => (
            <span key={w} className="dp-weekday">{w}</span>
          ))}
          {cells.map((d) => {
            const iso = toISO(d)
            return (
              <button
                key={iso}
                type="button"
                className="dp-day"
                data-outside={d.getMonth() !== month || undefined}
                data-today={iso === today || undefined}
                data-selected={iso === selected || undefined}
                disabled={!inRange(iso)}
                onClick={() => pick(iso)}
              >
                {d.getDate()}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="dp-months">
          {MONTHS.map((m, i) => {
            const isCurrent = selected.startsWith(`${year}-${pad(i + 1)}`)
            return (
              <button
                key={m}
                type="button"
                className="dp-month"
                data-fast-click
                data-selected={isCurrent || undefined}
                onClick={() => {
                  setView(new Date(year, i, 1))
                  setMode('days')
                }}
              >
                {m.slice(0, 3)}
              </button>
            )
          })}
        </div>
      )}

      <div className="dp-foot">
        <button type="button" className="dp-link" disabled={!inRange(today)} onClick={() => pick(today)}>
          Today
        </button>
        {!target.required && selected && (
          <button
            type="button"
            className="dp-link"
            data-tone="muted"
            onClick={() => {
              commitValue(target, '')
              close(true)
            }}
          >
            Clear
          </button>
        )}
      </div>

      <style>{`
        @keyframes dp-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        .dp-panel {
          position: fixed; z-index: 1000; padding: 10px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
          font-family: var(--font-sans); animation: dp-in 140ms ease;
        }
        .dp-head { display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 6px; }
        .dp-nav, .dp-title, .dp-day, .dp-month, .dp-link {
          border: none; background: none; cursor: pointer; font-family: inherit; color: var(--foreground);
          transition: background 120ms ease, color 120ms ease;
        }
        .dp-nav { width: 28px; height: 28px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; color: var(--foreground-muted); }
        .dp-nav:hover, .dp-title:hover { background: var(--surface-muted, var(--background)); color: var(--foreground); }
        .dp-title { height: 28px; padding: 0 10px; border-radius: 8px; font-size: 13px; font-weight: 500; }
        .dp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
        .dp-weekday { height: 26px; display: flex; align-items: center; justify-content: center; font-size: 10.5px; font-weight: 500; color: var(--foreground-subtle); }
        .dp-day { height: 32px; border-radius: 8px; font-size: 12.5px; font-variant-numeric: tabular-nums; }
        .dp-day:hover:not(:disabled) { background: var(--surface-muted, var(--background)); }
        .dp-day[data-outside] { color: var(--foreground-subtle); }
        .dp-day[data-today] { box-shadow: inset 0 0 0 1px var(--accent-light); font-weight: 500; }
        .dp-day[data-selected], .dp-day[data-selected]:hover { background: var(--accent); color: #fff; font-weight: 500; box-shadow: none; }
        .dp-day:disabled { opacity: 0.3; cursor: not-allowed; }
        .dp-months { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 4px 0 6px; }
        .dp-month { height: 40px; border-radius: 8px; font-size: 12.5px; font-weight: 500; }
        .dp-month:hover { background: var(--surface-muted, var(--background)); }
        .dp-month[data-selected] { background: var(--accent-light-bg); color: var(--accent); font-weight: 500; }
        .dp-foot { display: flex; justify-content: space-between; margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--border); }
        .dp-link { height: 26px; padding: 0 8px; border-radius: 6px; font-size: 12px; font-weight: 500; color: var(--accent); }
        .dp-link[data-tone="muted"] { color: var(--foreground-muted); }
        .dp-link:hover:not(:disabled) { background: var(--accent-light-bg); }
        .dp-link:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </div>,
    document.body,
  )
}
