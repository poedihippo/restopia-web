-- =============================================================================
-- Company 2 (PT SCM): online sales channels → client COA
-- =============================================================================
-- Client decision (2026-11-18):
--   * Online orders (GoFood / Grab Food / Shopee Food) are owed on the outlet's
--     Piutang Dagang Customer XX (ar_trade_customer), not a per-channel account.
--   * Online revenue is Pendapatan Counter of the selling branch (sales_revenue);
--     a pickup point keeps its own Pendapatan Counter PP.
--
-- This script, in ONE transaction:
--   1. moves every journal line on the old accounts to the new ones
--        Piutang GoFood/Grab Food/Shopee Food XX → the journal branch's ar_trade_customer
--        Pendapatan Online XX                    → the journal branch's sales_revenue
--      (branch override → parent outlet → company default, same as the API)
--   2. points every online channel's receivable at the branch's ar_trade_customer
--   3. removes the sales_revenue_online overrides (online sales then use
--      sales_revenue — needs the API fallback in ResolveSalesRevenueCOA deployed)
--   4. deactivates the 16 old accounts
--   5. checks the result and aborts (rolls everything back) if anything is off
--
-- Only lines are re-pointed: amounts, dates and journals are unchanged, so every
-- journal stays balanced. Open online orders still clear at payout: the payout
-- finds the receivable through the order's own "Sales <code>" journal line,
-- which now carries the new account.
--
-- Run it once, as a whole (psql -f, or select-all + execute). Re-running is safe:
-- the second run finds nothing to move.
-- =============================================================================

BEGIN;

-- ── Old accounts (16) ───────────────────────────────────────────────────────
CREATE TEMP TABLE _old_acc ON COMMIT DROP AS
SELECT c.id,
       c.code,
       c.name,
       CASE WHEN c.name ILIKE 'Pendapatan Online%' THEN 'revenue' ELSE 'receivable' END AS kind
FROM chart_of_accounts c
WHERE c.company_id = 2
  AND c.deleted_at IS NULL
  AND (c.name ILIKE 'Piutang GoFood %'
    OR c.name ILIKE 'Piutang Grab Food %'
    OR c.name ILIKE 'Piutang Shopee Food %'
    OR c.name ILIKE 'Pendapatan Online %');

-- ── Target accounts per branch (own override → parent outlet → company) ─────
CREATE TEMP TABLE _branch_target ON COMMIT DROP AS
WITH keys AS (
    SELECT (SELECT id FROM account_setting_keys WHERE key = 'ar_trade_customer') AS ar_customer,
           (SELECT id FROM account_setting_keys WHERE key = 'sales_revenue')     AS revenue
)
SELECT b.id   AS branch_id,
       b.code AS branch_code,
       COALESCE(own_ar.chart_of_account_id, par_ar.chart_of_account_id, co_ar.chart_of_account_id) AS customer_coa,
       COALESCE(own_rv.chart_of_account_id, par_rv.chart_of_account_id, co_rv.chart_of_account_id) AS revenue_coa
FROM branches b
CROSS JOIN keys k
LEFT JOIN branch_account_settings own_ar ON own_ar.branch_id = b.id        AND own_ar.account_setting_key_id = k.ar_customer AND own_ar.deleted_at IS NULL
LEFT JOIN branch_account_settings par_ar ON par_ar.branch_id = b.parent_id AND par_ar.account_setting_key_id = k.ar_customer AND par_ar.deleted_at IS NULL
LEFT JOIN account_settings        co_ar  ON co_ar.company_id = b.company_id AND co_ar.account_setting_key_id = k.ar_customer AND co_ar.deleted_at IS NULL
LEFT JOIN branch_account_settings own_rv ON own_rv.branch_id = b.id        AND own_rv.account_setting_key_id = k.revenue     AND own_rv.deleted_at IS NULL
LEFT JOIN branch_account_settings par_rv ON par_rv.branch_id = b.parent_id AND par_rv.account_setting_key_id = k.revenue     AND par_rv.deleted_at IS NULL
LEFT JOIN account_settings        co_rv  ON co_rv.company_id = b.company_id AND co_rv.account_setting_key_id = k.revenue     AND co_rv.deleted_at IS NULL
WHERE b.company_id = 2
  AND b.deleted_at IS NULL;

-- ── Guards before touching anything ─────────────────────────────────────────
DO $$
DECLARE
    n_old     int;
    n_missing int;
BEGIN
    SELECT count(*) INTO n_old FROM _old_acc;
    IF n_old <> 16 THEN
        RAISE EXCEPTION 'expected 16 old accounts, found %', n_old;
    END IF;

    -- every branch that has a line (or a channel mapping) on an old account must
    -- resolve a target
    SELECT count(*) INTO n_missing
    FROM (
        SELECT DISTINCT j.branch_id, o.kind
        FROM journal_details jd
        JOIN journals j  ON j.id = jd.journal_id
        JOIN _old_acc o  ON o.id = jd.chart_of_account_id
        UNION
        SELECT DISTINCT a.branch_id, 'receivable'
        FROM sales_channel_branch_accounts a
        JOIN _old_acc o ON o.id = a.receivable_chart_of_account_id
        WHERE a.deleted_at IS NULL
    ) used
    LEFT JOIN _branch_target t ON t.branch_id = used.branch_id
    WHERE (used.kind = 'receivable' AND t.customer_coa IS NULL)
       OR (used.kind = 'revenue'    AND t.revenue_coa  IS NULL);
    IF n_missing > 0 THEN
        RAISE EXCEPTION '% branch(es) have no ar_trade_customer / sales_revenue mapping — map them first', n_missing;
    END IF;
