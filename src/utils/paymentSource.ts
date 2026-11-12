// Where a payment's money went: its payment method, or — for a payment received
// straight into a bank account (a marketplace payout, an inter-branch invoice) or
// paid to a supplier from one — that bank account.

export function bankAccountLabel(b: any): string {
  return b ? [b.bank_name, b.account_number].filter(Boolean).join(' ') : ''
}

export function paymentSourceLabel(p: any, fallback = '—'): string {
  return p?.payment_method?.name || bankAccountLabel(p?.bank_account) || fallback
}
