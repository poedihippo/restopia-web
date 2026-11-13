'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import {
  ArrowUpRight,
  CalendarRange,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  FileBarChart,
  HandCoins,
  Landmark,
  Link2,
  ListTodo,
  NotebookPen,
  Scale,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { FAQ_CATEGORIES, FAQ_ITEMS, type FaqCategoryKey, type FaqItem } from './faqData'

const CATEGORY_LOOK: Record<FaqCategoryKey, { icon: LucideIcon; tone: string }> = {
  periode: { icon: CalendarRange, tone: 'blue' },
  jurnal: { icon: NotebookPen, tone: 'lavender' },
  'kas-bank': { icon: Landmark, tone: 'mint' },
  rekonsiliasi: { icon: Scale, tone: 'gold' },
  laporan: { icon: FileBarChart, tone: 'coral' },
  'piutang-hutang': { icon: HandCoins, tone: 'mint' },
  setup: { icon: SlidersHorizontal, tone: 'lavender' },
}

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function haystack(item: FaqItem): string {
  return normalize([item.question, ...item.answer, ...(item.steps ?? []), item.errorText ?? '', ...(item.links ?? []).map((l) => l.label)].join(' '))
}

/** Wraps every occurrence of the query's words in <mark>. */
function Highlight({ text, words }: { text: string; words: string[] }) {
  if (words.length === 0) return <>{text}</>
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="faq-mark">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}

