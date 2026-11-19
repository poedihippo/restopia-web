-- =============================================================================
-- Company 2: Credit-tender journals posted to company 1's Piutang Karyawan
-- =============================================================================
-- Before the Credit method had company-2 branch accounts, 13 Credit-tender
-- payments (27 Oct 2026, legacy online orders) posted
--     D 13-51-000 Piutang Karyawan (company 1!) / K Piutang Dagang Customer XX
--
-- Current rules:
--   * credit_type = customer: the Credit tender books NO journal — the amount
--     stays in Piutang Dagang Customer. → re-point the debit to the branch's
--     Piutang Dagang Customer (the journal nets to zero, as if never posted).
--   * credit_type = user (employee credit): the debt moves to Piutang Dagang
--     Counter and waits for the Kredit Karyawan settlement. → re-point the debit
--     to the branch's Piutang Dagang Counter (ar_trade) and mark the payment
--     pending so it shows on Accounting › Settlements › Kredit Karyawan.
--
-- Only accounts on lines change (amounts untouched). One transaction, checks at
-- the end roll everything back if anything is off. Safe to re-run.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _leak ON COMMIT DROP AS
SELECT jd.id AS detail_id,
       j.id  AS journal_id,
       j.branch_id,
       p.id  AS payment_id,
       so.credit_type
FROM journal_details jd
JOIN journals j            ON j.id = jd.journal_id AND j.deleted_at IS NULL
JOIN branches b            ON b.id = j.branch_id AND b.company_id = 2
JOIN chart_of_accounts c   ON c.id = jd.chart_of_account_id AND c.company_id IS DISTINCT FROM 2
JOIN payments p            ON p.journal_id = j.id AND p.payment_method_id = 1
JOIN payment_allocations pa ON pa.payment_id = p.id AND pa.deleted_at IS NULL
JOIN sales_orders so       ON so.id = pa.sales_order_id;

-- Target per branch (own override → parent outlet → company default).
CREATE TEMP TABLE _target ON COMMIT DROP AS
WITH keys AS (
    SELECT (SELECT id FROM account_setting_keys WHERE key = 'ar_trade')          AS counter,
           (SELECT id FROM account_setting_keys WHERE key = 'ar_trade_customer') AS customer
)
SELECT b.id AS branch_id,
       COALESCE(oc.chart_of_account_id, pc.chart_of_account_id, cc.chart_of_account_id) AS counter_coa,
       COALESCE(ou.chart_of_account_id, pu.chart_of_account_id, cu.chart_of_account_id) AS customer_coa
FROM branches b CROSS JOIN keys k
LEFT JOIN branch_account_settings oc ON oc.branch_id = b.id        AND oc.account_setting_key_id = k.counter  AND oc.deleted_at IS NULL
LEFT JOIN branch_account_settings pc ON pc.branch_id = b.parent_id AND pc.account_setting_key_id = k.counter  AND pc.deleted_at IS NULL
LEFT JOIN account_settings        cc ON cc.company_id = b.company_id AND cc.account_setting_key_id = k.counter  AND cc.deleted_at IS NULL
LEFT JOIN branch_account_settings ou ON ou.branch_id = b.id        AND ou.account_setting_key_id = k.customer AND ou.deleted_at IS NULL
LEFT JOIN branch_account_settings pu ON pu.branch_id = b.parent_id AND pu.account_setting_key_id = k.customer AND pu.deleted_at IS NULL
LEFT JOIN account_settings        cu ON cu.company_id = b.company_id AND cu.account_setting_key_id = k.customer AND cu.deleted_at IS NULL
WHERE b.company_id = 2;

DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n FROM _leak;
    RAISE NOTICE '% leaked line(s) found', n;
    SELECT count(*) INTO n FROM _leak l JOIN _target t ON t.branch_id = l.branch_id
    WHERE (l.credit_type = 'user' AND t.counter_coa IS NULL) OR (l.credit_type IS DISTINCT FROM 'user' AND t.customer_coa IS NULL);
    IF n > 0 THEN RAISE EXCEPTION '% line(s) have no target account mapped', n; END IF;
END $$;

-- Preview
SELECT l.journal_id, l.payment_id, l.credit_type, nc.code AS new_code, nc.name AS new_name
FROM _leak l
JOIN _target t ON t.branch_id = l.branch_id
JOIN chart_of_accounts nc ON nc.id = CASE WHEN l.credit_type = 'user' THEN t.counter_coa ELSE t.customer_coa END
ORDER BY l.journal_id;

UPDATE journal_details jd
SET chart_of_account_id = CASE WHEN l.credit_type = 'user' THEN t.counter_coa ELSE t.customer_coa END
FROM _leak l, _target t
WHERE jd.id = l.detail_id AND t.branch_id = l.branch_id;

-- Employee credit now waits for the Kredit Karyawan settlement.
UPDATE payments p
SET settlement_status = 'pending', updated_at = NOW()
FROM _leak l
WHERE p.id = l.payment_id AND l.credit_type = 'user' AND p.settlement_status IS NULL;

DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n
    FROM journal_details jd JOIN journals j ON j.id = jd.journal_id AND j.deleted_at IS NULL
    JOIN branches b ON b.id = j.branch_id AND b.company_id = 2
    JOIN chart_of_accounts c ON c.id = jd.chart_of_account_id AND c.company_id IS DISTINCT FROM 2;
    IF n > 0 THEN RAISE EXCEPTION '% company-2 line(s) still on another company''s account', n; END IF;

    SELECT count(*) INTO n FROM (
        SELECT jd.journal_id FROM journal_details jd JOIN journals j ON j.id = jd.journal_id
        JOIN branches b ON b.id = j.branch_id AND b.company_id = 2
        WHERE j.deleted_at IS NULL GROUP BY jd.journal_id HAVING sum(jd.debit) <> sum(jd.credit)) x;
    IF n > 0 THEN RAISE EXCEPTION '% company-2 journal(s) unbalanced', n; END IF;
END $$;

COMMIT;
