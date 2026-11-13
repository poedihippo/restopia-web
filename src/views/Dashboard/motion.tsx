'use client'
// Motion shared by the dashboards: count-up numbers and blocks that fade/rise
// in as they scroll into view (both off under prefers-reduced-motion). The
// page's own CSS styles `.dash-anim [data-reveal]` / `.is-in`.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Eases from the previous value to the new one (0 on first render).
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(0)
  const fromRef = useRef(0)
  useEffect(() => {
    const from = fromRef.current
    const dur = prefersReducedMotion() ? 0 : 1000
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = dur ? Math.min(1, (t - t0) / dur) : 1
      const v = p === 1 ? value : from + (value - from) * (1 - (1 - p) ** 3)
      fromRef.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{format(shown)}</>
}

export function useReveal(ref: React.RefObject<HTMLElement | null>, selector: string) {
  useLayoutEffect(() => {
    const root = ref.current
    if (!root || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return
    root.classList.add('dash-anim')
    const io = new IntersectionObserver(
      (entries) => {
        const pos = (el: Element) => el.getBoundingClientRect()
        // Already scrolled past (fast scroll, late mount): show without animating.
        entries
          .filter((e) => !e.isIntersecting && e.boundingClientRect.bottom < 0)
          .forEach((e) => {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          })
        entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          .sort((a, b) => pos(a).top - pos(b).top || pos(a).left - pos(b).left)
          .forEach((el, i) => {
            el.style.setProperty('--reveal-delay', `${Math.min(i, 8) * 70}ms`)
            el.classList.add('is-in')
            io.unobserve(el)
          })
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
    )
    // Per-run set (not a DOM flag): StrictMode re-runs this effect on the same nodes.
    const seen = new WeakSet<Element>()
    let queued = 0
    const scan = () => {
      queued = 0
      root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        if (seen.has(el) || el.classList.contains('is-in')) return
        seen.add(el)
        el.dataset.reveal = ''
        io.observe(el)
      })
    }
    scan()
    const mo = new MutationObserver(() => {
      if (!queued) queued = requestAnimationFrame(scan)
    })
    mo.observe(root, { childList: true, subtree: true })
    return () => {
      io.disconnect()
      mo.disconnect()
      cancelAnimationFrame(queued)
    }
  }, [ref, selector])
}
