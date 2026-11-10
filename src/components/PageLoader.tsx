'use client'

import React, { useEffect, useState } from 'react'

/*
 * Page loading screen: a small chocolate cake (ganache drips, flickering
 * candle, bobbing sprinkles) with rotating "baking" captions and a caramel
 * progress bar, so the wait reads as on-brand but still clearly as loading.
 * SVG + CSS only; motion is disabled under prefers-reduced-motion.
 */

const STEPS = ['Menyiapkan adonan…', 'Memanggang kue…', 'Melelehkan cokelat…', 'Menghias halaman…']

export default function PageLoader() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1400)
    return () => window.clearInterval(t)
  }, [])

  return (
    <div className="pl-wrap" role="status" aria-live="polite" aria-label="Memuat halaman">
      <svg className="pl-cake" width="132" height="132" viewBox="0 0 132 132" aria-hidden>
        {/* plate */}
        <ellipse cx="66" cy="116" rx="50" ry="7" fill="#EDE6DE" />
        <ellipse cx="66" cy="114" rx="44" ry="5" fill="#F7F1EA" />

        {/* sponge + filling */}
        <rect x="26" y="68" width="80" height="44" rx="8" fill="#E9C9A0" />
        <rect x="26" y="86" width="80" height="7" fill="#6B4330" opacity="0.85" />
        <rect x="26" y="100" width="80" height="5" fill="#C68B4E" opacity="0.7" />

        {/* ganache top + drips (drips grow down in a loop) */}
        <path d="M24 72 C24 63 30 60 38 60 L94 60 C102 60 108 63 108 72 Z" fill="#4A2E21" />
        <g fill="#4A2E21">
          <rect className="pl-drip pl-d1" x="34" y="70" width="7" height="14" rx="3.5" />
          <rect className="pl-drip pl-d2" x="52" y="70" width="6" height="18" rx="3" />
          <rect className="pl-drip pl-d3" x="72" y="70" width="7" height="12" rx="3.5" />
          <rect className="pl-drip pl-d4" x="90" y="70" width="6" height="16" rx="3" />
        </g>

        {/* sprinkles */}
        <g className="pl-sprinkles">
          <rect x="40" y="62" width="6" height="2.4" rx="1.2" fill="#F2C14E" transform="rotate(-20 43 63)" />
          <rect x="60" y="61" width="6" height="2.4" rx="1.2" fill="#E8A0A0" transform="rotate(25 63 62)" />
          <rect x="80" y="62" width="6" height="2.4" rx="1.2" fill="#FFF7EC" transform="rotate(-35 83 63)" />
          <rect x="70" y="64" width="5" height="2.2" rx="1.1" fill="#C68B4E" transform="rotate(10 72 65)" />
        </g>

        {/* candle + flame */}
        <rect x="63" y="38" width="6" height="22" rx="2" fill="#FFF7EC" stroke="#E2D3C2" strokeWidth="1" />
        <rect x="63" y="44" width="6" height="2.5" fill="#C68B4E" />
        <rect x="63" y="51" width="6" height="2.5" fill="#C68B4E" />
        <line x1="66" y1="38" x2="66" y2="34" stroke="#4A2E21" strokeWidth="1.2" />
        <g className="pl-flame">
          <path d="M66 18 C71 25 72 30 66 34 C60 30 61 25 66 18 Z" fill="#F2A541" />
          <path d="M66 24 C68.5 28 68.5 30.5 66 32.5 C63.5 30.5 63.5 28 66 24 Z" fill="#FFE29A" />
        </g>
      </svg>

      <div className="pl-text">
        <div className="pl-title">Memuat halaman</div>
        <div className="pl-step" key={step}>
          {STEPS[step]}
        </div>
      </div>
      <div className="pl-bar">
        <span />
      </div>

      <style>{`
        .pl-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 100%; min-height: 360px; }
        .pl-cake { animation: pl-bob 2.4s ease-in-out infinite; transform-origin: 50% 90%; }
        .pl-drip { transform-box: fill-box; transform-origin: 50% 0; animation: pl-drip 2.8s ease-in-out infinite; }
        .pl-d2 { animation-delay: .35s; }
        .pl-d3 { animation-delay: .7s; }
        .pl-d4 { animation-delay: 1.05s; }
        .pl-flame { transform-box: fill-box; transform-origin: 50% 100%; animation: pl-flicker .9s ease-in-out infinite alternate; }
        .pl-sprinkles { animation: pl-sprinkle 1.6s ease-in-out infinite; }
        .pl-text { text-align: center; }
        .pl-title { font-size: 13px; font-weight: 500; color: var(--foreground); }
        .pl-step { margin-top: 2px; font-size: 12px; color: var(--foreground-muted); animation: pl-fade .35s ease; }
        .pl-bar { position: relative; width: 140px; height: 3px; border-radius: 999px; overflow: hidden; background: var(--accent-light-bg); }
        .pl-bar > span { position: absolute; top: 0; bottom: 0; width: 40%; border-radius: 999px; background: linear-gradient(90deg, #E2B07A, var(--caramel, #C68B4E)); animation: pl-slide 1.3s ease-in-out infinite; }
        @keyframes pl-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes pl-drip { 0%, 100% { transform: scaleY(0.55); } 50% { transform: scaleY(1); } }
        @keyframes pl-flicker { 0% { transform: scale(1, 1) rotate(-2deg); } 100% { transform: scale(0.92, 1.08) rotate(2deg); } }
        @keyframes pl-sprinkle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
        @keyframes pl-fade { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
        @keyframes pl-slide { 0% { left: -40%; } 100% { left: 100%; } }
        @media (prefers-reduced-motion: reduce) {
          .pl-cake, .pl-drip, .pl-flame, .pl-sprinkles, .pl-step, .pl-bar > span { animation: none; }
          .pl-bar > span { left: 30%; }
        }
      `}</style>
    </div>
  )
}
