'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { recipesService } from '@/services/recipes.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import RecipeSheet from './RecipeSheet'
import { exportRecipesExcel } from './recipeExport'
import { printRecipe } from './recipePrint'
import SearchableSelect from '@/components/SearchableSelect'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import { FilterBar, FilterGroup, FilterField, countActive } from '@/components/ListFilters'
import { productUomsService } from '@/services/product-uoms.service'
import { productsService } from '@/services/products.service'
import { getProductUomName, withProductType } from '@/utils/productUomName'
import { DEDUCTION_TYPE_OPTIONS, deductionTypeHint, deductionTypeLabel, deductionTypeTone } from '@/utils/deductionType'
import {
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  FileSpreadsheet,
  Printer,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  ChevronDown,
} from 'lucide-react'

interface Recipe {
  id: number
  product_uom_id: number
  qty: number
  is_default: boolean
  created_at?: string
  product_uom?: {
    id: number
    code?: string
    product?: { id: number; name: string }
    uom?: { id: number; name: string; code: string }
  }
  recipe_materials?: Array<{
    id: number
    product_uom_id: number
    qty: number
    deduction_type?: string
    product_uom?: {
      id: number
      code?: string
      product?: { name: string }
      uom?: { name?: string; code: string }
    }
  }>
}

/** Ingredients listed on a collapsed recipe card. */
const PREVIEW_COUNT = 4

/** Two rows of five cards on a desktop screen — a full page without scrolling. */
const PAGE_SIZE = 10

