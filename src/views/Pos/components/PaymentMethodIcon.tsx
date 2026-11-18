'use client'

import { Banknote, CreditCard, Landmark, QrCode, Wallet } from 'lucide-react'

/**
 * Icon / wordmark for a POS payment method, picked from its name:
 * cash → banknote, BCA / VISA / Mastercard → their wordmark, QRIS → QR,
 * transfer → bank, card / EDC / debit → card, anything else → wallet.
 * Wordmarks are simple text marks in the brand colour (no image assets).
 */
export default function PaymentMethodIcon({ name, size = 26 }: { name?: string; size?: number }) {
  const n = (name ?? '').toLowerCase()

  const wordmark = (text: string, color: string, italic = true, letterSpacing = 0.5) => (
    <svg width={size * 2.2} height={size} viewBox="0 0 66 26" role="img" aria-label={text}>
      <text
        x="33"
        y="19"
        textAnchor="middle"
        fontFamily="Arial Black, Arial, Helvetica, sans-serif"
        fontWeight={900}
        fontStyle={italic ? 'italic' : 'normal'}
        fontSize="19"
        letterSpacing={letterSpacing}
        fill={color}
      >
        {text}
      </text>
    </svg>
  )

  if (n.includes('visa')) return wordmark('VISA', '#1A1F71', true, 1)
  if (n.includes('bca')) return wordmark('BCA', '#0060AF', true, 0.5)
  if (n.includes('master')) {
    return (
      <svg width={size * 1.5} height={size} viewBox="0 0 39 26" role="img" aria-label="Mastercard">
        <circle cx="15" cy="13" r="10" fill="#EB001B" />
        <circle cx="24" cy="13" r="10" fill="#F79E1B" fillOpacity="0.9" />
      </svg>
    )
  }

  const props = { size, strokeWidth: 1.8 }
  if (n.includes('cash') || n.includes('tunai')) return <Banknote {...props} color="var(--success)" />
  if (n.includes('qris') || n.includes('qr')) return <QrCode {...props} color="var(--foreground)" />
  if (n.includes('transfer') || n.includes('bank')) return <Landmark {...props} color="var(--info)" />
  if (n.includes('card') || n.includes('edc') || n.includes('debit') || n.includes('kartu')) {
    return <CreditCard {...props} color="var(--info)" />
  }
  return <Wallet {...props} color="var(--foreground-muted)" />
}
