'use client'

import { useEffect, useSyncExternalStore } from 'react'
import {
  WEBUSB_SUPPORTED,
  closePrinter,
  getGrantedPrinter,
  openPrinter,
  requestPrinter,
  writeToPrinter,
  type USBDevice,
} from '@/lib/print/webusb'

type PrinterStatus =
  | 'unsupported'
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'printing'
  | 'error'

interface PrinterState {
  status: PrinterStatus
  device: USBDevice | null
  errorMessage: string | null
}

interface UsePrinterResult extends PrinterState {
  connect: () => Promise<void>
  autoConnect: () => Promise<void>
  print: (bytes: Uint8Array) => Promise<void>
  disconnect: () => Promise<void>
}

const UNSUPPORTED_MESSAGE = 'WebUSB not supported in this browser'

// Module-level store — usePrinter() is called in multiple places (POS view,
// PrinterStatusBar). Each call must read the same connection state, so we
// keep a single shared snapshot and notify subscribers on change.
let state: PrinterState = {
  status: WEBUSB_SUPPORTED ? 'disconnected' : 'unsupported',
  device: null,
  errorMessage: null,
}
let endpointOut: number | null = null
let autoConnectStarted = false
const listeners = new Set<() => void>()

function setState(partial: Partial<PrinterState>) {
  state = { ...state, ...partial }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot(): PrinterState {
  return state
}

function getServerSnapshot(): PrinterState {
  return {
    status: 'unsupported',
    device: null,
    errorMessage: null,
  }
}

function failWith(err: unknown, fallback: string) {
  const msg = err instanceof Error ? err.message : fallback
  setState({ status: 'error', errorMessage: msg })
}

async function connect(): Promise<void> {
  if (!WEBUSB_SUPPORTED) {
    setState({ errorMessage: UNSUPPORTED_MESSAGE })
    return
  }
  setState({ status: 'connecting', errorMessage: null })
  try {
    const requested = await requestPrinter()
    const opened = await openPrinter(requested)
    endpointOut = opened.endpointOut
    setState({ status: 'connected', device: opened.device, errorMessage: null })
  } catch (err) {
    failWith(err, 'Failed to connect printer')
  }
}

async function autoConnect(): Promise<void> {
  if (!WEBUSB_SUPPORTED) {
    setState({ errorMessage: UNSUPPORTED_MESSAGE })
    return
  }
  try {
    const granted = await getGrantedPrinter()
    if (!granted) return
    setState({ status: 'connecting', errorMessage: null })
    const opened = await openPrinter(granted)
    endpointOut = opened.endpointOut
    setState({ status: 'connected', device: opened.device, errorMessage: null })
  } catch (err) {
    failWith(err, 'Failed to auto-connect printer')
  }
}

async function print(bytes: Uint8Array): Promise<void> {
  if (!WEBUSB_SUPPORTED) {
    setState({ errorMessage: UNSUPPORTED_MESSAGE })
    throw new Error(UNSUPPORTED_MESSAGE)
  }
  if (!state.device || endpointOut === null) {
    const msg = 'Printer not connected'
    setState({ errorMessage: msg })
    throw new Error(msg)
  }
  setState({ status: 'printing', errorMessage: null })
  try {
    await writeToPrinter(state.device, endpointOut, bytes)
    setState({ status: 'connected' })
  } catch (err) {
    failWith(err, 'Print failed')
    throw err
  }
}

async function disconnect(): Promise<void> {
  if (!WEBUSB_SUPPORTED) return
  if (state.device) {
    try {
      await closePrinter(state.device)
    } catch (err) {
      failWith(err, 'Failed to close printer')
      return
    }
  }
  endpointOut = null
  setState({ status: 'disconnected', device: null, errorMessage: null })
}

export function usePrinter(): UsePrinterResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Trigger auto-connect once across the whole app, the first time any
  // component mounts the hook.
  useEffect(() => {
    if (autoConnectStarted) return
    autoConnectStarted = true
    void autoConnect()
  }, [])

  return {
    status: snapshot.status,
    device: snapshot.device,
    errorMessage: snapshot.errorMessage,
    connect,
    autoConnect,
    print,
    disconnect,
  }
}
