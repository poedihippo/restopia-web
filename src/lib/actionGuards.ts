// Record-state rules mirrored from dapur-cokelat-api, so the UI disables an
// action (with the reason as tooltip) instead of letting the API reject it.
// Each function returns the reason the action is blocked, or null if allowed.
// Paths are relative to dapur-cokelat-api/internal/modules/.
//
// Permission checks do NOT belong here — those hide the button via
// useAuth().hasPermission. "Has X" guards the response can't express
// (e.g. supplier has purchase orders) are left to the API error toast.

import { referenceLabel } from '@/lib/references'

type Rec = Record<string, any> | null | undefined

const num = (v: unknown) => Number(v ?? 0)

// ── Sales orders ─────────────────────────────────────────────
// sales-orders/application/usecase/update_usecase.go:58-108
export function salesOrderEditBlock(so: Rec): string | null {
  if (!so) return null
  if (so.settlement_status === 'cancelled') return 'Returned order — cannot edit'
  if (num(so.returned_amount) > 0) return 'Has returned items — cannot edit'
  if (so.type === 'online' && so.settlement_status === 'settled')
    return 'Settled online order — move it back to pending first'
  return null
}

// sales-orders/application/usecase/delete_usecase.go:41-65
export function salesOrderDeleteBlock(so: Rec): string | null {
  if (!so) return null
  if (num(so.returned_amount) > 0) return 'Has returned items — cannot delete'
  if (num(so.total_payment) > 0) return 'Has payments — void them first'
  if (so.has_delivery) return 'Has deliveries — cannot delete'
  if (so.has_invoice) return 'Has an invoice — cannot delete'
  return null
}

// ── Purchase orders (incl. internal / inter-branch) ─────────
// purchase-orders/application/usecase/delete_usecase.go:43-63
export function purchaseOrderDeleteBlock(po: Rec): string | null {
  if (!po) return null
  if (po.status === 'delivered' || po.status === 'partially_delivered')
    return 'Has deliveries — cannot delete'
  if (num(po.total_payment) > 0 || (po.payment_status && po.payment_status !== 'pending'))
    return 'Has payments — void them first'
  return null
}

// purchase-orders/application/usecase/transition_usecase.go:59-70
export function purchaseOrderTransitionBlock(
  po: Rec,
  activeBranchId: number | null | undefined,
): string | null {
  if (!po) return null
  if (!po.supplier_branch_id) return 'Only internal-branch orders can be accepted or rejected'
  if (activeBranchId && Number(po.supplier_branch_id) !== Number(activeBranchId))
    return 'Switch to the supplying branch to accept or reject'
  return null
}

// ── Payments ─────────────────────────────────────────────────
// payments/application/usecase/void_usecase.go:55, refund_usecase.go:118-151
export function paymentVoidBlock(p: Rec): string | null {
  if (!p) return null
  if (p.is_reversed) return 'Already voided'
  if (p.type === 'refund') return 'A refund cannot be voided or deleted'
  if (p.settlement_status === 'settled') return 'Settled — undo the settlement first'
  return null
}

// payments/application/usecase/delete_usecase.go: same as void except a voided
// payment can still be deleted.
export function paymentDeleteBlock(p: Rec): string | null {
  if (!p) return null
  if (p.type === 'refund') return 'A refund cannot be voided or deleted'
  if (p.settlement_status === 'settled') return 'Settled — undo the settlement first'
  return null
}

// payments/application/usecase/allocate_usecase.go:56
export function paymentAllocateBlock(p: Rec): string | null {
  if (!p) return null
  if (p.is_reversed) return 'Voided payment — cannot allocate'
  return null
}

// ── Payment methods ──────────────────────────────────────────
// payment-methods/application/usecase/update_usecase.go:15-33
export const PAYMENT_METHOD_CREDIT_ID = 1

export function paymentMethodEditBlock(pm: Rec): string | null {
  if (!pm) return null
  if (Number(pm.id) === PAYMENT_METHOD_CREDIT_ID) return 'Credit is a system payment method'
  if (pm.company_id == null) return 'Global payment method — cannot edit'
  return null
}

// payment-methods/application/usecase/delete_usecase.go:15-34
export function paymentMethodDeleteBlock(pm: Rec): string | null {
  if (!pm) return null
  if (Number(pm.id) === PAYMENT_METHOD_CREDIT_ID) return 'Credit is a system payment method'
  if (pm.bank_account_id) return 'Managed by its bank account — delete the bank account instead'
  if (pm.company_id == null) return 'Global payment method — cannot delete'
  return null
}