END $$;

-- ── Preview (printed by psql) ───────────────────────────────────────────────
SELECT o.code AS old_code, o.name AS old_name, b.code AS journal_branch,
       nc.code AS new_code, nc.name AS new_name,
       count(*) AS lines, sum(jd.debit) AS debit, sum(jd.credit) AS credit
FROM journal_details jd
JOIN journals j        ON j.id = jd.journal_id
JOIN branches b        ON b.id = j.branch_id
JOIN _old_acc o        ON o.id = jd.chart_of_account_id
JOIN _branch_target t  ON t.branch_id = j.branch_id
JOIN chart_of_accounts nc ON nc.id = CASE o.kind WHEN 'receivable' THEN t.customer_coa ELSE t.revenue_coa END
GROUP BY 1, 2, 3, 4, 5
ORDER BY 1, 3;

-- ── 1. Journal lines ────────────────────────────────────────────────────────
UPDATE journal_details jd
SET chart_of_account_id = t.customer_coa
FROM journals j, _old_acc o, _branch_target t
WHERE jd.journal_id = j.id
  AND jd.chart_of_account_id = o.id AND o.kind = 'receivable'
  AND t.branch_id = j.branch_id;

UPDATE journal_details jd
SET chart_of_account_id = t.revenue_coa
FROM journals j, _old_acc o, _branch_target t
WHERE jd.journal_id = j.id
  AND jd.chart_of_account_id = o.id AND o.kind = 'revenue'
  AND t.branch_id = j.branch_id;

-- ── 2. Online channel receivables ───────────────────────────────────────────
-- Pickup-point rows have no receivable (they inherit the outlet's) and stay so.
UPDATE sales_channel_branch_accounts a
SET receivable_chart_of_account_id = t.customer_coa,
    updated_at = NOW()
FROM _old_acc o, _branch_target t
WHERE a.receivable_chart_of_account_id = o.id
  AND t.branch_id = a.branch_id
  AND a.deleted_at IS NULL;

-- ── 3. Online revenue → sales_revenue (Pendapatan Counter) ──────────────────
UPDATE branch_account_settings s
SET deleted_at = NOW()
FROM account_setting_keys k, branches b
WHERE k.id = s.account_setting_key_id AND k.key = 'sales_revenue_online'
  AND b.id = s.branch_id AND b.company_id = 2
  AND s.deleted_at IS NULL;

UPDATE account_settings s
SET deleted_at = NOW()
FROM account_setting_keys k
WHERE k.id = s.account_setting_key_id AND k.key = 'sales_revenue_online'
  AND s.company_id = 2
  AND s.deleted_at IS NULL;

-- ── 4. Deactivate the old accounts ──────────────────────────────────────────
UPDATE chart_of_accounts c
SET is_active = false,
    updated_at = NOW()
FROM _old_acc o
WHERE c.id = o.id;

-- ── 5. Checks — any failure rolls the whole script back ─────────────────────
DO $$
DECLARE
    n int;
BEGIN
    SELECT count(*) INTO n FROM journal_details jd JOIN _old_acc o ON o.id = jd.chart_of_account_id;
    IF n > 0 THEN RAISE EXCEPTION '% journal line(s) still on an old account', n; END IF;

    SELECT count(*) INTO n FROM sales_channel_branch_accounts a JOIN _old_acc o ON o.id = a.receivable_chart_of_account_id WHERE a.deleted_at IS NULL;
    IF n > 0 THEN RAISE EXCEPTION '% channel mapping(s) still on an old account', n; END IF;

    SELECT count(*) INTO n
    FROM (SELECT jd.journal_id
          FROM journal_details jd JOIN journals j ON j.id = jd.journal_id
          JOIN branches b ON b.id = j.branch_id AND b.company_id = 2
          WHERE j.deleted_at IS NULL
          GROUP BY jd.journal_id
          HAVING sum(jd.debit) <> sum(jd.credit)) unbalanced;
    IF n > 0 THEN RAISE EXCEPTION '% company-2 journal(s) unbalanced', n; END IF;
END $$;

-- ── Result (printed by psql) ────────────────────────────────────────────────
SELECT sc.name AS channel, b.code AS branch, r.code AS receivable, r.name AS receivable_name
FROM sales_channel_branch_accounts a
JOIN sales_channels sc ON sc.id = a.sales_channel_id
JOIN branches b        ON b.id = a.branch_id AND b.company_id = 2
LEFT JOIN chart_of_accounts r ON r.id = a.receivable_chart_of_account_id
WHERE a.deleted_at IS NULL AND r.id IS NOT NULL
ORDER BY b.id, sc.name;

COMMIT;
