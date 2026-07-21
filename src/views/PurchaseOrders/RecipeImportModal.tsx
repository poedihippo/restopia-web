import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { recipesService } from '@/services/recipes.service'
import { X, Search, Loader2 } from 'lucide-react'

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
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const { data: recipesData, isLoading } = useQuery({
    queryKey: ['recipes-for-import'],
    queryFn: () =>
      recipesService
        .list({ per_page: 100, include: 'product_uom,recipe_materials' } as any)
        .then((r) => r.data),
    enabled: open,
  })

  const recipes = (recipesData as any)?.data ?? []

  const filteredRecipes = recipes.filter((r: any) =>
    (r.product_uom?.product?.name || '').toLowerCase().includes(search.toLowerCase())
  )

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  const selectAll = () => {
    setSelectedIds(filteredRecipes.map((r: any) => r.id))
  }

  const clearAll = () => {
    setSelectedIds([])
  }

  const handleImport = () => {
    const selectedRecipes = recipes.filter((r: any) => selectedIds.includes(r.id))
    onImport(selectedRecipes)
    onClose()
    setSelectedIds([])
    setSearch('')
  }

  const handleClose = () => {
    onClose()
    setSelectedIds([])
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
          maxWidth: 600,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>Load from Recipes</h2>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Select recipes to import their materials into line items.</p>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-muted)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search recipe..."
                style={{
                  width: '100%', padding: '8px 12px 8px 34px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', background: 'var(--background)', fontSize: 13, outline: 'none'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={selectAll} style={{ fontSize: 12, padding: '6px 10px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Select All</button>
              <button type="button" onClick={clearAll} style={{ fontSize: 12, padding: '6px 10px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Clear</button>
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {isLoading ? (
              <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--foreground-muted)' }} />
              </div>
            ) : filteredRecipes.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', fontSize: 13, color: 'var(--foreground-muted)' }}>No recipes found.</div>
            ) : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {filteredRecipes.map((recipe: any) => {
                  const selected = selectedIds.includes(recipe.id)
                  const recipeName = recipe.product_uom?.product?.name || `Recipe #${recipe.id}`
                  return (
                    <div
                      key={recipe.id}
                      onClick={() => toggleSelect(recipe.id)}
                      style={{
                        padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex',
                        alignItems: 'center', gap: 12, cursor: 'pointer', background: selected ? 'var(--accent-light-bg)' : 'transparent'
                      }}
                    >
                      <div
                        style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                          border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                          background: selected ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        {selected && <span style={{ color: 'white', fontSize: 12, lineHeight: 1 }}>✓</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>{recipeName}</span>
                        <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{recipe.recipe_materials?.length || 0} materials</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background)' }}>
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{selectedIds.length} selected</span>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" onClick={handleClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedIds.length === 0}
              style={{
                padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none',
                borderRadius: 'var(--radius-md)', fontSize: 13, cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
                opacity: selectedIds.length === 0 ? 0.6 : 1
              }}
            >
              Import {selectedIds.length > 0 ? selectedIds.length : ''} Recipes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
