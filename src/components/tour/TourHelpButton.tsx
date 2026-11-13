'use client'
// Top-bar help menu: replay the tours, page tips on/off, FAQ.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { BookOpen, CircleHelp, Compass, Lightbulb, RotateCcw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { resolveSteps, tourForPath, WELCOME_TOUR } from './tours'
import { resetTours, setTipsEnabled, startTour, tipsEnabled, useTourVersion } from './tourStore'

export default function TourHelpButton() {
  const router = useRouter()
  const { user, hasPermission } = useAuth()
  const userId = user?.id != null ? String(user.id) : ''
  useTourVersion()
  const [open, setOpen] = useState(false)
  const [pageSteps, setPageSteps] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const pageTour = tourForPath(router.pathname)
  const tips = userId ? tipsEnabled(userId) : true
  const canFaq = hasPermission('accounting-dashboard.menu') || hasPermission('journal.menu')

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggleMenu = () => {
    // Count the page's tips now, so "Tips halaman ini" only shows when it has some.
    if (!open) setPageSteps(pageTour ? resolveSteps(pageTour).length : 0)
    setOpen((v) => !v)
  }

  const run = (id: string) => {
    setOpen(false)
    // Let the menu close before the spotlight measures the page.
    window.setTimeout(() => startTour(id), 60)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        data-tour="help"
        className="tour-help-btn"
        data-open={open || undefined}
        onClick={toggleMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Bantuan dan tur"
        title="Bantuan dan tur"
      >
        <CircleHelp size={16} />
      </button>

      {open && (
        <div className="tour-help-menu" role="menu">
          <div className="tour-help-head">Bantuan</div>
          {pageTour && pageSteps > 0 && (
            <button type="button" role="menuitem" className="tour-help-item" onClick={() => run(pageTour.id)}>
              <span className="tour-help-icon">
                <Lightbulb size={14} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="tour-help-label">Tips halaman ini</span>
                <span className="tour-help-sub">{pageTour.title} · {pageSteps} langkah</span>
              </span>
            </button>
          )}
          <button type="button" role="menuitem" className="tour-help-item" onClick={() => run(WELCOME_TOUR.id)}>
            <span className="tour-help-icon">
              <Compass size={14} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="tour-help-label">Tur pengenalan aplikasi</span>
              <span className="tour-help-sub">Menu, cabang, pencarian, dan akun</span>
            </span>
          </button>
          {canFaq && (
            <Link href="/accounting/faq" role="menuitem" className="tour-help-item" onClick={() => setOpen(false)}>
              <span className="tour-help-icon">
                <BookOpen size={14} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="tour-help-label">FAQ Akuntansi</span>
                <span className="tour-help-sub">Jawaban pertanyaan yang sering muncul</span>
              </span>
            </Link>
          )}

          <div className="tour-help-sep" />
          <label className="tour-help-switch">
            <span style={{ flex: 1 }}>Tawarkan tips di setiap modul</span>
            <input type="checkbox" role="switch" checked={tips} onChange={(e) => userId && setTipsEnabled(userId, e.target.checked)} />
            <span className="tour-switch" aria-hidden />
          </label>
          <button
            type="button"
            role="menuitem"
            className="tour-help-item tour-help-quiet"
            onClick={() => {
              if (!userId) return
              resetTours(userId)
              setOpen(false)
              toast.success('Semua tur akan ditampilkan lagi')
            }}
          >
            <RotateCcw size={13} /> Tampilkan ulang semua tur
          </button>
        </div>
      )}

      <style>{`
        .tour-help-btn {
          width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center;
          border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface);
          color: var(--foreground-muted); cursor: pointer; transition: background 150ms ease, color 150ms ease;
        }
        .tour-help-btn:hover, .tour-help-btn[data-open] { background: var(--accent-light-bg); color: var(--accent); }
        .tour-help-menu {
          position: absolute; top: calc(100% + 6px); right: 0; z-index: 60; width: 290px; padding: 6px;
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
          animation: tour-help-in 140ms ease;
        }
        @keyframes tour-help-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        .tour-help-head { padding: 6px 8px 4px; font-size: 10.5px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--foreground-subtle); }
        .tour-help-item {
          display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px; border: none; border-radius: var(--radius-md);
          background: transparent; text-align: left; font: inherit; color: var(--foreground); text-decoration: none; cursor: pointer;
        }
        .tour-help-item:hover { background: var(--background); }
        .tour-help-icon { width: 28px; height: 28px; flex-shrink: 0; border-radius: 8px; background: var(--accent-light-bg); color: var(--accent); display: inline-flex; align-items: center; justify-content: center; }
        .tour-help-label { display: block; font-size: 13px; font-weight: 500; }
        .tour-help-sub { display: block; font-size: 11.5px; color: var(--foreground-muted); margin-top: 1px; }
        .tour-help-sep { height: 1px; margin: 6px 4px; background: var(--border); }
        .tour-help-quiet { font-size: 12px; color: var(--foreground-muted); gap: 6px; padding: 7px 8px; }
        .tour-help-switch { position: relative; display: flex; align-items: center; gap: 10px; padding: 8px; font-size: 12.5px; color: var(--foreground); cursor: pointer; border-radius: var(--radius-md); }
        .tour-help-switch:hover { background: var(--background); }
        .tour-help-switch input { position: absolute; opacity: 0; pointer-events: none; }
        .tour-switch { width: 32px; height: 18px; flex-shrink: 0; border-radius: 999px; background: var(--border-strong); position: relative; transition: background 150ms ease; }
        .tour-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.2); transition: transform 150ms ease; }
        .tour-help-switch input:checked + .tour-switch { background: var(--accent); }
        .tour-help-switch input:checked + .tour-switch::after { transform: translateX(14px); }
        .tour-help-switch input:focus-visible + .tour-switch { outline: 2px solid var(--accent-light); outline-offset: 2px; }
      `}</style>
    </div>
  )
}
