'use client'
// State of the product tour: which tour is running (in memory) and, per user,
// which tours were finished or skipped (localStorage, so a first-time user sees
// the welcome tour once). Storage failures just mean tours may show again.
import { useSyncExternalStore } from 'react'

const KEY = 'product-tour'
const SNOOZE_KEY = 'product-tour-snoozed'

interface Persisted {
  /** userId → tourId → version seen (finished or skipped). */
  seen: Record<string, Record<string, number>>
  /** userId → module tips prompt turned off. */
  tipsOff: Record<string, boolean>
}

function load(): Persisted {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '{}')
    return { seen: raw.seen ?? {}, tipsOff: raw.tipsOff ?? {} }
  } catch {
    return { seen: {}, tipsOff: {} }
  }
}

function save(p: Persisted) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* storage unavailable */
  }
}

export function hasSeenTour(userId: string, tourId: string, version: number): boolean {
  return (load().seen[userId]?.[tourId] ?? 0) >= version
}

export function markTourSeen(userId: string, tourId: string, version: number) {
  const p = load()
  p.seen[userId] = { ...(p.seen[userId] ?? {}), [tourId]: version }
  save(p)
  emit()
}

export function resetTours(userId: string) {
  const p = load()
  delete p.seen[userId]
  delete p.tipsOff[userId]
  save(p)
  try {
    window.sessionStorage.removeItem(SNOOZE_KEY)
  } catch {
    /* storage unavailable */
  }
  emit()
}

export function tipsEnabled(userId: string): boolean {
  return !load().tipsOff[userId]
}

export function setTipsEnabled(userId: string, enabled: boolean) {
  const p = load()
  p.tipsOff[userId] = !enabled
  save(p)
  emit()
}

/** "Nanti" on a module prompt: hidden for the rest of this browser session. */
export function snoozeTour(tourId: string) {
  try {
    const list: string[] = JSON.parse(window.sessionStorage.getItem(SNOOZE_KEY) ?? '[]')
    window.sessionStorage.setItem(SNOOZE_KEY, JSON.stringify(Array.from(new Set([...list, tourId]))))
  } catch {
    /* storage unavailable */
  }
  emit()
}

export function isSnoozed(tourId: string): boolean {
  try {
    return (JSON.parse(window.sessionStorage.getItem(SNOOZE_KEY) ?? '[]') as string[]).includes(tourId)
  } catch {
    return false
  }
}

// ── Running tour (in memory) ──
export interface ActiveTour {
  tourId: string
  step: number
}

let active: ActiveTour | null = null
let version = 0
const listeners = new Set<() => void>()

function emit() {
  version++
  listeners.forEach((l) => l())
}

export function startTour(tourId: string) {
  active = { tourId, step: 0 }
  emit()
}

export function setTourStep(step: number) {
  if (!active) return
  active = { ...active, step }
  emit()
}

export function stopTour() {
  active = null
  emit()
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useActiveTour(): ActiveTour | null {
  return useSyncExternalStore(subscribe, () => active, () => null)
}

/** Re-renders when persisted tour state changes (seen / tips / snooze). */
export function useTourVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0)
}
