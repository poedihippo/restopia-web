'use client'
// Pages this viewer opened recently, for "Terakhir dibuka" on the dashboards.
// Only sidebar menus are recorded (so every entry has a proper name), newest
// first, at most MAX. It lives in this browser's localStorage: a per-viewer
// convenience that is simply empty when storage is unavailable.
import { useSyncExternalStore } from 'react'
import { NAV_GROUPS } from '@/components/app-sidebar'

export interface RecentPage {
  href: string
  label: string
  /** Sidebar parent (e.g. "Financial Reports") or group title. */
  section: string
  /** Sidebar group (e.g. "ACCOUNTING"), for filtering. */
  group: string
  at: number
}

const KEY = 'recent-pages'
const EVENT = 'recent-pages-change'
const MAX = 10

type NavEntry = Omit<RecentPage, 'at'>

let navIndex: Map<string, NavEntry> | null = null
function nav(): Map<string, NavEntry> {
  if (navIndex) return navIndex
  navIndex = new Map()
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const groupName = group.title.charAt(0) + group.title.slice(1).toLowerCase()
      if (item.href) navIndex.set(item.href, { href: item.href, label: item.label, section: groupName, group: group.title })
      for (const child of item.children ?? []) {
        navIndex.set(child.href, { href: child.href, label: child.label, section: item.label, group: group.title })
      }
    }
  }
  return navIndex
}

function read(): RecentPage[] {
  if (typeof window === 'undefined') return []
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((p) => p && typeof p.href === 'string') : []
  } catch {
    return []
  }
}

/** Records a visit to `path` when it is a sidebar menu (query string ignored). */
export function recordRecentPage(path: string) {
  const href = path.split('?')[0].split('#')[0]
  const entry = nav().get(href)
  if (!entry) return
  const next = [{ ...entry, at: Date.now() }, ...read().filter((p) => p.href !== href)].slice(0, MAX)
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    return
  }
  cache = null
  window.dispatchEvent(new Event(EVENT))
}

export function clearRecentPages() {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
  cache = null
  window.dispatchEvent(new Event(EVENT))
}

// useSyncExternalStore needs a stable snapshot between changes.
let cache: { raw: string | null; list: RecentPage[] } | null = null
function snapshot(): RecentPage[] {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {
    raw = null
  }
  if (cache && cache.raw === raw) return cache.list
  cache = { raw, list: read() }
  return cache.list
}

const EMPTY: RecentPage[] = []

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange()
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

/** Recently opened menus, newest first; updates live (also across tabs). */
export function useRecentPages(): RecentPage[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY)
}
