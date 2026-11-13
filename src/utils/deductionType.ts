/**
 * Recipe materials carry a `deduction_type` that says WHEN that ingredient's
 * stock is taken out of inventory:
 *
 *  - deduct_on_production  → as soon as the finished good is produced
 *  - deduct_on_sold        → only once the finished good is sold
 *
 * (`deduct_on_sellable_settlement` is gone — there is no settlement step in
 * the simplified stock model.)
 *
 * The labels are shared by the recipe form and the recipe detail list so the
 * wording never drifts between the two. `tone` drives the badge/legend colours.
 */
export const DEDUCTION_TYPE_OPTIONS = [
  {
    value: 'deduct_on_production',
    label: 'Produksi',
    hint: 'Terpotong saat produk dibuat',
    tone: 'info',
  },
  {
    value: 'deduct_on_sold',
    label: 'Terjual',
    hint: 'Terpotong saat produk terjual',
    tone: 'warning',
  },
] as const

/** Colour token name (info / warning) for a deduction type. */
export const deductionTypeTone = (value?: string | null): string =>
  DEDUCTION_TYPE_OPTIONS.find((o) => o.value === value)?.tone ??
  DEDUCTION_TYPE_OPTIONS[0].tone

export type DeductionTypeValue = (typeof DEDUCTION_TYPE_OPTIONS)[number]['value']

/** Short label, e.g. "Produksi". Defaults to the first option. */
export const deductionTypeLabel = (value?: string | null): string =>
  DEDUCTION_TYPE_OPTIONS.find((o) => o.value === value)?.label ??
  DEDUCTION_TYPE_OPTIONS[0].label

/** One-line explanation, e.g. "Terpotong saat produk dibuat". */
export const deductionTypeHint = (value?: string | null): string =>
  DEDUCTION_TYPE_OPTIONS.find((o) => o.value === value)?.hint ??
  DEDUCTION_TYPE_OPTIONS[0].hint
