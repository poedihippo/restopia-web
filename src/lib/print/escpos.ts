// Pure ESC/POS byte builders. No deps, no classes.
// Each helper returns a Uint8Array; concat() joins them in order.

const ESC = 0x1b
const GS = 0x1d

export function init(): Uint8Array {
  return new Uint8Array([ESC, 0x40])
}

// Encode a string as single-byte CP437/Latin-ish output. TextEncoder only
// supports utf-8, so we write a tiny encoder: ASCII passes through, anything
// else collapses to '?' which is safe for receipts.
export function text(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i)
    out[i] = code < 0x80 ? code : 0x3f
  }
  return out
}

export function lineFeed(n = 1): Uint8Array {
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) out[i] = 0x0a
  return out
}

export function align(mode: 'left' | 'center' | 'right'): Uint8Array {
  const n = mode === 'left' ? 0 : mode === 'center' ? 1 : 2
  return new Uint8Array([ESC, 0x61, n])
}

export function bold(on: boolean): Uint8Array {
  return new Uint8Array([ESC, 0x45, on ? 1 : 0])
}

export function underline(on: boolean): Uint8Array {
  return new Uint8Array([ESC, 0x2d, on ? 1 : 0])
}

export function size(width = 1, height = 1): Uint8Array {
  const w = Math.max(1, Math.min(8, width)) - 1
  const h = Math.max(1, Math.min(8, height)) - 1
  return new Uint8Array([GS, 0x21, (w << 4) | h])
}

// GS V 0 — full cut. Harmless on TM-U220 (no auto-cutter); the printer
// ignores the command rather than mis-printing.
export function cut(): Uint8Array {
  return new Uint8Array([GS, 0x56, 0x00])
}

export function feed(lines = 4): Uint8Array {
  return new Uint8Array([ESC, 0x64, lines])
}

export function concat(...chunks: Uint8Array[]): Uint8Array {
  let total = 0
  for (const c of chunks) total += c.length
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}
