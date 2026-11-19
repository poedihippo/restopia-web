-- =============================================================================
-- Company 2: sales_revenue_online set per branch = that branch's Pendapatan Counter
-- =============================================================================
-- Online revenue stays a per-branch setting (editable later in
-- Accounting › Account Settings › Per-Branch), with today's value = the branch's
-- own sales_revenue (Pendapatan Counter XX / Pendapatan Counter PP …).
--
-- Every branch gets its own row, pickup points included: the API reads
-- sales_revenue_online through the branch → parent chain BEFORE falling back to
-- sales_revenue, so a pickup point without its own row would take the outlet's
-- account instead of its own Pendapatan Counter PP.
--
-- Inserts only where a branch has no live sales_revenue_online row. Safe to re-run.
-- =============================================================================

BEGIN;

INSERT INTO branch_account_settings (company_id, branch_id, account_setting_key_id, chart_of_account_id, description, created_at, updated_at)
SELECT b.company_id,
       b.id,
       k_online.id,
       rev.chart_of_account_id,
       'Online revenue = Pendapatan Counter (client decision 2026-11-18)',
       NOW(),
       NOW()
FROM branches b
JOIN account_setting_keys k_online ON k_online.key = 'sales_revenue_online'
JOIN account_setting_keys k_rev    ON k_rev.key    = 'sales_revenue'
JOIN branch_account_settings rev   ON rev.branch_id = b.id
                                  AND rev.account_setting_key_id = k_rev.id
                                  AND rev.deleted_at IS NULL
WHERE b.company_id = 2
  AND b.deleted_at IS NULL
  AND NOT EXISTS (
        SELECT 1 FROM branch_account_settings s
        WHERE s.branch_id = b.id
          AND s.account_setting_key_id = k_online.id
          AND s.deleted_at IS NULL);

-- Every company-2 branch must now have sales_revenue_online = its own sales_revenue.
DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n
    FROM branches b
    JOIN account_setting_keys k_online ON k_online.key = 'sales_revenue_online'
    JOIN account_setting_keys k_rev    ON k_rev.key    = 'sales_revenue'
    LEFT JOIN branch_account_settings onl ON onl.branch_id = b.id AND onl.account_setting_key_id = k_online.id AND onl.deleted_at IS NULL
    LEFT JOIN branch_account_settings rev ON rev.branch_id = b.id AND rev.account_setting_key_id = k_rev.id    AND rev.deleted_at IS NULL
    WHERE b.company_id = 2 AND b.deleted_at IS NULL
      AND (onl.chart_of_account_id IS NULL OR onl.chart_of_account_id IS DISTINCT FROM rev.chart_of_account_id);
    IF n > 0 THEN RAISE EXCEPTION '% branch(es) without sales_revenue_online = sales_revenue', n; END IF;
END $$;

-- Result
SELECT b.code AS branch, c.code, c.name
FROM branch_account_settings s
JOIN account_setting_keys k ON k.id = s.account_setting_key_id AND k.key = 'sales_revenue_online'
JOIN branches b ON b.id = s.branch_id AND b.company_id = 2
JOIN chart_of_accounts c ON c.id = s.chart_of_account_id
WHERE s.deleted_at IS NULL
ORDER BY b.id;

COMMIT;
