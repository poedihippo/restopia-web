import { recipesService } from '@/services/recipes.service'
import { downloadExcel, reportHeader, type ExcelRow } from '@/utils/excelExport'
import { getProductUomName } from '@/utils/productUomName'
import { deductionTypeLabel } from '@/utils/deductionType'

const EXPORT_PAGE_SIZE = 1000

/**
 * Exports every recipe matching `filters` (all pages, 1000 per request) to a
 * workbook with two sheets: one row per recipe, and one row per ingredient.
 * Every related id is included so the file can be used for imports/audits.
 */
export async function exportRecipesExcel(filters: Record<string, string | undefined>) {
  const recipes: any[] = []
  let page = 1
  let totalPages = 1
  do {
    const res = await recipesService.list({
      page,
      per_page: EXPORT_PAGE_SIZE,
      include: 'product_uom,recipe_materials',
      sort: 'id',
      ...filters,
    } as any)
    const body = res.data as any
    recipes.push(...(body?.data ?? []))
    totalPages = body?.meta?.total_pages ?? body?.meta?.last_page ?? 1
    page += 1
  } while (page <= totalPages)

  const recipeRows: ExcelRow[] = [
    ...reportHeader({ title: 'Recipes', extra: [`Total recipes : ${recipes.length}`] }),
    [
      'Recipe ID', 'Type', 'Default', 'Product ID', 'Product', 'Product UOM ID', 'SKU',
      'UOM ID', 'UOM', 'Yield Qty', 'Ingredients', 'Created At', 'Updated At',
    ],
    ...recipes.map((r) => [
      r.id,
      r.type ?? '',
      r.is_default ? 'Yes' : 'No',
      r.product_uom?.product_id ?? r.product_uom?.product?.id ?? '',
      getProductUomName(r.product_uom, r.product_uom?.product?.name),
      r.product_uom_id ?? r.product_uom?.id ?? '',
      r.product_uom?.code ?? '',
      r.product_uom?.uom_id ?? r.product_uom?.uom?.id ?? '',
      r.product_uom?.uom?.code ?? r.product_uom?.uom?.name ?? '',
      Number(r.qty ?? 0),
      r.recipe_materials?.length ?? 0,
      r.created_at ?? '',
      r.updated_at ?? '',
    ]),
  ]

  const ingredientRows: ExcelRow[] = [
    ...reportHeader({ title: 'Recipe Ingredients' }),
    [
      'Recipe ID', 'Recipe Product UOM ID', 'Recipe Product', 'Recipe Material ID',
      'Material Product ID', 'Material Product UOM ID', 'Ingredient', 'Ingredient SKU',
      'UOM ID', 'UOM', 'Qty', 'Deduction Type', 'Deduction',
    ],
    ...recipes.flatMap((r) =>
      (r.recipe_materials ?? []).map((m: any) => [
        r.id,
        r.product_uom_id ?? r.product_uom?.id ?? '',
        getProductUomName(r.product_uom, r.product_uom?.product?.name),
        m.id,
        m.product_uom?.product_id ?? m.product_uom?.product?.id ?? '',
        m.product_uom_id ?? m.product_uom?.id ?? '',
        getProductUomName(m.product_uom, m.product_uom?.product?.name),
        m.product_uom?.code ?? '',
        m.product_uom?.uom_id ?? m.product_uom?.uom?.id ?? '',
        m.product_uom?.uom?.code ?? m.product_uom?.uom?.name ?? '',
        Number(m.qty ?? 0),
        m.deduction_type ?? '',
        deductionTypeLabel(m.deduction_type),
      ]),
    ),
  ]

  const stamp = new Date().toISOString().slice(0, 10)
  downloadExcel(`recipes-${stamp}.xlsx`, [
    { name: 'Recipes', rows: recipeRows, cols: [10, 12, 8, 11, 34, 14, 16, 8, 8, 10, 11, 20, 20] },
    { name: 'Ingredients', rows: ingredientRows, cols: [10, 14, 30, 12, 12, 14, 34, 16, 8, 8, 10, 22, 11] },
  ])
  return recipes.length
}
