-- =============================================================================
-- Company 2 (PT SCM): CASH settled later + "Refund Tunai" payment method
-- =============================================================================
-- Client decision (2026-11-19):
--   1. CASH works like BCA / VISA: a cash payment waits in Piutang Dagang Counter
--      and Accounting settles it to the bank (Settlement › Offline Orders).
--   2. Cash refunds can't use a settle-later method, so a separate method
--      "Refund Tunai" (NOT settle-later) pays them out of each outlet's Kas Kecil.
--      Its per-outlet accounts are copied from CASH's current branch accounts.
--      The POS hides any method named "Refund…" from sale payments — deploy the
--      web change (usePosLogic.ts) BEFORE running this.
--
-- One transaction; checks at the end roll everything back if anything is off.
-- Safe to re-run (Refund Tunai and its accounts are only added when missing).
-- Only company 2 is touched.
-- =============================================================================

BEGIN;

-- ── 1. CASH → settle later ──────────────────────────────────────────────────
UPDATE payment_methods
SET requires_settlement = true,
    updated_at = NOW()
WHERE company_id = 2
  AND name = 'CASH'
  AND deleted_at IS NULL;

-- ── 2. Refund Tunai (default account = CASH's company account) ─────────────
INSERT INTO payment_methods (name, type, chart_of_account_id, company_id, is_active, requires_settlement, created_at, updated_at)
SELECT 'Refund Tunai', 'sales_orders', cash.chart_of_account_id, 2, true, false, NOW(), NOW()
FROM payment_methods cash
WHERE cash.company_id = 2
  AND cash.name = 'CASH'
  AND cash.deleted_at IS NULL
  AND NOT EXISTS (
        SELECT 1 FROM payment_methods r
        WHERE r.company_id = 2 AND r.name = 'Refund Tunai' AND r.deleted_at IS NULL);

-- ── 3. Refund Tunai branch accounts = CASH branch accounts ──────────────────
INSERT INTO payment_method_branch_accounts (company_id, payment_method_id, branch_id, chart_of_account_id, created_at, updated_at)
SELECT a.company_id, r.id, a.branch_id, a.chart_of_account_id, NOW(), NOW()
FROM payment_method_branch_accounts a
JOIN payment_methods cash ON cash.id = a.payment_method_id
                         AND cash.company_id = 2 AND cash.name = 'CASH' AND cash.deleted_at IS NULL
JOIN payment_methods r    ON r.company_id = 2 AND r.name = 'Refund Tunai' AND r.deleted_at IS NULL
WHERE a.deleted_at IS NULL
  AND NOT EXISTS (
        SELECT 1 FROM payment_method_branch_accounts x
        WHERE x.company_id = a.company_id
          AND x.payment_method_id = r.id
          AND x.branch_id = a.branch_id
          AND x.deleted_at IS NULL);

-- ── 4. Checks — any failure rolls the whole script back ─────────────────────
DO $$
DECLARE
    n_cash_settle int;
    n_refund      int;
    n_cash_acc    int;
    n_refund_acc  int;
BEGIN
    SELECT count(*) INTO n_cash_settle FROM payment_methods
    WHERE company_id = 2 AND name = 'CASH' AND deleted_at IS NULL AND requires_settlement;
    IF n_cash_settle <> 1 THEN RAISE EXCEPTION 'expected 1 CASH method set to settle later, found %', n_cash_settle; END IF;

    SELECT count(*) INTO n_refund FROM payment_methods
    WHERE company_id = 2 AND name = 'Refund Tunai' AND deleted_at IS NULL AND NOT requires_settlement;
    IF n_refund <> 1 THEN RAISE EXCEPTION 'expected 1 Refund Tunai (not settle-later), found %', n_refund; END IF;

    SELECT count(*) INTO n_cash_acc FROM payment_method_branch_accounts a
    JOIN payment_methods m ON m.id = a.payment_method_id
    WHERE m.company_id = 2 AND m.name = 'CASH' AND m.deleted_at IS NULL AND a.deleted_at IS NULL;
    SELECT count(*) INTO n_refund_acc FROM payment_method_branch_accounts a
    JOIN payment_methods m ON m.id = a.payment_method_id
    WHERE m.company_id = 2 AND m.name = 'Refund Tunai' AND m.deleted_at IS NULL AND a.deleted_at IS NULL;
    IF n_refund_acc <> n_cash_acc THEN
        RAISE EXCEPTION 'Refund Tunai has % branch accounts, CASH has %', n_refund_acc, n_cash_acc;
    END IF;
    RAISE NOTICE 'OK: CASH settle-later; Refund Tunai with % branch accounts', n_refund_acc;
END $$;

-- ── Result (printed by psql) ────────────────────────────────────────────────
SELECT m.name AS method, m.requires_settlement, b.code AS branch, c.code AS account, c.name AS account_name
FROM payment_methods m
JOIN payment_method_branch_accounts a ON a.payment_method_id = m.id AND a.deleted_at IS NULL
JOIN branches b ON b.id = a.branch_id
JOIN chart_of_accounts c ON c.id = a.chart_of_account_id
WHERE m.company_id = 2 AND m.name IN ('CASH', 'Refund Tunai') AND m.deleted_at IS NULL
ORDER BY m.name, b.id;

COMMIT;
