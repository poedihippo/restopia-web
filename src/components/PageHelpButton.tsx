'use client'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { CircleHelp, X } from 'lucide-react'
import { getPageHelp } from '@/lib/pageHelp'

/**
 * "?" button next to the page name in the top bar. Shows what the current page
 * is and when it is used (content in src/lib/pageHelp.ts, keyed by route).
 * Renders nothing on pages without help content.
 */
export default function PageHelpButton() {
  const router = useRouter()
  const help = getPageHelp(router.pathname)
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [router.pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!help) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`About ${help.title}`}
        aria-label={`About ${help.title}`}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, padding: 0, marginLeft: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '50%', color: 'var(--foreground-muted)', cursor: 'pointer', flexShrink: 0 }}
      >
        <CircleHelp size={13} />
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} onClick={() => setOpen(false)} />
          <div role="dialog" aria-modal="true" style={{ position: 'relative', width: '100%', maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CircleHelp size={16} style={{ color: 'var(--accent-light)' }} />
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>About {help.title}</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} title="Close" style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={sectionTitle}>What is it</span>
                <div style={{ padding: '14px 16px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, lineHeight: 1.6, color: 'var(--foreground)' }}>
                  {help.summary}
                </div>
              </div>

              {help.items.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={sectionTitle}>{help.itemsTitle ?? "When it's used"}</span>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {help.items.map((item) => (
                      <li key={item.label} style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{item.label}</div>
                        <div style={{ marginTop: 2, fontSize: 13, lineHeight: 1.5, color: 'var(--foreground-muted)' }}>{item.body}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {help.note && (
                <div style={{ padding: '10px 14px', background: 'var(--warning-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 12, lineHeight: 1.5, color: 'var(--foreground)' }}>
                  <strong>Note:</strong> {help.note}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--foreground-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }
