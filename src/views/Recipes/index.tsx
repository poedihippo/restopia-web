'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { recipesService } from '@/services/recipes.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import RecipeSheet from './RecipeSheet'
import SearchableSelect from '@/components/SearchableSelect'
import { productUomsService } from '@/services/product-uoms.service'
import { productsService } from '@/services/products.service'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Check,
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
    product_uom?: {
      id: number
      code?: string
      product?: { name: string }
      uom?: { name?: string; code: string }
    }
  }>
}

export default function RecipesView() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission("recipe.read");
  const canCreate = hasPermission('recipe.create')
  const canEdit = hasPermission('recipe.update')
  const canDelete = hasPermission('recipe.delete')

  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('')
  const [productSearch, setProductSearch] = useState('')
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('')
  
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<Recipe | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedProductSearch(productSearch)
    }, 400)
    return () => clearTimeout(t)
  }, [productSearch])

  // 1. Search products for the filter dropdown via /v1/products (Product Search)
  const { data: productsData } = useQuery({
    queryKey: ['products-for-recipes-filter', debouncedProductSearch],
    queryFn: () =>
      productsService
        .list({
          per_page: 50,
          sort: 'name',
          'filter[search]': debouncedProductSearch || undefined,
        } as any)
        .then((r) => r.data),
  })

  const productOptions = (productsData as any)?.data?.map((p: any) => ({
    value: p.id,
    label: p.name,
    sublabel: p.code ? `SKU: ${p.code}` : undefined,
  })) ?? []

  React.useEffect(() => {
    setPage(1)
  }, [selectedProductId])

  // Fetch all recipes (there are only 178 total recipes, fetched in 2 quick batches of 100)
  const { data: allRecipes = [], isLoading, isError } = useQuery({
    queryKey: ['all-recipes-list'],
    queryFn: async () => {
      let currentPage = 1
      let totalPages = 1
      let results: any[] = []
      do {
        const res = await recipesService
          .list({
            page: currentPage,
            per_page: 100,
            include: 'product_uom,recipe_materials',
            sort: '-id',
          } as any)
          .then((r) => r.data)
        const items = (res as any)?.data ?? []
        results = results.concat(items)
        totalPages = (res as any)?.meta?.last_page ?? (res as any)?.meta?.total_pages ?? 1
        currentPage++
      } while (currentPage <= totalPages && currentPage <= 10)
      return results
    },
    staleTime: 60 * 1000,
  })

  // Instant filtering across all recipes by selected product
  const filteredRecipes = React.useMemo(() => {
    if (!selectedProductId) return allRecipes
    return allRecipes.filter(
      (r: any) =>
        r.product_uom?.product_id === selectedProductId ||
        r.product_uom?.product?.id === selectedProductId
    )
  }, [allRecipes, selectedProductId])

  const totalItems = filteredRecipes.length
  const totalPages = Math.ceil(totalItems / perPage) || 1

  const items: Recipe[] = React.useMemo(() => {
    const start = (page - 1) * perPage
    return filteredRecipes.slice(start, start + perPage)
  }, [filteredRecipes, page, perPage])

  const meta = {
    current_page: page,
    last_page: totalPages,
    per_page: perPage,
    total: totalItems,
  }

  const deleteMutation = useMutation({
    mutationFn: (id: number) => recipesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
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

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ width: 280, maxWidth: '100%' }}>
          <SearchableSelect
            value={selectedProductId}
            onChange={(val) => setSelectedProductId(val)}
            onSearchChange={(val) => setProductSearch(val)}
            options={[{ value: '', label: 'All Products' }, ...productOptions]}
            placeholder="Filter by Product"
            searchPlaceholder="Search product by name..."
          />
        </div>
      </div>

      {/* Recipe cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Loading */}
        {isLoading && (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 80,
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--border)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            ))}
          </>
        )}

        {/* Error */}
        {isError && (
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
        )}

        {/* Empty */}
        {!isLoading && !isError && items.length === 0 && (
          <div
            style={{
              padding: 48,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <BookOpen size={32} style={{ color: 'var(--foreground-subtle)' }} />
            <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
              No recipes found
            </span>
          </div>
        )}

        {/* Cards */}
        {!isLoading &&
          items.map((item) => (
            <div
              key={item.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* Card header */}
              <div
                onClick={() =>
                  setExpandedId(expandedId === item.id ? null : item.id)
                }
                style={{
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                }}
              >
                {/* Product info */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--foreground)',
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {item.product_uom?.product?.name ?? '—'}
                    </span>
                    {item.is_default && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          padding: '1px 8px',
                          background: 'var(--accent-light-bg)',
                          color: 'var(--accent)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        <Check size={10} />
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                      UOM:{' '}
                      <span style={{ fontWeight: 500 }}>
                        {item.product_uom?.uom?.name ?? '—'}
                      </span>
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                      Yields:{' '}
                      <span
                        style={{ fontWeight: 500, color: 'var(--foreground)' }}
                      >
                        {(item.qty ?? 0).toLocaleString('id-ID')}{' '}
                        {item.product_uom?.uom?.code ?? ''}
                      </span>
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                      {item.recipe_materials?.length ?? 0} ingredient(s)
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div
                  style={{ display: 'flex', gap: 4 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {canEdit && (<button
                    onClick={() => {
                      setEditData(item)
                      setSheetOpen(true)
                    }}
                    style={{
                      padding: 6,
                      background: 'none',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      color: 'var(--foreground-muted)',
                      display: 'flex',
                    }}>
                    <Pencil size={14} />
                  </button>)}
                  {canDelete && (<button
                    onClick={() => setDeleteConfirmId(item.id)}
                    style={{
                      padding: 6,
                      background: 'none',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      color: 'var(--destructive)',
                      display: 'flex',
                    }}>
                    <Trash2 size={14} />
                  </button>)}
                </div>
              </div>

              {/* Expanded materials */}
              {expandedId === item.id && (
                <div
                  style={{
                    borderTop: '1px solid var(--border)',
                    padding: '12px 20px',
                    background: 'var(--background)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--foreground-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      display: 'block',
                      marginBottom: 8,
                    }}
                  >
                    Ingredients
                  </span>

                  {item.recipe_materials && item.recipe_materials.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {item.recipe_materials.map((mat, idx) => (
                        <div
                          key={mat.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '6px 10px',
                            background: 'var(--surface)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          <span
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 99,
                              background: 'var(--accent-light-bg)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 10,
                              fontWeight: 700,
                              color: 'var(--accent)',
                              flexShrink: 0,
                            }}
                          >
                            {idx + 1}
                          </span>
                          <span
                            style={{
                              flex: 1,
                              fontSize: 13,
                              fontWeight: 500,
                              color: 'var(--foreground)',
                            }}
                          >
                            {mat.product_uom?.product?.name ?? '—'}
                            {mat.product_uom?.uom?.name
                              ? ` — ${mat.product_uom.uom.name}`
                              : ''}
                            {mat.product_uom?.uom?.code
                              ? ` (${mat.product_uom.uom.code})`
                              : ''}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontFamily: 'monospace',
                              color: 'var(--foreground-muted)',
                              padding: '1px 6px',
                              background: 'var(--background)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            {mat.product_uom?.uom?.code ?? ''}
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--foreground)',
                              minWidth: 60,
                              textAlign: 'right',
                            }}
                          >
                            {(mat.qty ?? 0).toLocaleString('id-ID')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: 'var(--foreground-subtle)' }}>
                      No ingredients defined
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
      </div>
      {/* Pagination */}
      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
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
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
