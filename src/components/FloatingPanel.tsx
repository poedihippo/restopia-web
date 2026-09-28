'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

interface FloatingPanelProps {
  anchorRef: React.RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  minWidth?: number
  maxHeight?: number
  children: React.ReactNode
}

export function FloatingPanel({
  anchorRef, open, onClose, minWidth = 0, maxHeight = 300, children,
}: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed', top: 0, left: 0, visibility: 'hidden',
  })

  const update = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const r = anchor.getBoundingClientRect()
    const gap = 4
    const margin = 8

    const spaceBelow = window.innerHeight - r.bottom - margin
    const spaceAbove = r.top - margin
    const contentH = Math.min(panelRef.current?.scrollHeight ?? maxHeight, maxHeight)
    const openUp = spaceBelow < contentH && spaceAbove > spaceBelow
    const available = (openUp ? spaceAbove : spaceBelow) - gap

    const width = Math.max(r.width, minWidth)
    const left = Math.max(margin, Math.min(r.left, window.innerWidth - width - margin))

    const newStyle: React.CSSProperties = {
      position: 'fixed',
      left,
      width,
      ...(openUp
        ? { bottom: window.innerHeight - r.top + gap }
        : { top: r.bottom + gap }),
      maxHeight: Math.max(120, Math.min(maxHeight, available)),
      overflowY: 'auto',
      zIndex: 9999,
      visibility: 'visible',
    }
    setStyle(newStyle)
  }, [anchorRef, maxHeight, minWidth])

  useLayoutEffect(() => {
    if (!open) return
    update()
    const raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [open, update, children])

  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, update])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, anchorRef])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div ref={panelRef} data-floating-panel style={{
      ...style,
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-lg)',
    }}>
      {children}
    </div>,
    document.body,
  )
}
