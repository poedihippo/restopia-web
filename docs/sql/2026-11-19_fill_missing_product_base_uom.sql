-- =============================================================================
-- Fill missing products.base_uom_id (receipts fail: "… has no base_uom_id")
-- =============================================================================
-- Receiving stock converts every line to the product's base UOM, so a product
-- with base_uom_id = NULL cannot be received or produced.
-- On dcdev only product 758 "Special Collection Event 5" (imported 2026-11-10)
-- is affected; its only UOM is PCS.
--
-- Rule: only products with exactly ONE active product_uom get that UOM as base
-- (no guessing). Products with several UOMs are listed at the end — set those
-- by hand in Products.
-- Safe to re-run.
-- =============================================================================

BEGIN;

-- Preview: what will be set
SELECT p.id, p.name, MIN(pu.uom_id) AS new_base_uom_id, MIN(u.name) AS uom
FROM products p
JOIN product_uoms pu ON pu.product_id = p.id AND pu.deleted_at IS NULL
JOIN uoms u ON u.id = pu.uom_id
WHERE p.deleted_at IS NULL AND p.base_uom_id IS NULL
GROUP BY p.id, p.name
HAVING COUNT(DISTINCT pu.uom_id) = 1
ORDER BY p.id;

UPDATE products p
SET base_uom_id = s.uom_id,
    updated_at  = NOW()
FROM (
    SELECT pu.product_id, MIN(pu.uom_id) AS uom_id
    FROM product_uoms pu
    WHERE pu.deleted_at IS NULL
    GROUP BY pu.product_id
    HAVING COUNT(DISTINCT pu.uom_id) = 1
) s
WHERE s.product_id = p.id
  AND p.base_uom_id IS NULL
  AND p.deleted_at IS NULL;

-- Still missing (several UOMs or none) — fix manually
SELECT p.id, p.name,
       (SELECT string_agg(u.name, ', ') FROM product_uoms pu JOIN uoms u ON u.id = pu.uom_id
        WHERE pu.product_id = p.id AND pu.deleted_at IS NULL) AS uoms
FROM products p
WHERE p.deleted_at IS NULL AND p.base_uom_id IS NULL
ORDER BY p.id;

COMMIT;