// ── Sales channels ───────────────────────────────────────────
// sales-channels/application/usecase/sales_channel_usecase_impl.go:14-15
export const PROTECTED_SALES_CHANNEL_IDS = [1, 2] // Walk-in, GoFood

export function salesChannelProtectedBlock(sc: Rec): string | null {
  if (!sc) return null
  if (PROTECTED_SALES_CHANNEL_IDS.includes(Number(sc.id))) return 'Default sales channel — cannot change'
  return null
}

// ── Journals ─────────────────────────────────────────────────
// journals/application/usecase/manual_journal_rules.go (assertNotDocumentJournal):
// a journal posted by a document (reference_type set, not 'opening_balance')
// can only be changed from that document — edit/delete/reverse return 422.
function documentJournalBlock(j: Rec): string | null {
  const type = j?.reference_type
  if (!type || type === 'opening_balance') return null
  return `Posted by ${referenceLabel(type)} — change it from that document`
}

// journals/application/usecase/update_usecase.go
export function journalEditBlock(j: Rec): string | null {
  if (!j) return null
  if (j.is_posted) return 'Posted — reverse it instead'
  const doc = documentJournalBlock(j)
  if (doc) return doc
  if (j.period?.is_closed) return 'Period is closed'
  return null
}

// journals/application/usecase/delete_usecase.go
export function journalDeleteBlock(j: Rec): string | null {
  if (!j) return null
  if (j.is_posted) return 'Posted — reverse it instead'
  return documentJournalBlock(j)
}

// journals/application/usecase/reverse_usecase.go — a closed period no longer
// blocks: the reversal is dated in today's open period instead.
export function journalReverseBlock(j: Rec): string | null {
  if (!j) return null
  if (!j.is_posted) return 'Not posted yet'
  if (j.is_reversed) return 'Already reversed'
  return documentJournalBlock(j)
}

// ── Periods / fiscal years ───────────────────────────────────
// periods/application/usecase/update_usecase.go:68-93
export function periodEditBlock(p: Rec): string | null {
  if (!p) return null
  if (p.is_closed) return 'Period closed — reopen it first'
  return null
}

// fiscal-years/application/usecase/update_usecase.go:59-91
export function fiscalYearEditBlock(fy: Rec): string | null {
  if (!fy) return null
  if (fy.is_closed) return 'Fiscal year closed'
  return null
}

// ── Cash transactions ────────────────────────────────────────
// cash-transactions/application/usecase/delete_usecase.go
export function cashTransactionDeleteBlock(ct: Rec): string | null {
  if (!ct) return null
  if (ct.is_reversed) return 'Reversed — cannot delete'
  if (ct.journal?.period?.is_closed) return 'Period is closed'
  return null
}

// ── Account setting keys ─────────────────────────────────────
// infrastructure/common/enums/account_setting_key_enum.go (branchOverridableKeys)
export const BRANCH_OVERRIDABLE_KEYS = [
  'ar_trade',
  'ar_trade_customer',
  'ap_trade',
  'sales_revenue',
  'sales_revenue_online',
  'cogs',
  'sales_discount',
  'cash',
]

// branch-account-settings/application/usecase/internal/coa_validator.go (BranchFormatPremiereKeys)
export const PREMIERE_ONLY_KEYS = ['ar_trade', 'ar_trade_customer', 'ap_trade']

// infrastructure/common/enums/account_setting_key_enum.go (buyerOverridableKeys)
export const BUYER_OVERRIDABLE_KEYS = [
  'ap_trade',
  'purchase_expense',
  'purchase_discount',
  'vat_input',
  'supplier_advances',
]

// Inline style for a blocked button in views that don't use .v2-icon-btn.
export const blockedStyle = { opacity: 0.4, cursor: 'not-allowed' } as const

// ── Invoices ─────────────────────────────────────────────────
// invoices/application/usecase/delete_usecase.go:69-75 (validateInvoiceDeletable)
export function invoiceVoidBlock(inv: Rec): string | null {
  if (!inv) return null
  if (inv.status === 'void') return 'Already voided'
  if (num(inv.total_payment) > 0) return 'Has payments — void them first'
  return null
}

// ── Bank reconciliations ─────────────────────────────────────
// bank-reconciliations/application/usecase: statement upload, match, unmatch,
// book, auto-match and delete need a draft in an open period.
export function bankReconciliationEditBlock(rec: Rec): string | null {
  if (!rec) return null
  if (rec.status === 'completed') return 'Completed — reopen to change'
  if (rec.period?.is_closed) return 'Period closed'
  return null
}
