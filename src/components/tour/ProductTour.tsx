'use client'
// Product tour overlay + first-run logic. Mounted once in GlobalLayout.
//  - Welcome tour starts by itself the first time a user signs in.
//  - On a module's first visit a small prompt offers that page's tour
//    ("Mulai" / "Nanti" / never), instead of interrupting the work.
//  - Every tour can be skipped (Esc / "Lewati") and replayed from the help menu.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, ArrowRight, Compass, Sparkles, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { resolveSteps, tourById, tourForPath, WELCOME_TOUR, type Tour, type TourStep } from './tours'
import {
  hasSeenTour,
  isSnoozed,
  markTourSeen,
  setTipsEnabled,
  setTourStep,
  snoozeTour,
  startTour,
  stopTour,
  tipsEnabled,
  useActiveTour,
  useTourVersion,
} from './tourStore'

const PAD = 6
const GAP = 14
const CARD_W = 340

type Rect = { top: number; left: number; width: number; height: number }
type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'sheet' | 'dock'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function place(target: Rect | null, card: { w: number; h: number }): { top: number; left: number; placement: Placement; arrow: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (!target) return { top: (vh - card.h) / 2, left: (vw - card.w) / 2, placement: 'center', arrow: 0 }
  if (vw < 640) return { top: vh - card.h - 12, left: 12, placement: 'sheet', arrow: 0 }

  const space = { bottom: vh - (target.top + target.height), top: target.top, right: vw - (target.left + target.width), left: target.left }
  const fitsV = (s: number) => s >= card.h + GAP + 8
  const fitsH = (s: number) => s >= card.w + GAP + 8
  // Tall targets (sidebar, big tables) read better with the card beside them.
  const tall = target.height > vh * 0.55
  const order: Placement[] = tall ? ['right', 'left', 'bottom', 'top'] : ['bottom', 'top', 'right', 'left']
  const placement = order.find((p) => (p === 'bottom' ? fitsV(space.bottom) : p === 'top' ? fitsV(space.top) : p === 'right' ? fitsH(space.right) : fitsH(space.left)))
  // Target fills the screen (a long table): dock the card at the bottom edge
  // over the target's lower part rather than in the middle of it.
  if (!placement) return { top: vh - card.h - 16, left: Math.max(12, Math.min(vw - card.w - 12, target.left + target.width - card.w - 16)), placement: 'dock', arrow: 0 }

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
  const cx = target.left + target.width / 2
  const cy = target.top + target.height / 2
  let top: number
  let left: number
  if (placement === 'bottom' || placement === 'top') {
    left = clamp(cx - card.w / 2, 12, vw - card.w - 12)
    top = placement === 'bottom' ? target.top + target.height + GAP : target.top - card.h - GAP
    return { top, left, placement, arrow: clamp(cx - left, 20, card.w - 20) }
  }
  if (placement === 'right' || placement === 'left') {
    top = clamp(cy - card.h / 2, 12, vh - card.h - 12)
    left = placement === 'right' ? target.left + target.width + GAP : target.left - card.w - GAP
    return { top, left, placement, arrow: clamp(cy - top, 20, card.h - 20) }
  }
  return { top: (vh - card.h) / 2, left: (vw - card.w) / 2, placement: 'center', arrow: 0 }
}

function Kbd({ keys }: { keys: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {keys.split(' ').map((k) => (
        <kbd key={k} className="tour-kbd">
          {k}
        </kbd>
      ))}
    </span>
  )
}

