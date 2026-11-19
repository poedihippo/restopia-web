import React, { useState, useEffect, useMemo, useRef } from 'react'
import { recipesService } from '@/services/recipes.service'
import { X, Search, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import { getProductUomName } from '@/utils/productUomName'

interface RecipeImportModalProps {
  open: boolean
  onClose: () => void
  onImport: (selectedRecipes: any[]) => void
}

export default function RecipeImportModal({
  open,
  onClose,
  onImport,
}: RecipeImportModalProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])
  const [selectedRecipesMap, setSelectedRecipesMap] = useState<Record<number, any>>({})

  // Filter recipes by logged-in user's branch type
  const { user } = useAuth()
  const recipeTypeFilter = user?.type === 'superadmin'
    ? undefined
    : user?.branch?.type

  // Recipes in pages of 20; the next page loads when the list is scrolled to the
  // bottom. GET /recipes' filter[search] only matches the `qty` column (no product
  // name / SKU), so the text search below stays client-side over the loaded pages —
  // and while the sentinel stays visible (few/no matches) pages keep loading.
  const recipesQuery = useInfiniteOptions<any>({
    queryKey: ['all-recipes-for-modal', recipeTypeFilter],
    enabled: open,
    staleTime: 60 * 1000,
    fetchPage: (page) =>
      recipesService
        .list({
          page,
          per_page: 20,
          include: 'product_uom,recipe_materials',
          sort: '-id',
          ...(recipeTypeFilter ? { 'filter[type]': recipeTypeFilter } : {}),
        } as any)
        .then((r) => r.data),
  })
  const allRecipes = recipesQuery.items
  const { isLoading, isFetching, hasNextPage, isFetchingNextPage, fetchNextPage } = recipesQuery
  const totalRecipes = Number(
    ((recipesQuery.data?.pages?.[0] as any)?.data?.meta ?? (recipesQuery.data?.pages?.[0] as any)?.meta)?.total ?? 0,
  )

  // Client-side search across the loaded recipes (debounced)
  const filteredRecipes = useMemo(() => {
    if (!debouncedSearch.trim()) return allRecipes
    const q = debouncedSearch.toLowerCase().trim()
    return allRecipes.filter((r: any) => {
      const productName = (r.product_uom?.product?.name || '').toLowerCase()
      const productCode = (r.product_uom?.product?.code || '').toLowerCase()
      const uomCode = (r.product_uom?.code || '').toLowerCase()
      const recipeName = (r.name || '').toLowerCase()
      const recipeId = String(r.id)
      const materialsMatch = (r.recipe_materials || []).some((m: any) => {
        const matProdName = (m.product_uom?.product?.name || '').toLowerCase()
        const matProdCode = (m.product_uom?.product?.code || '').toLowerCase()
        const matUomCode = (m.product_uom?.code || '').toLowerCase()
        return matProdName.includes(q) || matProdCode.includes(q) || matUomCode.includes(q)
      })

      return (
        productName.includes(q) ||
        productCode.includes(q) ||
        uomCode.includes(q) ||
        recipeName.includes(q) ||
        recipeId === q ||
        materialsMatch
      )
    })
  }, [allRecipes, debouncedSearch])

  // Load the next page when the bottom sentinel scrolls into the list's view. The
  // observer is re-created after every page, so it fires again if still visible.
  const listRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!open || !el || !hasNextPage || isFetchingNextPage) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage()
      },
      { root: listRef.current, rootMargin: '0px 0px 80px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [open, hasNextPage, isFetchingNextPage, fetchNextPage, filteredRecipes.length, isLoading])

  const toggleSelect = (recipe: any) => {
    setSelectedRecipesMap((prev) => {
      const next = { ...prev }
      if (next[recipe.id]) {
        delete next[recipe.id]
      } else {
        next[recipe.id] = recipe
      }
      return next
    })
  }

  const selectAllCurrentPage = () => {
    setSelectedRecipesMap((prev) => {
      const next = { ...prev }
      filteredRecipes.forEach((r: any) => {
        next[r.id] = r
      })
      return next
    })
  }

  const clearAll = () => {
    setSelectedRecipesMap({})
  }

  const selectedCount = Object.keys(selectedRecipesMap).length

  const handleImport = () => {
    const selectedRecipes = Object.values(selectedRecipesMap)
    onImport(selectedRecipes)
    onClose()
    setSelectedRecipesMap({})
    setSearch('')
  }

  const handleClose = () => {
    onClose()
    setSelectedRecipesMap({})
    setSearch('')
  }

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={handleClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      
      <div
        style={{
          position: 'relative',
          width: '90%',
          maxWidth: 640,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '88vh',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>Load from Recipes</h2>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
              Select recipes to import their materials into line items.
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          {/* Search bar & quick action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--foreground-muted)',
                }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search recipe by name or SKU (e.g. Hazelnut)..."
                style={{
                  width: '100%',
                  padding: '8px 34px 8px 34px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  fontSize: 13,
                  outline: 'none',
                  color: 'var(--foreground)',
                }}
              />
              {isFetching ? (
                <Loader2
                  size={14}
                  className="animate-spin"
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--foreground-muted)',
                  }}
                />
              ) : search.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--foreground-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 2,
                  }}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={selectAllCurrentPage}
                disabled={filteredRecipes.length === 0}
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: filteredRecipes.length === 0 ? 'not-allowed' : 'pointer',
                  color: 'var(--foreground)',
                  opacity: filteredRecipes.length === 0 ? 0.6 : 1,
                }}
              >
                {/* The count makes clear how many recipes (all loaded ones, not one page) get selected. */}
                Select Shown ({filteredRecipes.length})
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={selectedCount === 0}
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
                  color: 'var(--foreground)',
                  opacity: selectedCount === 0 ? 0.6 : 1,
                }}
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Recipes List Container */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {isLoading ? (
              <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--foreground-muted)' }} />
                <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Loading recipes...</span>
              </div>
            ) : (
              <div ref={listRef} style={{ maxHeight: 320, overflowY: 'auto' }}>
                {filteredRecipes.length === 0 && !hasNextPage && (
                  <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--foreground-muted)' }}>
                    {debouncedSearch
                      ? `No recipes found matching "${debouncedSearch}".`
                      : 'No recipes found.'}
                  </div>
                )}
                {filteredRecipes.map((recipe: any) => {
                  const selected = !!selectedRecipesMap[recipe.id]
                  const recipeName =
                    getProductUomName(recipe.product_uom, recipe.product_uom?.product?.name) ||
                    recipe.product_uom?.code ||
                    recipe.name ||
                    `Recipe #${recipe.id}`
                  const materialCount = recipe.recipe_materials?.length ?? 0
                  const uomCode = recipe.product_uom?.uom?.code || recipe.product_uom?.uom?.name || 'PCS'
                  const sku = recipe.product_uom?.code

                  return (
                    <div
                      key={recipe.id}
                      onClick={() => toggleSelect(recipe)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        cursor: 'pointer',
                        background: selected ? 'var(--accent-light-bg, rgba(160,82,45,0.08))' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {}} // Handled by div onClick
                        style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--accent)' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                            {recipeName}
                          </span>
                          {sku && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: 'var(--foreground-muted)',
                                background: 'var(--background)',
                                border: '1px solid var(--border)',
                                padding: '1px 5px',
                                borderRadius: 4,
                              }}
                            >
                              {sku}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}>
                          {materialCount} materials • Unit: {uomCode}
                        </span>
                      </div>
                    </div>
                  )
                })}
                {hasNextPage && (
                  <div
                    ref={sentinelRef}
                    style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: 'var(--foreground-muted)' }}
                  >
                    {isFetchingNextPage && <Loader2 size={12} className="animate-spin" />}
                    {isFetchingNextPage ? 'Memuat...' : 'Scroll untuk memuat lebih banyak'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Loaded count */}
          {filteredRecipes.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--foreground-muted)' }}>
              <span>
                {debouncedSearch
                  ? `${filteredRecipes.length} matching of ${allRecipes.length} loaded recipes`
                  : `Showing ${allRecipes.length}${totalRecipes > 0 ? ` of ${totalRecipes}` : ''} recipes`}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--surface-muted, var(--background))',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
            {selectedCount} recipe{selectedCount === 1 ? '' : 's'} selected
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--background)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--foreground)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedCount === 0}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'var(--accent)',
                fontSize: 13,
                fontWeight: 500,
                color: 'white',
                cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
                opacity: selectedCount === 0 ? 0.6 : 1,
              }}
            >
              Import {selectedCount} Recipe{selectedCount === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