function FaqEntry({ item, open, onToggle, words }: { item: FaqItem; open: boolean; onToggle: () => void; words: string[] }) {
  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?q=${item.id}`
    navigator.clipboard?.writeText(url).then(
      () => toast.success('Tautan pertanyaan disalin'),
      () => toast.error('Tautan tidak bisa disalin'),
    )
  }

  return (
    <div id={`faq-${item.id}`} className="faq-entry" data-open={open || undefined}>
      <button type="button" className="faq-q" onClick={onToggle} aria-expanded={open}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <Highlight text={item.question} words={words} />
        </span>
        <ChevronDown size={16} className="faq-chevron" />
      </button>
      <div className="faq-collapse">
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          <div className="faq-a">
            {item.answer.map((p, i) => (
              <p key={i}>
                <Highlight text={p} words={words} />
              </p>
            ))}
            {item.steps && (
              <ol className="faq-steps">
                {item.steps.map((s, i) => (
                  <li key={i}>
                    <span className="faq-step-no">{i + 1}</span>
                    <span>
                      <Highlight text={s} words={words} />
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {(item.links ?? []).map((l) => (
                <Link key={l.href} href={l.href} className="faq-link">
                  {l.label} <ArrowUpRight size={12} />
                </Link>
              ))}
              <button type="button" className="faq-copy" onClick={copyLink} title="Salin tautan ke pertanyaan ini">
                <Link2 size={13} /> Salin tautan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function IconTile({ icon: Icon, tone, size = 30 }: { icon: LucideIcon; tone: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: Math.round(size / 3.2),
        background: `var(--pastel-${tone})`,
        color: `var(--pastel-${tone}-ink)`,
        border: `1px solid color-mix(in srgb, var(--pastel-${tone}-ink) 18%, transparent)`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={Math.round(size * 0.5)} />
    </span>
  )
}

export default function AccountingFaqView() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FaqCategoryKey | 'all'>('all')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const searchRef = useRef<HTMLInputElement>(null)

  const words = useMemo(
    () =>
      query
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 1),
    [query],
  )

  const results = useMemo(() => {
    const ws = words.map(normalize)
    return FAQ_ITEMS.filter((item) => {
      if (category !== 'all' && item.category !== category) return false
      if (ws.length === 0) return true
      const hay = haystack(item)
      return ws.every((w) => hay.includes(w))
    })
  }, [words, category])

  const countByCategory = useMemo(() => {
    const ws = words.map(normalize)
    const counts: Record<string, number> = {}
    for (const item of FAQ_ITEMS) {
      if (ws.length && !ws.every((w) => haystack(item).includes(w))) continue
      counts[item.category] = (counts[item.category] ?? 0) + 1
    }
    return counts
  }, [words])

  // ?q=<id> (from "Salin tautan"): that question starts open and is scrolled to.
  const deepLink = typeof router.query.q === 'string' ? router.query.q : ''
  const [linkClosed, setLinkClosed] = useState(false)
  const scrolledTo = useRef('')
  useEffect(() => {
    if (!deepLink || scrolledTo.current === deepLink) return
    scrolledTo.current = deepLink
    requestAnimationFrame(() => document.getElementById(`faq-${deepLink}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }, [deepLink])

  // While searching, every match is shown open so the answer text is visible.
  const searching = words.length > 0
  const isOpen = (id: string) => searching || open.has(id) || (id === deepLink && !linkClosed)

  const toggle = (id: string) => {
    if (id === deepLink && !linkClosed && !open.has(id)) {
      setLinkClosed(true)
      return
    }
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const allOpen = results.length > 0 && results.every((i) => isOpen(i.id))

  const sections = FAQ_CATEGORIES.map((c) => ({ ...c, items: results.filter((i) => i.category === c.key) })).filter((c) => c.items.length > 0)

  return (
    <div className="faq" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0 32px' }}>
      <style>{CSS}</style>

      <section className="faq-hero">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Bantuan akuntansi
          </span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            Ada yang bisa dibantu?
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--foreground-muted)', margin: 0, maxWidth: 560, lineHeight: 1.5 }}>
            Jawaban untuk pertanyaan yang sering muncul saat memakai modul akuntansi. Cari dengan kata kunci atau tempel pesan error yang muncul.
          </p>
          <div className="faq-search">
            <Search size={16} className="faq-search-icon" />
            <input
              ref={searchRef}
              type="search"
              data-search
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
              placeholder="Cari pertanyaan atau pesan error…  (Ctrl+F)"
              aria-label="Cari FAQ"
            />
            {query && (
              <button type="button" className="faq-search-clear" onClick={() => setQuery('')} aria-label="Hapus pencarian">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <FaqArt />
      </section>

      <div className="faq-body">
        <nav className="faq-nav" aria-label="Kategori FAQ">
          <button type="button" className="faq-cat" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
            <IconTile icon={ListTodo} tone="gold" size={26} />
            <span style={{ flex: 1, minWidth: 0 }}>Semua topik</span>
            <span className="faq-cat-count">{Object.values(countByCategory).reduce((a, b) => a + b, 0)}</span>
          </button>
          {FAQ_CATEGORIES.map((c) => {
            const look = CATEGORY_LOOK[c.key]
            return (
              <button
                key={c.key}
                type="button"
                className="faq-cat"
                aria-pressed={category === c.key}
                onClick={() => setCategory(c.key)}
                disabled={!countByCategory[c.key]}
              >
                <IconTile icon={look.icon} tone={look.tone} size={26} />
                <span style={{ flex: 1, minWidth: 0 }}>{c.title}</span>
                <span className="faq-cat-count">{countByCategory[c.key] ?? 0}</span>
              </button>
            )
          })}
        </nav>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>
              {results.length} pertanyaan{searching ? ` cocok dengan “${query.trim()}”` : ''}
            </span>
            {!searching && results.length > 0 && (
              <button
                type="button"
                className="v2-btn v2-btn-ghost v2-btn-sm"
                onClick={() => {
                  setOpen(allOpen ? new Set() : new Set(results.map((i) => i.id)))
                  setLinkClosed(allOpen)
                }}
              >
                {allOpen ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
                {allOpen ? 'Tutup semua' : 'Buka semua'}
              </button>
            )}
          </div>

          {sections.length === 0 ? (
            <div className="v2-card" style={{ padding: '36px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
              <span style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--accent-light-bg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <SearchX size={22} style={{ color: 'var(--accent)' }} />
              </span>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>Tidak ada jawaban yang cocok</div>
              <div style={{ fontSize: 12.5, color: 'var(--foreground-muted)', maxWidth: 400 }}>Coba kata kunci lain, misalnya “periode”, “rekonsiliasi”, atau sebagian pesan error.</div>
              <button
                type="button"
                className="v2-btn v2-btn-ghost v2-btn-sm"
                onClick={() => {
                  setQuery('')
                  setCategory('all')
                  searchRef.current?.focus()
                }}
              >
                Reset pencarian
              </button>
            </div>
          ) : (
            sections.map((section) => {
              const look = CATEGORY_LOOK[section.key]
              return (
                <section key={section.key} className="v2-card" style={{ overflow: 'hidden' }}>
                  <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px' }}>
                    <IconTile icon={look.icon} tone={look.tone} size={30} />
                    <div style={{ minWidth: 0 }}>
                      <h2 style={{ fontSize: 14.5, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>{section.title}</h2>
                      <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 1 }}>{section.description}</div>
                    </div>
                  </header>
                  {section.items.map((item) => (
                    <FaqEntry key={item.id} item={item} open={isOpen(item.id)} onToggle={() => toggle(item.id)} words={words} />
                  ))}
                </section>
              )
            })
          )}

          <HelpFooter>
            Belum terjawab? Lihat <Link href="/accounting/dashboard" className="v2-link">Dashboard Akuntansi</Link> untuk tugas yang perlu dikerjakan, atau hubungi admin sistem.
          </HelpFooter>
        </div>
      </div>
    </div>
  )
}

function HelpFooter({ children }: { children: ReactNode }) {
  // A plain block: as a flex row, the text and the link would split into columns.
  const style: CSSProperties = {
    padding: '12px 16px',
    lineHeight: 1.5,
    borderRadius: 'var(--radius-lg)',
    border: '1px dashed var(--border-strong)',
    fontSize: 12.5,
    color: 'var(--foreground-muted)',
  }
  return <div style={style}>{children}</div>
}

// Question-bubble illustration in the dashboard's cocoa/caramel style.
function FaqArt() {
  return (
    <svg viewBox="0 0 220 150" width="190" height="130" aria-hidden="true" className="faq-art">
      <ellipse cx="110" cy="140" rx="80" ry="7" fill="var(--accent-light)" opacity="0.25" />
      <g className="faq-float">
        <rect x="28" y="30" width="118" height="78" rx="16" fill="var(--cocoa-700, #4A2E21)" />
        <path d="M58 108l-6 20 26-20z" fill="var(--cocoa-700, #4A2E21)" />
        <text x="87" y="88" textAnchor="middle" fontSize="54" fontWeight="700" fill="var(--caramel, #C68B4E)" fontFamily="Georgia, serif">?</text>
      </g>
      <g className="faq-float-2">
        <rect x="120" y="66" width="84" height="54" rx="14" fill="#F3E3D3" />
        <path d="M184 120l8 16-24-16z" fill="#F3E3D3" />
        <rect x="134" y="80" width="52" height="5" rx="2.5" fill="var(--accent-light)" />
        <rect x="134" y="92" width="38" height="5" rx="2.5" fill="var(--accent-light)" opacity="0.7" />
        <circle cx="190" cy="104" r="9" fill="var(--success, #2E7D5B)" />
        <path d="M186 104l3 3 5-6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g fill="var(--accent-light)">
        <path className="faq-twinkle" d="M16 70l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
        <path className="faq-twinkle" style={{ animationDelay: '0.8s' }} d="M176 26l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
      </g>
    </svg>
  )
}

const CSS = `
  .faq-hero { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 8px 8px 8px 2px; container-type: inline-size; }
  .faq-art { flex-shrink: 0; height: auto; margin: -8px 0; }
  @container (max-width: 560px) { .faq-art { display: none; } }
  .faq-search { position: relative; margin-top: 10px; max-width: 560px; }
  .faq-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--foreground-subtle); pointer-events: none; }
  .faq-search input {
    width: 100%; height: 44px; padding: 0 40px 0 40px; border-radius: 12px;
    border: 1px solid var(--border); background: var(--surface); color: var(--foreground);
    font: inherit; font-size: 14px; outline: none; box-shadow: var(--shadow-sm);
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }
  .faq-search input:focus { border-color: var(--accent-light); box-shadow: 0 0 0 3px var(--accent-light-bg); }
  .faq-search input::-webkit-search-cancel-button { display: none; }
  .faq-search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; border: none; border-radius: 8px; background: transparent; color: var(--foreground-muted); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
  .faq-search-clear:hover { background: var(--background); color: var(--foreground); }

  .faq-body { display: flex; gap: 16px; align-items: flex-start; }
  .faq-nav { flex: 0 0 250px; position: sticky; top: 16px; display: flex; flex-direction: column; gap: 2px; }
  .faq-cat {
    display: flex; align-items: center; gap: 10px; padding: 7px 8px; border: none; border-radius: var(--radius-md);
    background: transparent; color: var(--foreground); font: inherit; font-size: 13px; text-align: left; cursor: pointer;
    transition: background 150ms ease;
  }
  .faq-cat:hover:not(:disabled) { background: var(--surface); }
  .faq-cat[aria-pressed="true"] { background: var(--surface); box-shadow: inset 3px 0 0 var(--caramel, #C68B4E), var(--shadow-sm); font-weight: 500; }
  .faq-cat:disabled { opacity: 0.45; cursor: default; }
  .faq-cat-count { min-width: 22px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--background); border: 1px solid var(--border); font-size: 11px; color: var(--foreground-muted); display: inline-flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
  @media (max-width: 900px) {
    .faq-body { flex-direction: column; align-items: stretch; }
    .faq-nav { position: static; flex: none; flex-direction: row; overflow-x: auto; gap: 6px; padding-bottom: 4px; scrollbar-width: none; }
    .faq-cat { flex-shrink: 0; border: 1px solid var(--border); background: var(--surface); }
  }

  .faq-entry { border-top: 1px solid var(--border); scroll-margin-top: 80px; }
  .faq-q {
    display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 18px; border: none; background: transparent;
    font: inherit; font-size: 13.5px; font-weight: 500; color: var(--foreground); text-align: left; cursor: pointer; line-height: 1.45;
    transition: background 150ms ease;
  }
  .faq-q:hover { background: var(--background); }
  .faq-entry[data-open] .faq-q { color: var(--accent); }
  .faq-chevron { flex-shrink: 0; color: var(--foreground-muted); transition: transform 200ms ease; }
  .faq-entry[data-open] .faq-chevron { transform: rotate(180deg); color: var(--accent); }
  .faq-collapse { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 250ms ease; }
  .faq-entry[data-open] .faq-collapse { grid-template-rows: 1fr; }
  .faq-a { display: flex; flex-direction: column; gap: 10px; padding: 0 18px 16px; font-size: 13px; line-height: 1.6; color: var(--foreground-muted); }
  .faq-a p { margin: 0; }
  .faq-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .faq-steps li { display: flex; gap: 10px; align-items: flex-start; color: var(--foreground); }
  .faq-step-no { flex-shrink: 0; width: 22px; height: 22px; margin-top: 1px; border-radius: 999px; background: var(--accent-light-bg); color: var(--accent); font-size: 11.5px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; }
  .faq-link {
    display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: 999px;
    border: 1px solid var(--border); background: var(--surface); color: var(--foreground); font-size: 12px; font-weight: 500; text-decoration: none;
    transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
  }
  .faq-link:hover { background: var(--accent); border-color: var(--accent); color: #fff; }
  .faq-copy { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 8px; margin-left: auto; border: none; border-radius: 8px; background: transparent; color: var(--foreground-subtle); font: inherit; font-size: 12px; cursor: pointer; }
  .faq-copy:hover { background: var(--background); color: var(--foreground); }
  .faq-mark { background: color-mix(in srgb, var(--caramel, #C68B4E) 28%, transparent); color: inherit; border-radius: 3px; padding: 0 1px; }

  .faq-twinkle { transform-box: fill-box; }
  @media (prefers-reduced-motion: no-preference) {
    .faq-float { animation: faq-float 4.5s ease-in-out infinite; }
    .faq-float-2 { animation: faq-float 4.5s ease-in-out 0.8s infinite; }
    .faq-twinkle { transform-origin: center; animation: faq-twinkle 2.4s ease-in-out infinite; }
  }
  @keyframes faq-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
  @keyframes faq-twinkle { 0%, 100% { opacity: 0.35; transform: scale(0.75); } 50% { opacity: 1; transform: scale(1.1); } }
`