export default function RecipesView() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission("recipe.read");
  const canCreate = hasPermission('recipe.create')
  const canEdit = hasPermission('recipe.update')
  const canDelete = hasPermission('recipe.delete')

  const [page, setPage] = useState(1)
  const perPage = PAGE_SIZE
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('')
  const [productSearch, setProductSearch] = useState('')
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('')
  const [defaultFilter, setDefaultFilter] = useState<string>('')
  const [materialFilter, setMaterialFilter] = useState<number | ''>('')
  const [materialSearch, setMaterialSearch] = useState('')
  const [debouncedMaterialSearch, setDebouncedMaterialSearch] = useState('')
  
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<Recipe | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedProductSearch(productSearch)
    }, 400)
    return () => clearTimeout(t)
  }, [productSearch])

  // 1. Search products for the filter dropdown via /v1/products (Product Search)
  const productsOpts = useInfiniteOptions<any>({
    queryKey: ['products-for-recipes-filter', debouncedProductSearch],
    fetchPage: (page) =>
      productsService
        .list({
          page,
          per_page: 50,
          sort: 'name',
          'filter[search]': debouncedProductSearch || undefined,
        } as any)
        .then((r) => r.data),
  })

  const productOptions = productsOpts.items.map((p: any) => ({
    value: p.id,
    label: withProductType(p.name, p.type),
    sublabel: p.code ? `SKU: ${p.code}` : undefined,
  }))

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedMaterialSearch(materialSearch), 400)
    return () => clearTimeout(t)
  }, [materialSearch])

  // Ingredient (material product-UOM) options for the "Contains ingredient" filter
  const materialsOpts = useInfiniteOptions<any>({
    queryKey: ['product-uoms-all', 'recipes-material-filter', debouncedMaterialSearch],
    fetchPage: (page) =>
      productUomsService
        .list({
          page,
          per_page: 50,
          include: 'product,uom',
          'filter[search]': debouncedMaterialSearch || undefined,
        } as any)
        .then((r) => r.data),
  })
  const materialOptions = materialsOpts.items.map((pu: any) => ({
    value: pu.id as number,
    label: withProductType(getProductUomName(pu, pu.product?.name) || pu.code || `#${pu.id}`, pu.product?.type),
    sublabel: pu.code ? `SKU: ${pu.code}` : undefined,
  }))

  React.useEffect(() => {
    setPage(1)
  }, [selectedProductId, defaultFilter, materialFilter])

  // Auto-filter recipes by branch type from auth/me
  // production branch → only sees type:production recipes
  // outlet branch → only sees type:outlet recipes
  // warehouse branch → only sees type:warehouse recipes
  // superadmin → sees all (no filter)
  const { user } = useAuth()
  const branchType = user?.branch?.type
  const isSuperadmin = user?.type === 'superadmin'

  // Manual type filter (dropdown) — defaults to branch type for non-superadmin
  const [typeFilter, setTypeFilter] = useState<string>(() => {
    if (isSuperadmin) return ''
    return branchType ?? ''
  })

  // Sync typeFilter when branch type loads (e.g. after auth refresh)
  React.useEffect(() => {
    if (!isSuperadmin && branchType && !typeFilter) {
      setTypeFilter(branchType)
    }
  }, [branchType, isSuperadmin])

  const effectiveTypeFilter = isSuperadmin ? typeFilter : (typeFilter || branchType)

  // Server-side pagination: one page of PAGE_SIZE recipes per request.
  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['all-recipes-list', page, effectiveTypeFilter, defaultFilter, materialFilter, selectedProductId],
    queryFn: () =>
      recipesService
        .list({
          page,
          per_page: perPage,
          include: 'product_uom,recipe_materials',
          sort: '-id',
          ...(effectiveTypeFilter ? { 'filter[type]': effectiveTypeFilter } : {}),
          'filter[is_default]': defaultFilter || undefined,
          'filter[material_product_uom_id]': materialFilter === '' ? undefined : String(materialFilter),
          'filter[product_id]': selectedProductId === '' ? undefined : String(selectedProductId),
        } as any)
        .then((r) => r.data),
    staleTime: 60 * 1000,
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const items: Recipe[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta
  const totalItems: number = meta?.total ?? items.length
  const totalPages: number = meta?.total_pages ?? meta?.last_page ?? 1

  const onExport = async () => {
    setExporting(true)
    try {
      const count = await exportRecipesExcel({
        'filter[type]': effectiveTypeFilter || undefined,
        'filter[is_default]': defaultFilter || undefined,
        'filter[material_product_uom_id]': materialFilter === '' ? undefined : String(materialFilter),
        'filter[product_id]': selectedProductId === '' ? undefined : String(selectedProductId),
      })
      toast.success(`Exported ${count} ${count === 1 ? 'recipe' : 'recipes'}`)
    } catch (err: any) {
      toastMutationApiError(err, 'Failed to export recipes')
    } finally {
      setExporting(false)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (id: number) => recipesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      queryClient.invalidateQueries({ queryKey: ['all-recipes-list'] })
      toast.success('Recipe deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 24,
              fontWeight: 500,
              margin: 0,
              color: 'var(--foreground)',
            }}
          >
            Recipes
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Define bill of materials for finished products
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          title="Download all recipes matching the filters, with ingredients and IDs"
          className="v2-btn v2-btn-ghost"
          style={{ height: 34, padding: '0 14px', fontSize: 13 }}
        >
          {exporting ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <FileSpreadsheet size={15} style={{ color: 'var(--success)' }} />}
          {exporting ? 'Exporting…' : 'Export Excel'}
        </button>
        {canCreate && (<button
          onClick={() => {
            setEditData(null)
            setSheetOpen(true)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}>
          <Plus size={15} />New Recipe
                              </button>)}
        </div>
      </div>

      {/* Toolbar */}
      <FilterBar
        activeCount={countActive(
          selectedProductId,
          (effectiveTypeFilter || '') !== (isSuperadmin ? '' : (branchType ?? '')),
          defaultFilter,
          materialFilter,
        )}
        onClear={() => {
          setSelectedProductId('')
          setTypeFilter(isSuperadmin ? '' : (branchType ?? ''))
          setDefaultFilter('')
          setMaterialFilter('')
          setPage(1)
        }}
        quick={
          <>
            <div style={{ width: 280, maxWidth: '100%' }}>
              <SearchableSelect
                value={selectedProductId}
                onChange={(val) => setSelectedProductId(val)}
                onSearchChange={(val) => setProductSearch(val)}
                options={[{ value: '', label: 'All Products' }, ...productOptions]}
                loading={productsOpts.loading}
                {...productsOpts.selectProps}
                placeholder="Filter by Product"
                searchPlaceholder="Search product by name..."
              />
            </div>
            <div style={{ width: 160 }}>
              <SearchableSelect
                value={effectiveTypeFilter ?? ''}
                onChange={(val) => {
                  setTypeFilter(String(val))
                }}
                options={[
                  { value: '', label: 'All Types' },
                  { value: 'production', label: 'Production' },
                  { value: 'outlet', label: 'Outlet' },
                  { value: 'warehouse', label: 'Warehouse' },
                  { value: 'other', label: 'Other' },
                ]}
                placeholder="Filter by Type"
              />
            </div>
          </>
        }
        actions={
          effectiveTypeFilter ? (
            <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
              {isSuperadmin ? 'Filtered' : 'Auto'}: <strong>{effectiveTypeFilter}</strong>
            </span>
          ) : undefined
        }
      >
        <FilterGroup title="Recipe">
          <FilterField label="Default">
            <SearchableSelect
              value={defaultFilter}
              onChange={(val) => setDefaultFilter(String(val))}
              options={[
                { value: '', label: 'Default: All' },
                { value: 'true', label: 'Default: Yes' },
                { value: 'false', label: 'Default: No' },
              ]}
              placeholder="Default: All"
            />
          </FilterField>
          <FilterField label="Contains ingredient">
            <SearchableSelect
              value={materialFilter}
              onChange={(val) => setMaterialFilter(val === '' ? '' : Number(val))}
              onSearchChange={(val) => setMaterialSearch(val)}
              options={[{ value: '', label: 'All Ingredients' }, ...materialOptions]}
              loading={materialsOpts.loading}
              {...materialsOpts.selectProps}
              placeholder="Contains ingredient"
              searchPlaceholder="Search ingredient..."
            />
          </FilterField>
        </FilterGroup>
      </FilterBar>

      {/* Pagination (top, so the whole page fits on screen) */}
      {!isError && totalItems > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: -8 }}>
          <span style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>
            {isLoading ? 'Loading recipes…' : (
              <>
                <strong style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                  {(page - 1) * perPage + 1}–{Math.min(page * perPage, totalItems)}
                </strong>{' '}
                of {totalItems} {totalItems === 1 ? 'recipe' : 'recipes'}
              </>
            )}
          </span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="v2-icon-btn recipe-pager-btn" style={{ opacity: page <= 1 ? 0.4 : 1 }}
              >
                <ChevronLeft size={15} />
              </button>
              <span style={{ fontSize: 12.5, color: 'var(--foreground-muted)', minWidth: 64, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                Page <strong style={{ color: 'var(--foreground)' }}>{page}</strong> / {totalPages}
              </span>
              <button
                type="button"
                aria-label="Next page"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="v2-icon-btn recipe-pager-btn" style={{ opacity: page >= totalPages ? 0.4 : 1 }}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recipe book */}
      {isError ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--destructive)',
          }}
        >
          Failed to load recipes
        </div>
      ) : !isLoading && items.length === 0 ? (
        <div
          style={{
            padding: '56px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            border: '1px dashed var(--border-strong)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <BookOpen size={32} style={{ color: 'var(--accent-light)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--foreground)' }}>
            The recipe book is empty
          </span>
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
            No recipes match these filters.
          </span>
        </div>
      ) : (
        <div className="recipe-book">
          {/* Loading */}
          {isLoading &&
            Array.from({ length: PAGE_SIZE }, (_, i) => i).map((i) => (
              <div
                key={i}
                className="recipe-card"
                style={{ height: 300, animation: 'pulse 1.5s ease-in-out infinite' }}
              >
                <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ width: 80, height: 9, borderRadius: 99, background: 'var(--border)' }} />
                  <div style={{ width: '70%', height: 18, borderRadius: 6, background: 'var(--border)' }} />
                  <div style={{ width: '45%', height: 11, borderRadius: 6, background: 'var(--border)' }} />
                </div>
              </div>
            ))}

          {/* Cards */}
          {!isLoading &&
            items.map((item) => {
              const isOpen = expandedId === item.id
              const materials = item.recipe_materials ?? []
              const shown = isOpen ? materials : materials.slice(0, PREVIEW_COUNT)
              const hidden = materials.length - shown.length
              const recipeType = (item as any).type as string | undefined
              const yieldUom = (item.product_uom?.uom?.code ?? '').toLowerCase()
              const recipeName = item.product_uom ? (getProductUomName(item.product_uom, item.product_uom.product?.name) || '—') : '—'
              return (
                <article
                  key={item.id}
                  className="recipe-card"
                  data-open={isOpen}
                  onClick={() => setExpandedId(isOpen ? null : item.id)}
                >
                  <div style={{ padding: '16px 18px 2px' }}>
                    {/* SKU + tags */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, minHeight: 18 }}>
                      {item.product_uom?.code && (<span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          letterSpacing: '1.4px',
                          textTransform: 'uppercase',
                          color: 'var(--accent-light)',
                        }}
                      >
                        SKU {item.product_uom.code}
                      </span>)}
                      <span style={{ flex: 1 }} />
                      {recipeType && (
                        <span
                          style={{
                            fontSize: 10.5,
                            color: 'var(--foreground-muted)',
                            textTransform: 'capitalize',
                          }}
                        >
                          {recipeType}
                        </span>
                      )}
                      {item.is_default && (
                        <span
                          title="Default recipe for this product"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '1px 8px',
                            background: 'var(--accent-light-bg)',
                            color: 'var(--accent)',
                            borderRadius: 99,
                            fontSize: 10.5,
                            fontWeight: 600,
                          }}
                        >
                          <Check size={10} />
                          Default
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3
                      title={recipeName}
                      style={{
                        margin: 0,
                        fontFamily: 'var(--font-display)',
                        fontSize: 17,
                        fontWeight: 500,
                        lineHeight: 1.3,
                        color: 'var(--foreground)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {recipeName}
                    </h3>
                    <p
                      style={{
                        margin: '4px 0 0',
                        fontFamily: 'var(--font-display)',
                        fontStyle: 'italic',
                        fontSize: 13,
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      Makes {(item.qty ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {yieldUom || item.product_uom?.uom?.name || ''}
                      {' · '}
                      {materials.length} {materials.length === 1 ? 'ingredient' : 'ingredients'}
                    </p>
                  </div>

                  {/* Ingredients */}
                  <div style={{ padding: '10px 18px 12px', flex: 1 }}>
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        letterSpacing: '1.2px',
                        textTransform: 'uppercase',
                        color: 'var(--foreground-subtle)',
                        paddingBottom: 8,
                        marginBottom: 6,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      Ingredients
                    </div>
                    {materials.length === 0 ? (
                      <span style={{ display: 'block', minHeight: PREVIEW_COUNT * 24, fontSize: 13, fontStyle: 'italic', color: 'var(--foreground-subtle)' }}>
                        No ingredients yet
                      </span>
                    ) : (
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, minHeight: isOpen ? undefined : PREVIEW_COUNT * 24 }}>
                        {shown.map((mat) => (
                          <li
                            key={mat.id}
                            title={deductionTypeHint(mat.deduction_type)}
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: 6,
                              padding: '3px 0',
                              fontSize: 12.5,
                            }}
                          >
                            <span
                              style={{
                                color: 'var(--foreground)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                minWidth: 0,
                              }}
                            >
                              {mat.product_uom ? (getProductUomName(mat.product_uom, mat.product_uom.product?.name) || '—') : '—'}
                            </span>
                            <span className="recipe-leader" />
                            <span
                              style={{
                                fontVariantNumeric: 'tabular-nums',
                                fontWeight: 600,
                                color: 'var(--foreground)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {(mat.qty ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                              <span style={{ fontWeight: 400, color: 'var(--foreground-muted)', marginLeft: 4 }}>
                                {(mat.product_uom?.uom?.code ?? '').toLowerCase()}
                              </span>
                            </span>
                            {isOpen && (
                              <span
                                style={{
                                  width: 62,
                                  flexShrink: 0,
                                  alignSelf: 'center',
                                  textAlign: 'center',
                                  padding: '1px 0',
                                  borderRadius: 99,
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                  background: `var(--${deductionTypeTone(mat.deduction_type)}-bg)`,
                                  color: `var(--${deductionTypeTone(mat.deduction_type)})`,
                                }}
                              >
                                {deductionTypeLabel(mat.deduction_type)}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {!isOpen && (
                      <span style={{ display: 'block', height: 18, marginTop: 4, fontSize: 12, fontStyle: 'italic', color: 'var(--foreground-muted)' }}>
                        {hidden > 0 ? `+ ${hidden} more ${hidden === 1 ? 'ingredient' : 'ingredients'}` : ''}
                      </span>
                    )}
                    {isOpen && materials.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px 14px',
                          marginTop: 10,
                          paddingTop: 8,
                          borderTop: '1px dashed var(--border)',
                          fontSize: 11,
                          color: 'var(--foreground-muted)',
                        }}
                      >
                        {DEDUCTION_TYPE_OPTIONS.map((o) => (
                          <span key={o.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <span
                              style={{
                                padding: '0 8px',
                                borderRadius: 99,
                                fontWeight: 600,
                                background: `var(--${deductionTypeTone(o.value)}-bg)`,
                                color: `var(--${deductionTypeTone(o.value)})`,
                              }}
                            >
                              {o.label}
                            </span>
                            {o.hint.toLowerCase()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '6px 10px 6px 18px',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--accent)',
                        flex: 1,
                      }}
                    >
                      {isOpen ? 'Show less' : materials.length > PREVIEW_COUNT ? 'Full recipe' : 'Details'}
                      <ChevronDown
                        size={13}
                        style={{ transform: isOpen ? 'rotate(180deg)' : undefined, transition: 'transform 150ms ease' }}
                      />
                    </span>
                    <div style={{ display: 'flex', gap: 2 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="v2-icon-btn"
                        title="Print recipe for the kitchen"
                        aria-label="Print recipe"
                        onClick={() => printRecipe(item)}
                      >
                        <Printer size={14} />
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          className="v2-icon-btn"
                          title="Edit recipe"
                          aria-label="Edit recipe"
                          onClick={() => {
                            setEditData(item)
                            setSheetOpen(true)
                          }}
                          >
                          <Pencil size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="v2-icon-btn"
                          title="Delete recipe"
                          aria-label="Delete recipe"
                          data-tone="danger"
                          onClick={() => setDeleteConfirmId(item.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
        </div>
      )}
      {/* Delete confirm dialog */}
      {deleteConfirmId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={() => setDeleteConfirmId(null)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.25)',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 51,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              width: 360,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3
              style={{
                fontSize: 15,
                fontWeight: 600,
                margin: '0 0 8px',
                color: 'var(--foreground)',
              }}
            >
              Delete Recipe
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--foreground-muted)',
                margin: '0 0 20px',
              }}
            >
              This will permanently remove the recipe and all its ingredients.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  padding: '8px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                style={{
                  padding: '8px 16px',
                  background: 'var(--destructive)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'white',
                  cursor: 'pointer',
                  opacity: deleteMutation.isPending ? 0.7 : 1,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Sheet */}
      <RecipeSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setEditData(null)
        }}
        editData={editData}
      />
      <style>{`
        .recipe-book {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 14px;
          align-items: start;
        }
        .recipe-card {
          position: relative;
          display: flex;
          flex-direction: column;
          background: var(--surface);
          border: 1px solid var(--border);
          border-top: 3px solid var(--accent);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          cursor: pointer;
          transition: box-shadow 150ms ease, border-color 150ms ease, transform 150ms ease;
        }
        .recipe-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
        .recipe-card[data-open="true"] { border-color: var(--accent-light); border-top-color: var(--accent); box-shadow: var(--shadow-md); }
        .recipe-pager-btn { border: 1px solid var(--border) !important; background: var(--surface); }
        .recipe-pager-btn:hover:not(:disabled) { border-color: var(--border-strong) !important; }
        .recipe-leader {
          flex: 1;
          min-width: 16px;
          border-bottom: 1px dotted var(--border-strong);
          transform: translateY(-3px);
        }
        @media (min-width: 1440px) {
          .recipe-book { grid-template-columns: repeat(5, minmax(0, 1fr)); }
        }
        @media (max-width: 480px) {
          .recipe-book { grid-template-columns: minmax(0, 1fr); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
