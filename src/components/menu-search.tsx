'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { useActiveBranchProductTypes } from '@/hooks/useProductTypes';
import { NAV_GROUPS, type NavChild, type NavItem } from '@/components/app-sidebar';
import { Search, CornerDownLeft, ArrowUp, ArrowDown, Clock, SearchX } from 'lucide-react';

type Entry = {
  key: string;
  label: string;
  href: string;
  group: string;
  // Parent menu for submenus ("Stock" for "Raw Materials").
  parent?: string;
  icon: React.ElementType;
  haystack: string;
};

const RECENT_KEY = 'menu-search-recent';
const RECENT_MAX = 5;

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((h) => typeof h === 'string') : [];
  } catch {
    return [];
  }
}

function pushRecent(href: string) {
  try {
    const next = [href, ...readRecent().filter((h) => h !== href)].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked — recents are a convenience only.
  }
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

// Same visibility rules as the sidebar: permission (ANY-of), hidden flag and
// the active branch's product types for stock submenus.
function useVisibleEntries(): Entry[] {
  const { hasPermission, isSuperadmin } = useAuth();
  const activeProductTypes = useActiveBranchProductTypes();

  return useMemo(() => {
    const allowedTypes = activeProductTypes
      ? activeProductTypes.split(',').map((s) => s.trim().toLowerCase())
      : null;
    const allowed = (perm?: string | string[]) => {
      if (isSuperadmin || !perm) return true;
      return Array.isArray(perm) ? perm.some((p) => hasPermission(p)) : hasPermission(perm);
    };
    const typeAllowed = (href: string) => {
      if (!allowedTypes) return true;
      if (!href.includes('/products/product-inventory?type=') && !href.includes('stock-movements?product_types=')) return true;
      const t = /[?&](?:type|product_types)=([^&]+)/.exec(href)?.[1]?.toLowerCase();
      return !t || allowedTypes.includes(t) || (t === 'supply' && allowedTypes.includes('supplies'));
    };

    const out: Entry[] = [];
    const groupLabel = (title: string) => title.charAt(0) + title.slice(1).toLowerCase();
    for (const group of NAV_GROUPS) {
      const g = groupLabel(group.title);
      for (const item of group.items as NavItem[]) {
        if (item.hidden || !allowed(item.permission)) continue;
        if (item.children) {
          for (const child of item.children as NavChild[]) {
            if (child.hidden || !allowed(child.permission) || !typeAllowed(child.href)) continue;
            const label = child.channel ? `${child.label} (${child.channel})` : child.label;
            out.push({
              key: `${item.label}/${child.href}`,
              label,
              href: child.href,
              group: g,
              parent: item.label,
              icon: item.icon,
              haystack: `${label} ${item.label} ${g}`.toLowerCase(),
            });
          }
        } else if (item.href) {
          out.push({
            key: item.href,
            label: item.label,
            href: item.href,
            group: g,
            icon: item.icon,
            haystack: `${item.label} ${g}`.toLowerCase(),
          });
        }
      }
    }
    return out;
  }, [hasPermission, isSuperadmin, activeProductTypes]);
}

// Every word must appear somewhere; label hits rank above group/parent hits.
function score(entry: Entry, words: string[]): number {
  const label = entry.label.toLowerCase();
  let s = 0;
  for (const w of words) {
    if (!entry.haystack.includes(w)) return -1;
    if (label.startsWith(w)) s += 3;
    else if (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(label)) s += 2;
    else if (label.includes(w)) s += 1;
  }
  return s;
}

function Highlight({ text, words }: { text: string; words: string[] }) {
  if (words.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return (
    <>
      {text.split(pattern).map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} style={{ background: 'var(--accent-light-bg)', color: 'var(--accent)', borderRadius: 3, padding: '0 1px' }}>
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 18,
  height: 18,
  padding: '0 5px',
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'var(--background)',
  color: 'var(--foreground-muted)',
  fontSize: 10,
  fontWeight: 600,
  fontFamily: 'var(--font-sans)',
  lineHeight: 1,
};

export default function MenuSearch() {
  const router = useRouter();
  const entries = useVisibleEntries();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [modKey, setModKey] = useState('Ctrl');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isMac()) setModKey('⌘');
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    setRecent(readRecent());
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const words = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query]);

  // Flat result list (keyboard order) plus the section it is shown under.
  const results = useMemo(() => {
    if (words.length > 0) {
      return entries
        .map((e) => ({ e, s: score(e, words) }))
        .filter((r) => r.s >= 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 40)
        .map((r) => ({ entry: r.e, section: 'Results' }));
    }
    const byHref = new Map(entries.map((e) => [e.href, e]));
    const recents = recent.map((h) => byHref.get(h)).filter(Boolean) as Entry[];
    const recentSet = new Set(recents.map((e) => e.key));
    return [
      ...recents.map((entry) => ({ entry, section: 'Recent' })),
      ...entries.filter((e) => !recentSet.has(e.key)).map((entry) => ({ entry, section: entry.group })),
    ];
  }, [entries, words, recent]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (entry: Entry) => {
    pushRecent(entry.href);
    setOpen(false);
    router.push(entry.href);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[active];
      if (r) go(r.entry);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="menu-search-trigger"
        data-tour="menu-search"
        onClick={() => setOpen(true)}
        aria-label="Search menu"
        title={`Search menu (${modKey}+K)`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 34,
          width: 260,
          flexShrink: 0,
          padding: '0 8px 0 10px',
          background: 'var(--background)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          color: 'var(--foreground-subtle)',
          fontSize: 13,
          textAlign: 'left',
        }}
      >
        <Search size={14} style={{ flexShrink: 0, color: 'var(--foreground-muted)' }} />
        <span className="menu-search-trigger-text" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Search menu…
        </span>
        <span className="menu-search-trigger-kbd" style={{ display: 'flex', gap: 3 }}>
          <kbd style={kbdStyle}>{modKey}</kbd>
          <kbd style={kbdStyle}>K</kbd>
        </span>
      </button>

      {open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search menu"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1300,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '12vh 16px 16px',
          }}
        >
          <div
            onClick={() => setOpen(false)}
            className="menu-search-backdrop"
            style={{ position: 'absolute', inset: 0, background: 'rgba(20, 12, 8, 0.32)', backdropFilter: 'blur(2px)' }}
          />
          <div
            className="menu-search-panel"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 580,
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            {/* Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 16px',
                height: 54,
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              <Search size={18} style={{ color: 'var(--foreground-muted)', flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Search menus and submenus…"
                aria-label="Search menus"
                role="combobox"
                aria-expanded="true"
                aria-controls="menu-search-list"
                aria-activedescendant={results[active] ? `menu-search-opt-${active}` : undefined}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 15,
                  color: 'var(--foreground)',
                  fontFamily: 'var(--font-sans)',
                }}
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ ...kbdStyle, cursor: 'pointer', height: 22, padding: '0 7px' }}
              >
                Esc
              </button>
            </div>

            {/* Results */}
            <div id="menu-search-list" role="listbox" ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
              {results.length === 0 ? (
                <div
                  style={{
                    padding: '36px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    color: 'var(--foreground-muted)',
                    fontSize: 13,
                  }}
                >
                  <SearchX size={26} style={{ color: 'var(--foreground-subtle)' }} />
                  No menu matches “{query.trim()}”
                </div>
              ) : (
                results.map(({ entry, section }, i) => {
                  const Icon = section === 'Recent' ? Clock : entry.icon;
                  const isActive = i === active;
                  const showHeader = i === 0 || results[i - 1].section !== section;
                  return (
                    <React.Fragment key={`${section}-${entry.key}`}>
                      {showHeader && (
                        <div
                          style={{
                            padding: i === 0 ? '6px 10px 4px' : '12px 10px 4px',
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: 1.2,
                            textTransform: 'uppercase',
                            color: 'var(--foreground-subtle)',
                          }}
                        >
                          {section}
                        </div>
                      )}
                      <div
                        id={`menu-search-opt-${i}`}
                        role="option"
                        aria-selected={isActive}
                        data-index={i}
                        onMouseMove={() => !isActive && setActive(i)}
                        onClick={() => go(entry)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          background: isActive ? 'var(--accent-light-bg)' : 'transparent',
                        }}
                      >
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            background: isActive ? 'var(--surface)' : 'var(--background)',
                            border: '1px solid var(--border)',
                            color: isActive ? 'var(--accent)' : 'var(--foreground-muted)',
                          }}
                        >
                          <Icon size={14} />
                        </span>
                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: 'var(--foreground)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            <Highlight text={entry.label} words={words} />
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--foreground-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {entry.group}
                            {entry.parent ? ` › ${entry.parent}` : ''}
                          </span>
                        </span>
                        {isActive && <CornerDownLeft size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                      </div>
                    </React.Fragment>
                  );
                })
              )}
            </div>

            {/* Footer hints */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '8px 14px',
                borderTop: '1px solid var(--border)',
                fontSize: 11,
                color: 'var(--foreground-muted)',
                flexShrink: 0,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <kbd style={kbdStyle}><ArrowUp size={10} /></kbd>
                <kbd style={kbdStyle}><ArrowDown size={10} /></kbd>
                navigate
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <kbd style={kbdStyle}><CornerDownLeft size={10} /></kbd>
                open
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <kbd style={kbdStyle}>Esc</kbd>
                close
              </span>
              <span style={{ marginLeft: 'auto' }}>{entries.length} menus</span>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <style>{`
        .menu-search-trigger { transition: border-color 150ms ease, background 150ms ease; }
        .menu-search-trigger:hover { border-color: var(--border-strong); background: var(--surface); }
        @media (max-width: 1100px) {
          .menu-search-trigger { width: 150px !important; }
          .menu-search-trigger-kbd { display: none !important; }
        }
        @media (max-width: 767px) {
          .menu-search-trigger { width: 34px !important; padding: 0 !important; justify-content: center; }
          .menu-search-trigger-text, .menu-search-trigger-kbd { display: none !important; }
        }
        @media (prefers-reduced-motion: no-preference) {
          .menu-search-panel { animation: menu-search-in 140ms ease-out; }
          .menu-search-backdrop { animation: menu-search-fade 140ms ease-out; }
        }
        @keyframes menu-search-in { from { opacity: 0; transform: translateY(-6px) scale(0.985); } to { opacity: 1; transform: none; } }
        @keyframes menu-search-fade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>
  );
}
