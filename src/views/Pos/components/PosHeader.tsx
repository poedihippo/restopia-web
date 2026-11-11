import React, { useEffect, useRef } from 'react'
import { ArrowLeft, ClipboardList, History, Power, Search } from 'lucide-react'
import PrinterStatusBar from '@/components/pos/PrinterStatusBar'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { shiftsService } from '@/services/shifts.service'
import { toastMutationApiError } from '@/utils/apiError'

interface PosHeaderProps {
  search: string
  setSearch: (val: string) => void
  setProductPage: (val: number) => void
  setShowHistory: (val: boolean) => void
  setShowPreorders: (val: boolean) => void
}

export default function PosHeader({
  search,
  setSearch,
  setProductPage,
  setShowHistory,
  setShowPreorders,
}: PosHeaderProps) {
  const qc = useQueryClient()

  const { data: shiftData } = useQuery({
    queryKey: ['shifts-current'],
    queryFn: () => shiftsService.current().then(r => r.data),
    retry: false,
  })
  const hasActiveShift = !!shiftData?.data

  const closeShiftMutation = useMutation({
    mutationFn: () => shiftsService.close(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts-current'] })
      toast.success('Shift closed successfully')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to close shift'),
  })

  // Ctrl+F / Cmd+F searches the POS instead of opening the browser's find bar:
  // the history search while that drawer is open, the product search otherwise.
  const productSearchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'f') return
      e.preventDefault()
      const target =
        document.querySelector<HTMLInputElement>('[data-pos-search="history"]') ?? productSearchRef.current
      target?.focus()
      target?.select()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const closing = closeShiftMutation.isPending
  const closeDisabled = closing || !hasActiveShift

  return (
    <>
      <style>{`
        .pos-hbtn {
          height: 38px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          flex-shrink: 0;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--foreground);
          font: 500 13px var(--font-sans);
          cursor: pointer;
          transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease;
        }
        .pos-hbtn:not(:disabled):hover { background: var(--surface-muted); border-color: var(--border-strong); }
        .pos-hbtn[data-tone="accent"] { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
        .pos-hbtn[data-tone="accent"]:not(:disabled):hover { background: var(--accent-hover); border-color: var(--accent-hover); box-shadow: var(--shadow-sm); }
        .pos-hbtn[data-tone="danger"] { background: var(--destructive); border-color: var(--destructive); color: #fff; font-weight: 600; }
        .pos-hbtn[data-tone="danger"]:not(:disabled):hover { filter: brightness(0.92); box-shadow: var(--shadow-sm); }
        .pos-hbtn:disabled { opacity: 0.5; cursor: not-allowed; }
        .pos-hbtn[data-icon-only] { width: 38px; padding: 0; justify-content: center; }
        .pos-search:focus-within { border-color: var(--accent-light); box-shadow: 0 0 0 3px var(--accent-light-bg); background: var(--surface); }
        @media (max-width: 1100px) { .pos-hbtn-label, .pos-brand-sub { display: none; } }
        /* Phones: two rows — actions on top, a full-width search below. */
        @media (max-width: 640px) {
          .pos-header {
            height: auto !important; flex-wrap: wrap; row-gap: 10px !important; column-gap: 8px !important;
            padding: 10px 12px !important;
          }
          .pos-brand-name, .pos-brand-divider, .pos-shift-label { display: none !important; }
          .pos-shift-chip { padding: 0 8px !important; }
          .pos-search { order: 10; flex: 1 1 100% !important; max-width: none !important; }
          .pos-header-spacer { display: block !important; }
          .pos-hbtn { height: 36px; }
          .pos-hbtn[data-icon-only], .pos-hbtn:has(.pos-hbtn-label) { width: 36px; padding: 0; justify-content: center; }
        }
      `}</style>
      <header
        className="pos-header"
        style={{
          height: 64,
          padding: '0 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          background: 'var(--surface)',
          gap: 14,
          fontFamily: 'var(--font-sans)',
        }}
      >
        <button
          type="button"
          className="pos-hbtn"
          data-icon-only
          aria-label="Back"
          title="Back"
          onClick={() => window.history.back()}
        >
          <ArrowLeft size={17} />
        </button>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <img src="/icon-dapcok.png" alt="" width={30} height={33} style={{ display: 'block' }} />
          <div className="pos-brand-name" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              Dapur Cokelat
            </span>
            <span className="pos-brand-sub" style={{ fontSize: 11.5, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
              Point of Sale
            </span>
          </div>
        </div>

        <span aria-hidden className="pos-brand-divider" style={{ width: 1, height: 28, background: 'var(--border)', flexShrink: 0 }} />

        {/* Search */}
        <label
          className="pos-search"
          style={{
            flex: 1,
            maxWidth: 560,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--surface-muted, var(--background))',
            transition: 'border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease',
            cursor: 'text',
          }}
        >
          <Search size={16} style={{ color: 'var(--foreground-subtle)', flexShrink: 0 }} />
          <input
            ref={productSearchRef}
            data-pos-search="products"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setProductPage(1)
            }}
            placeholder="Search products..."
            aria-label="Search products"
            style={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              border: 'none',
              background: 'transparent',
              fontSize: 14,
              color: 'var(--foreground)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </label>

        {/* Phones: pushes the actions to the right of the logo (search wraps below). */}
        <span className="pos-header-spacer" style={{ display: 'none', flex: 1 }} />

        {/* Cashier actions, next to the search */}
        <button type="button" className="pos-hbtn" data-tone="accent" onClick={() => setShowPreorders(true)} title="Pending Order">
          <ClipboardList size={16} />
          <span className="pos-hbtn-label">Pending Order</span>
        </button>
        <button type="button" className="pos-hbtn" onClick={() => setShowHistory(true)} title="History">
          <History size={16} />
          <span className="pos-hbtn-label">History</span>
        </button>

        {/* Right corner: shift */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Shift status */}
          <span
            className="pos-shift-chip"
            title={hasActiveShift ? 'A shift is open' : 'No open shift'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 10px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              background: hasActiveShift ? 'var(--success-bg)' : 'var(--surface-muted, var(--background))',
              color: hasActiveShift ? 'var(--success)' : 'var(--foreground-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: 999, background: hasActiveShift ? 'var(--success)' : 'var(--foreground-subtle)' }} />
            <span className="pos-shift-label">{hasActiveShift ? 'Shift open' : 'No shift'}</span>
          </span>

          <button
            type="button"
            className="pos-hbtn"
            data-tone="danger"
            onClick={() => {
              if (window.confirm('Close current shift? This will settle all pending payments.')) {
                closeShiftMutation.mutate()
              }
            }}
            disabled={closeDisabled}
            title="Close Shift"
          >
            <Power size={16} />
            <span className="pos-hbtn-label">{closing ? 'Closing...' : 'Close Shift'}</span>
          </button>
        </div>
      </header>
      <PrinterStatusBar />
    </>
  )
}