function TourRunner({ tour, stepIndex, onFinish }: { tour: Tour; stepIndex: number; onFinish: (completed: boolean) => void }) {
  const [steps, setSteps] = useState<{ step: TourStep; el: Element | null }[]>(() => resolveSteps(tour))
  const [rect, setRect] = useState<Rect | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number; placement: Placement; arrow: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const lastFocus = useRef<Element | null>(null)
  // The card glides between steps, but must appear in place the first time
  // (not slide in from its off-screen starting point).
  const [animate, setAnimate] = useState(false)
  useEffect(() => {
    if (!pos || animate) return
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [pos, animate])

  const current = steps[Math.min(stepIndex, steps.length - 1)]
  const total = steps.length
  const isLast = stepIndex >= total - 1

  // Re-resolve once the page settles (lists mount after their data loads).
  useEffect(() => {
    const t = window.setTimeout(() => setSteps(resolveSteps(tour)), 250)
    return () => window.clearTimeout(t)
  }, [tour])

  useEffect(() => {
    lastFocus.current = document.activeElement
    return () => (lastFocus.current as HTMLElement | null)?.focus?.({ preventScroll: true })
  }, [])

  const measure = useCallback(() => {
    const el = current?.el
    const r = el?.getBoundingClientRect()
    const next = r ? { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 } : null
    // Keep the spotlight inside the window (a sidebar is taller than the screen).
    if (next) {
      const top = Math.max(4, next.top)
      const bottom = Math.min(window.innerHeight - 4, next.top + next.height)
      next.top = top
      next.height = Math.max(0, bottom - top)
    }
    setRect(next)
    const card = cardRef.current
    if (card) setPos(place(next, { w: card.offsetWidth, h: card.offsetHeight }))
  }, [current])

  // Bring the target into view, then follow it while the page scrolls/resizes.
  useLayoutEffect(() => {
    const el = current?.el as HTMLElement | null
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.top < 70 || r.bottom > window.innerHeight - 20) el.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
    }
    measure()
    let frames = 0
    let raf = 0
    const settle = () => {
      measure()
      if (++frames < 30) raf = requestAnimationFrame(settle)
    }
    raf = requestAnimationFrame(settle)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    cardRef.current?.focus({ preventScroll: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [current, measure])

  const next = useCallback(() => (isLast ? onFinish(true) : setTourStep(stepIndex + 1)), [isLast, onFinish, stepIndex])
  const back = useCallback(() => stepIndex > 0 && setTourStep(stepIndex - 1), [stepIndex])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onFinish(false)
      } else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement))) {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        back()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [next, back, onFinish])

  if (!current) return null
  const centred = !current.el
  const isWelcomeIntro = tour.id === WELCOME_TOUR.id && (stepIndex === 0 || isLast) && centred
  const placement = pos?.placement ?? 'center'

  const cardStyle: CSSProperties = {
    top: pos?.top ?? -9999,
    left: pos?.left ?? -9999,
    width: placement === 'sheet' ? 'calc(100vw - 24px)' : CARD_W,
    visibility: pos ? 'visible' : 'hidden',
    transition: animate ? undefined : 'none',
  }

  return (
    <div className="tour-root" role="presentation">
      {/* Dim layer with a hole over the target; blocks clicks on the page. */}
      {rect ? (
        <div className="tour-spot" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-shield" />

      <div
        ref={cardRef}
        className="tour-card"
        data-placement={placement}
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
      >
        {(placement === 'top' || placement === 'bottom' || placement === 'left' || placement === 'right') && (
          <span className="tour-arrow" data-placement={placement} style={placement === 'top' || placement === 'bottom' ? { left: pos!.arrow } : { top: pos!.arrow }} />
        )}
        <div className="tour-progress">
          <span style={{ width: `${((stepIndex + 1) / total) * 100}%` }} />
        </div>

        {isWelcomeIntro && (
          <div className="tour-hero">
            <span className="tour-hero-icon">{stepIndex === 0 ? <Compass size={22} /> : <Sparkles size={22} />}</span>
          </div>
        )}

        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="tour-chip">{tour.title}</span>
            <span style={{ fontSize: 11.5, color: 'var(--foreground-subtle)', fontVariantNumeric: 'tabular-nums' }}>
              {stepIndex + 1} / {total}
            </span>
            <button type="button" className="tour-x" onClick={() => onFinish(false)} aria-label="Tutup tur">
              <X size={14} />
            </button>
          </div>
          <h3 id="tour-title" className="tour-title">
            {current.step.title}
          </h3>
          <p id="tour-body" className="tour-body" aria-live="polite">
            {current.step.body}
          </p>
          {current.step.kbd && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11.5, color: 'var(--foreground-muted)' }}>
              Pintasan <Kbd keys={current.step.kbd} />
            </div>
          )}
        </div>

        <div className="tour-actions">
          {!isLast ? (
            <button type="button" className="tour-skip" onClick={() => onFinish(false)}>
              Lewati tur
            </button>
          ) : (
            <span />
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            {stepIndex > 0 && (
              <button type="button" className="v2-btn v2-btn-ghost v2-btn-sm" onClick={back}>
                <ArrowLeft size={13} /> Kembali
              </button>
            )}
            <button type="button" className="v2-btn v2-btn-primary v2-btn-sm" onClick={next} autoFocus>
              {isLast ? 'Selesai' : stepIndex === 0 && centred ? 'Mulai tur' : 'Lanjut'}
              {!isLast && <ArrowRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Small corner card offering a module's tour on its first visit. */
function TourPrompt({ tour, steps, onStart, onLater, onNever }: { tour: Tour; steps: number; onStart: () => void; onLater: () => void; onNever: () => void }) {
  return (
    <div className="tour-prompt" role="status">
      <span className="tour-prompt-icon">
        <Sparkles size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Baru di {tour.title}?</div>
        <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2, lineHeight: 1.45 }}>
          Lihat {steps} tips singkat untuk halaman ini.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <button type="button" className="v2-btn v2-btn-primary v2-btn-sm" onClick={onStart}>
            Lihat tips
          </button>
          <button type="button" className="v2-btn v2-btn-ghost v2-btn-sm" onClick={onLater}>
            Nanti
          </button>
          <button type="button" className="tour-never" onClick={onNever}>
            Jangan tampilkan lagi
          </button>
        </div>
      </div>
      <button type="button" className="tour-x" onClick={onLater} aria-label="Tutup">
        <X size={14} />
      </button>
    </div>
  )
}

export default function ProductTour({ ready }: { ready: boolean }) {
  const router = useRouter()
  const { user } = useAuth()
  const userId = user?.id != null ? String(user.id) : ''
  const active = useActiveTour()
  useTourVersion()
  const pathname = router.pathname
  const [prompt, setPrompt] = useState<{ tour: Tour; steps: number } | null>(null)

  const activeTour = active ? tourById(active.tourId, pathname) : null

  // A tour belongs to the page it started on: leaving the page ends it.
  useEffect(() => {
    if (active && !activeTour) stopTour()
  }, [active, activeTour])

  // First sign-in: the welcome tour, once per user.
  useEffect(() => {
    if (!ready || !userId || active) return
    if (hasSeenTour(userId, WELCOME_TOUR.id, WELCOME_TOUR.version)) return
    const t = window.setTimeout(() => startTour(WELCOME_TOUR.id), 900)
    return () => window.clearTimeout(t)
  }, [ready, userId, active])

  // First visit to a module: offer its tour once the page has rendered.
  useEffect(() => {
    if (!ready || !userId || active) return
    if (!hasSeenTour(userId, WELCOME_TOUR.id, WELCOME_TOUR.version) || !tipsEnabled(userId)) return
    const tour = tourForPath(pathname)
    if (!tour || hasSeenTour(userId, tour.id, tour.version) || isSnoozed(tour.id)) return
    // Lists render after their data arrives: look again for a while before
    // deciding the page has too little to show.
    let tries = 0
    let t = 0
    const check = () => {
      const count = resolveSteps(tour).length
      if (count >= 2) setPrompt({ tour, steps: count })
      else if (++tries < 8) t = window.setTimeout(check, 1500)
    }
    t = window.setTimeout(check, 1800)
    return () => {
      window.clearTimeout(t)
      setPrompt(null)
    }
  }, [ready, userId, active, pathname])

  const finish = useCallback(
    (_completed: boolean) => {
      if (activeTour && userId) markTourSeen(userId, activeTour.id, activeTour.version)
      stopTour()
    },
    [activeTour, userId],
  )

  return (
    <>
      <style>{CSS}</style>
      {active && activeTour && <TourRunner key={activeTour.id} tour={activeTour} stepIndex={active.step} onFinish={finish} />}
      {!active && prompt && (
        <TourPrompt
          tour={prompt.tour}
          steps={prompt.steps}
          onStart={() => {
            setPrompt(null)
            startTour(prompt.tour.id)
          }}
          onLater={() => {
            snoozeTour(prompt.tour.id)
            setPrompt(null)
          }}
          onNever={() => {
            if (userId) setTipsEnabled(userId, false)
            setPrompt(null)
          }}
        />
      )}
    </>
  )
}

const CSS = `
  .tour-root { position: fixed; inset: 0; z-index: 1000; pointer-events: none; }
  .tour-shield { position: fixed; inset: 0; pointer-events: auto; }
  .tour-dim { position: fixed; inset: 0; background: rgba(26, 17, 12, 0.55); animation: tour-fade 200ms ease; }
  .tour-spot {
    position: fixed; border-radius: 12px; pointer-events: none;
    box-shadow: 0 0 0 9999px rgba(26, 17, 12, 0.55);
    outline: 2px solid color-mix(in srgb, var(--caramel, #C68B4E) 80%, white);
    outline-offset: 0;
    transition: top 280ms cubic-bezier(0.22, 1, 0.36, 1), left 280ms cubic-bezier(0.22, 1, 0.36, 1), width 280ms cubic-bezier(0.22, 1, 0.36, 1), height 280ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .tour-spot::after { content: ''; position: absolute; inset: -6px; border-radius: 16px; border: 2px solid var(--caramel, #C68B4E); opacity: 0; animation: tour-ring 2s ease-out infinite; }

  .tour-card {
    position: fixed; pointer-events: auto; overflow: visible; outline: none;
    background: var(--surface); color: var(--foreground); border-radius: 16px;
    border: 1px solid var(--border); box-shadow: 0 24px 48px -12px rgba(26, 17, 12, 0.45);
    font-family: var(--font-sans);
    transition: top 280ms cubic-bezier(0.22, 1, 0.36, 1), left 280ms cubic-bezier(0.22, 1, 0.36, 1);
    animation: tour-pop 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .tour-card[data-placement="sheet"] { border-radius: 18px; }
  .tour-card[data-placement="dock"] { box-shadow: 0 24px 48px -12px rgba(26, 17, 12, 0.55), 0 0 0 4px rgba(255, 255, 255, 0.35); }
  .tour-progress { height: 3px; margin: 0 16px; border-radius: 0 0 3px 3px; background: var(--border); overflow: hidden; }
  .tour-progress > span { display: block; height: 100%; background: linear-gradient(90deg, #E2B07A, var(--caramel, #C68B4E)); transition: width 280ms ease; }
  .tour-hero {
    margin: 12px 16px 0; height: 76px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle at 80% 0%, rgba(198, 139, 78, 0.45), transparent 60%), linear-gradient(135deg, var(--cocoa-700, #4A2E21), var(--cocoa-900, #2A1A13));
  }
  .tour-hero-icon { width: 44px; height: 44px; border-radius: 14px; background: rgba(255,255,255,0.12); color: var(--caramel, #C68B4E); display: inline-flex; align-items: center; justify-content: center; }
  .tour-chip { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: var(--accent-light-bg); color: var(--accent); white-space: nowrap; max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
  .tour-x { margin-left: auto; width: 26px; height: 26px; flex-shrink: 0; border: none; border-radius: 8px; background: transparent; color: var(--foreground-subtle); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
  .tour-x:hover { background: var(--background); color: var(--foreground); }
  .tour-title { margin: 10px 0 0; font-family: var(--font-display); font-size: 17px; font-weight: 600; line-height: 1.3; color: var(--foreground); }
  .tour-body { margin: 6px 0 0; font-size: 13px; line-height: 1.55; color: var(--foreground-muted); }
  .tour-kbd { display: inline-flex; align-items: center; height: 20px; padding: 0 6px; border-radius: 5px; border: 1px solid var(--border); border-bottom-width: 2px; background: var(--background); font: 600 11px var(--font-sans); color: var(--foreground); }
  .tour-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 16px 14px; }
  .tour-skip, .tour-never { border: none; background: transparent; padding: 4px 2px; font: inherit; font-size: 12px; color: var(--foreground-subtle); cursor: pointer; }
  .tour-skip:hover, .tour-never:hover { color: var(--foreground); text-decoration: underline; }

  .tour-arrow { position: absolute; width: 12px; height: 12px; background: var(--surface); border: 1px solid var(--border); transform: rotate(45deg); }
  .tour-arrow[data-placement="bottom"] { top: -7px; margin-left: -6px; border-right: none; border-bottom: none; }
  .tour-arrow[data-placement="top"] { bottom: -7px; margin-left: -6px; border-left: none; border-top: none; }
  .tour-arrow[data-placement="right"] { left: -7px; margin-top: -6px; border-right: none; border-top: none; }
  .tour-arrow[data-placement="left"] { right: -7px; margin-top: -6px; border-left: none; border-bottom: none; }

  .tour-prompt {
    position: fixed; right: 20px; bottom: 20px; z-index: 900; width: 330px; max-width: calc(100vw - 24px);
    display: flex; gap: 12px; align-items: flex-start; padding: 14px 12px 14px 14px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
    box-shadow: 0 18px 40px -14px rgba(26, 17, 12, 0.35); font-family: var(--font-sans);
    animation: tour-rise 320ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .tour-prompt-icon { width: 34px; height: 34px; flex-shrink: 0; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--cocoa-700, #4A2E21), var(--cocoa-900, #2A1A13)); color: var(--caramel, #C68B4E); }
  @media (max-width: 640px) { .tour-prompt { right: 12px; left: 12px; bottom: 12px; width: auto; } }

  @keyframes tour-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes tour-pop { from { opacity: 0; transform: scale(0.96) translateY(4px); } to { opacity: 1; transform: none; } }
  @keyframes tour-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  @keyframes tour-ring { 0% { opacity: 0.7; transform: scale(0.98); } 100% { opacity: 0; transform: scale(1.06); } }
  @media (prefers-reduced-motion: reduce) {
    .tour-spot, .tour-card, .tour-progress > span { transition: none; }
    .tour-card, .tour-prompt, .tour-dim { animation: none; }
    .tour-spot::after { animation: none; }
  }
`
