import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { recipesService } from '@/services/recipes.service'
import { X, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

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
  const [page, setPage] = useState(1)
  const perPage = 15
  const [selectedRecipesMap, setSelectedRecipesMap] = useState<Record<number, any>>({})

  // Fetch ALL recipes (total is only 178 recipes, takes only 2 fast requests of 100 items)
  const { data: allRecipes = [], isLoading, isFetching } = useQuery({
    queryKey: ['all-recipes-for-modal'],
    enabled: open,
    queryFn: () =>
      recipesService
        .list({
          per_page: 1000,
          include: 'product_uom,recipe_materials',
          sort: '-id',
        } as any)
        .then((r) => (r.data as any)?.data ?? []),
    staleTime: 60 * 1000,
  })

  // Instant client-side search across all loaded recipes
  const filteredRecipes = useMemo(() => {
    if (!search.trim()) return allRecipes
    const q = search.toLowerCase().trim()
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
  }, [allRecipes, search])

  // Reset to page 1 whenever search query changes
  useEffect(() => {
    setPage(1)
  }, [search])

  const totalItems = filteredRecipes.length
  const totalPages = Math.ceil(totalItems / perPage) || 1

  // Paginated slice
  const paginatedRecipes = useMemo(() => {
    const start = (page - 1) * perPage
    return filteredRecipes.slice(start, start + perPage)
  }, [filteredRecipes, page, perPage])

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
      paginatedRecipes.forEach((r: any) => {
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
    setPage(1)
  }

  const handleClose = () => {
    onClose()
    setSelectedRecipesMap({})
    setSearch('')
    setPage(1)
  }

  if (!open) return null

  const fromItem = totalItems > 0 ? (page - 1) * perPage + 1 : 0
  const toItem = totalItems > 0 ? Math.min(page * perPage, totalItems) : 0

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
                disabled={paginatedRecipes.length === 0}
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: paginatedRecipes.length === 0 ? 'not-allowed' : 'pointer',
                  color: 'var(--foreground)',
                  opacity: paginatedRecipes.length === 0 ? 0.6 : 1,
                }}
              >
                Select Page
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
            ) : paginatedRecipes.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--foreground-muted)' }}>
                {search
                  ? `No recipes found matching "${search}".`
                  : 'No recipes found.'}
              </div>
            ) : (
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {paginatedRecipes.map((recipe: any) => {
                  const selected = !!selectedRecipesMap[recipe.id]
                  const recipeName =
                    recipe.product_uom?.product?.name ??
                    recipe.product_uom?.code ??
                    recipe.name ??
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
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalItems > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--foreground-muted)' }}>
              <span>
                Showing {fromItem}–{toItem} of {totalItems} recipes
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    color: 'var(--foreground)',
                    opacity: page === 1 ? 0.5 : 1,
                  }}
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <span style={{ padding: '0 4px', fontWeight: 500 }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    color: 'var(--foreground)',
                    opacity: page >= totalPages ? 0.5 : 1,
                  }}
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
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
