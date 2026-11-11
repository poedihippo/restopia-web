import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { productInventoriesService } from '@/services/product-inventories.service'
import type { PosCartItem, PosCartBundle } from '@/types/api'
import { formatCurrency } from '@/utils/price';
import { getProductUomName, withProductType } from '@/utils/productUomName'
import { availableStockOf } from '@/utils/inventoryStock'

/** Expiry on a product card: DD-MM-YYYY (e.g. 03-11-2026). */
const formatExpiry = (value: string | null | undefined): string => {
  if (!value) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}


interface PosProductGridProps {
  activeTab: 'products' | 'bundles'
  setActiveTab: (val: 'products' | 'bundles') => void
  selectedCategory: string | null
  setSelectedCategory: (val: string | null) => void
  categories: string[]
  sortBy: string
  setSortBy: (val: string) => void
  inStockOnly: boolean
  setInStockOnly: (val: (prev: boolean) => boolean) => void
  productPage: number
  setProductPage: (val: number | ((prev: number) => number)) => void
  productMeta: any
  items: any[]
  groupedItems: any[]
  isLoading: boolean
  hoveredCard: string | null
  setHoveredCard: (val: string | null) => void
  addLotToCart: (lot: any) => void
  batchPickerGroup: any | null
  setBatchPickerGroup: (group: any | null) => void
  orderType: 'online' | 'offline'
  bundleSearch: string
  setBundleSearch: (val: string) => void
  isBundleLoading: boolean
  bundles: any[]
  addBundleToCart: (bundle: any) => void
  addConfiguredBundleToCart: (bundle: any, selectedBatches: Record<number, any>) => void
  bundlePickerGroup: any | null
  setBundlePickerGroup: (group: any | null) => void
}

export default function PosProductGrid({
  activeTab,
  setActiveTab,
  selectedCategory,
  setSelectedCategory,
  categories,
  sortBy,
  setSortBy,
  inStockOnly,
  setInStockOnly,
  productPage,
  setProductPage,
  productMeta,
  items,
  groupedItems,
  isLoading,
  hoveredCard,
  setHoveredCard,
  addLotToCart,
  batchPickerGroup,
  setBatchPickerGroup,
  orderType,
  bundleSearch,
  setBundleSearch,
  isBundleLoading,
  bundles,
  addBundleToCart,
  addConfiguredBundleToCart,
  bundlePickerGroup,
  setBundlePickerGroup,
}: PosProductGridProps) {
  // The page count only arrives with the product list, so while it loads
  // (reload, page change) keep the footer from the last known count instead of
  // letting it vanish and pop back. Remembered per browser tab.
  const metaLastPage: number | undefined = productMeta?.last_page ?? productMeta?.total_pages
  const [knownLastPage, setKnownLastPage] = useState<number>(() => {
    try {
      return Number(sessionStorage.getItem('pos-product-last-page')) || 1
    } catch {
      return 1
    }
  })
  useEffect(() => {
    if (!metaLastPage) return
    setKnownLastPage(metaLastPage)
    try {
      sessionStorage.setItem('pos-product-last-page', String(metaLastPage))
    } catch {
      /* storage unavailable: only this session's memory */
    }
  }, [metaLastPage])
  const lastPage: number = metaLastPage ?? knownLastPage
  const pagerLoading = isLoading && !productMeta

  return (
    <>
      {/* Tap feedback on a product card: a slight press, nothing more. */}
      <style>{`
        .pos-product-card:not([data-disabled]):active { transform: scale(0.97); }
        .pos-pager-btn {
          height: 34px; padding: 0 12px; display: inline-flex; align-items: center; gap: 4px;
          border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface);
          color: var(--foreground); font: 500 13px var(--font-sans); cursor: pointer;
          transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
        }
        .pos-pager-btn:not(:disabled):hover { background: var(--accent-light-bg); border-color: var(--accent-light); color: var(--accent); }
        .pos-pager-btn:disabled { color: var(--foreground-subtle); cursor: not-allowed; }
        @media (max-width: 640px) {
          .pos-tabs { padding: 0 12px !important; }
          .pos-tabs > button { padding: 0 12px !important; }
          .pos-items-count { display: none; }
          .pos-sort { max-width: 150px; }
          .pos-grid-scroll { padding: 12px 12px 92px !important; }
          .pos-pager { padding: 10px 12px 80px !important; }
          .pos-grid-scroll > div { gap: 10px !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        /* Hover reverses the card: dark brown, light text. Mouse/trackpad only,
           so a tapped card on a touch screen does not stay dark. */
        @media (hover: hover) {
          .pos-product-card:not([data-disabled]):hover {
            /* Milk-chocolate fading into the brand brown, lifted by a warm shadow. */
            background: linear-gradient(160deg, #7A5442 0%, #5C3B2C 100%) !important;
            border-color: #6B4636 !important;
            box-shadow: 0 10px 22px -10px rgba(74, 46, 33, 0.55) !important;
            transform: translateY(-1px);
          }
          .pos-product-card:not([data-disabled]):hover:active { transform: scale(0.97); }
          .pos-product-card:not([data-disabled]):hover * { color: #fff !important; }
          .pos-product-card:not([data-disabled]):hover [data-pc="muted"] { color: rgba(255, 255, 255, 0.72) !important; }
          .pos-product-card:not([data-disabled]):hover [data-pc="badge"] { background: rgba(255, 255, 255, 0.18) !important; }
          .pos-product-card:not([data-disabled]):hover [data-pc="divider"] { border-top-color: rgba(255, 255, 255, 0.2) !important; }
        }
        @media (prefers-reduced-motion: reduce) { .pos-product-card:active { transform: none; } }
      `}</style>
      <div
        className="pos-tabs"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: '0 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
        }}
      >
        {(['products', 'bundles'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              height: 40,
              padding: '0 20px',
              border: 'none',
              borderBottom:
                activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none',
              color: activeTab === tab ? 'var(--accent)' : 'var(--foreground-muted)',
              fontWeight: activeTab === tab ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab === 'products' ? 'Products' : 'Bundles'}
          </button>
        ))}
        {activeTab === 'products' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="pos-items-count" style={{ fontSize: 12, color: 'var(--foreground-subtle)', whiteSpace: 'nowrap' }}>
              {/* Cards are products (lots of one product are grouped into one card),
                  so count cards — the API total counts lots. */}
              {groupedItems.length} product{groupedItems.length === 1 ? '' : 's'}
              {(productMeta?.last_page ?? productMeta?.total_pages ?? 1) > 1 ? ' on this page' : ''}
            </span>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setProductPage(1) }}
              aria-label="Sort products"
              className="pos-sort"
              style={{
                height: 32,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '0 8px',
                fontSize: 13,
                color: 'var(--foreground)',
                background: 'var(--surface)',
                cursor: 'pointer',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <option value="code">Sort: Name A–Z</option>
              <option value="price_asc">Sort: Price Low–High</option>
              <option value="price_desc">Sort: Price High–Low</option>
            </select>
          </div>
        )}
      </div>

      {activeTab === 'products' && (
        <>
          <div className="pos-grid-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'var(--surface-muted, var(--background))' }}>
            {isLoading ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 12,
                }}
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 160,
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--border)',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '60%',
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 40 }}>🛍️</span>
                <span style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>
                  No products found
                </span>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 12,
                }}
              >
                {groupedItems.map((group) => {
                  const item = group.defaultLot
                  const isHovered = hoveredCard === group.key
                  const lotCount = group.lots.length
                  const outOfStock = group.totalStock <= 0
                  return (
                    <div
                      key={group.key}
                      className="pos-product-card"
                      data-disabled={outOfStock || undefined}
                      onClick={() => {
                        if (lotCount > 1) {
                          setBatchPickerGroup(group)
                        } else {
                          addLotToCart(group.defaultLot)
                        }
                      }}
                      onMouseEnter={() => setHoveredCard(group.key)}
                      onMouseLeave={() => setHoveredCard(null)}
                      style={{
                        background: 'var(--surface)',
                        border: `1px solid ${isHovered ? 'var(--accent-light)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-lg)',
                        padding: 12,
                        opacity: outOfStock ? 0.45 : 1,
                        cursor: outOfStock ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        boxShadow: isHovered ? 'var(--shadow-sm)' : 'none',
                        transition: 'background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 120ms ease',
                        position: 'relative',
                      }}
                    >
                      {lotCount > 1 && (
                        <span
                          data-pc="badge"
                          style={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 99,
                            background: 'var(--accent-light-bg)',
                            color: 'var(--accent)',
                          }}
                        >
                          {lotCount} lots
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--foreground)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: '1.35',
                          paddingRight: lotCount > 1 ? 52 : 0,
                        }}
                      >
                        {getProductUomName(item.product_uom_batch?.product_uom, item.product_uom_batch?.product_uom?.product?.name) ||
                          getProductUomName(item.product_uom, item.product_uom?.product?.name) ||
                          getProductUomName(item.productUom, item.productUom?.product?.name) ||
                          item.product?.name ||
                          item.code ||
                          `#${item.id}`}
                      </span>
                      <span data-pc="muted" style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: -6 }}>
                        {item.product_uom_batch?.product_uom?.code ??
                          item.product_uom?.code ??
                          item.code}
                      </span>
                      {/* Exp then Stock, pushed down onto the price (free space goes above). */}
                      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {(item.product_uom_batch?.expiry_date ?? item.expiry_date) && (
                          <span
                            data-pc="muted"
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color:
                                new Date((item.product_uom_batch?.expiry_date ?? item.expiry_date)) < new Date()
                                  ? 'var(--destructive)'
                                  : new Date((item.product_uom_batch?.expiry_date ?? item.expiry_date)) <
                                    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                                    ? 'var(--warning)'
                                    : 'var(--foreground-muted)',
                            }}
                          >
                            Exp on{' '}
                            {formatExpiry(item.product_uom_batch?.expiry_date ?? item.expiry_date)}
                            {lotCount > 1 && ' (earliest)'}
                          </span>
                        )}
                        <span
                          data-pc="muted"
                          style={{
                            fontSize: 11,
                            color: group.totalStock > 0 ? 'var(--success)' : 'var(--destructive)',
                            fontWeight: 500,
                          }}
                        >
                          Stock: {group.totalStock}
                        </span>
                      </div>
                      <div data-pc="divider" style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 500,
                            color: 'var(--accent)',
                            marginTop: 4,
                          }}
                        >
                          {formatCurrency(
                            (() => {
                              const uom = item.product_uom_batch?.product_uom ?? item.product_uom ?? item.productUom;
                              return orderType === 'online'
                                ? (uom?.online_price ?? uom?.base_price ?? 0)
                                : (uom?.base_price ?? 0);
                            })()
                          )}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pagination footer: pinned under the grid, outside the scroll area */}
          {lastPage > 1 && (productMeta || isLoading) && (
            <div
              className="pos-pager"
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 20px',
                borderTop: '1px solid var(--border)',
                background: 'var(--surface)',
                // Lifted off the grey grid: a soft shadow cast upwards.
                boxShadow: '0 -6px 16px -10px rgba(42, 26, 19, 0.28)',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <span style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>
                Page <strong style={{ color: 'var(--foreground)', fontWeight: 600 }}>{productPage}</strong> of {lastPage}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="pos-pager-btn"
                  aria-label="Previous page"
                  onClick={() => setProductPage((p: number) => Math.max(1, p - 1))}
                  disabled={pagerLoading || productPage <= 1}
                >
                  <ChevronLeft size={16} />
                  <span>Prev</span>
                </button>
                <button
                  type="button"
                  className="pos-pager-btn"
                  aria-label="Next page"
                  onClick={() => setProductPage((p: number) => Math.min(lastPage, p + 1))}
                  disabled={pagerLoading || productPage >= lastPage}
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Batch Picker Modal */}
          {batchPickerGroup && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100,
              }}
              onClick={() => setBatchPickerGroup(null)}
            >
              <div
                style={{
                  background: 'var(--background)',
                  padding: 24,
                  borderRadius: 'var(--radius-lg)',
                  width: '90%',
                  maxWidth: 500,
                  maxHeight: '80vh',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: 18, color: 'var(--foreground)' }}>Select Batch / Exp Date</h3>
                  <button
                    onClick={() => setBatchPickerGroup(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--foreground-muted)' }}
                  >
                    ×
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {batchPickerGroup.lots.map((lot: any) => {
                    const lotDisplayQty = availableStockOf(lot)
                    return (
                    <div
                      key={lot.id}
                      onClick={() => addLotToCart(lot)}
                      style={{
                        padding: 16,
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface)',
                        cursor: lotDisplayQty > 0 ? 'pointer' : 'not-allowed',
                        opacity: lotDisplayQty > 0 ? 1 : 0.5,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>
                           Batch: {lot.product_uom_batch?.batch_code ?? 'N/A'}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                          {lot.product_uom_batch?.expiry_date ? `Exp on ${formatExpiry(lot.product_uom_batch.expiry_date)}` : 'No Exp Date'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                          {formatCurrency((() => {
                            const lotUom = lot.product_uom_batch?.product_uom ?? lot.product_uom ?? lot.productUom;
                            return orderType === 'online' ? (lotUom?.online_price ?? lotUom?.base_price ?? 0) : (lotUom?.base_price ?? 0);
                          })())}
                        </span>
                        <span style={{ fontSize: 12, color: lotDisplayQty > 0 ? 'var(--success)' : 'var(--destructive)' }}>
                          Stock: {lotDisplayQty}
                          {lot.display_uom_code ? ` ${lot.display_uom_code}` : ''}
                        </span>
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'bundles' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <input
              type="text"
              placeholder="Search bundles..."
              value={bundleSearch}
              onChange={(e) => setBundleSearch(e.target.value)}
              style={{
                width: '100%',
                height: 36,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '0 12px',
                fontSize: 13,
                color: 'var(--foreground)',
                background: 'var(--background)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div className="pos-grid-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'var(--surface-muted, var(--background))' }}>
            {isBundleLoading && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 12,
                }}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 120,
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--border)',
                      opacity: 0.5,
                    }}
                  />
                ))}
              </div>
            )}

            {!isBundleLoading && bundles.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 0',
                  color: 'var(--foreground-muted)',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎁</div>
                <p style={{ fontSize: 14 }}>No bundles available</p>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 12,
              }}
            >
              {bundles.map((bundle: any) => (
                <div
                  key={bundle.id}
                  onClick={() => addBundleToCart(bundle)}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    background: 'var(--surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = 'var(--accent-light)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = 'var(--border)')
                  }
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--accent)',
                      background: 'var(--accent-light-bg)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                      alignSelf: 'flex-start',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Bundle
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>
                    {bundle.name}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                    {bundle.code}
                  </span>
                  {bundle.details && bundle.details.length > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                      {bundle.details.length} item(s) included
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'var(--accent)',
                      marginTop: 4,
                    }}
                  >
                    {formatCurrency(Number(bundle.price))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bundle Batch Picker Modal */}
      {bundlePickerGroup && (
        <BundleBatchPickerModal
          bundle={bundlePickerGroup}
          onClose={() => setBundlePickerGroup(null)}
          onAdd={addConfiguredBundleToCart}
        />
      )}
    </>
  )
}

function BundleBatchPickerModal({
  bundle,
  onClose,
  onAdd,
}: {
  bundle: any
  onClose: () => void
  onAdd: (bundle: any, selectedBatches: Record<number, any>, selectedItems?: Record<number, number>) => void
}) {
  const details = bundle.bundle_details || bundle.details || []

  // Track selected item (bundle_detail_item_id) for each detail slot
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {}
    for (const d of details) {
      if (d.items && d.items.length > 0) {
        initial[d.id] = d.items[0].id
      }
    }
    return initial
  })

  const [selectedBatches, setSelectedBatches] = useState<Record<number, any>>({})

  const handleAdd = () => {
    // Validate that all items have a selected batch
    for (const detail of details) {
      if (!selectedBatches[detail.id]) {
        alert('Please select a batch for all items.')
        return
      }
    }
    onAdd(bundle, selectedBatches, selectedItems)
  }


  const { data: inventoriesData, isLoading } = useQuery({
    queryKey: ['bundle-inventories', bundle.id, selectedItems],
    queryFn: async () => {
      const promises = details.map(async (d: any) => {
        const itemId = selectedItems[d.id]
        if (!itemId) return null

        const item = d.items?.find((i: any) => i.id === itemId) || d.items?.[0] || d

        // Single call using the new filter[product_uom_ids] — replaces the
        // previous flow that fetched batches first, then N parallel
        // inventory calls per batch.
        const invRes = await productInventoriesService.list({
          'filter[product_uom_ids]': String(item.product_uom_id),
          'filter[stage]': 'finished',
          include: 'product_uom_batch',
          per_page: 100,
        } as any)
        const allInventories: any[] = (invRes.data as any)?.data || []

        return {
          detailId: d.id,
          inventories: allInventories,
        }
      })
      const results = await Promise.all(promises)
      return results.filter(Boolean)
    },
    enabled: Object.keys(selectedItems).length === details.length
  })

  // Group fetched inventories by detailId
  const inventoriesByDetailId = (inventoriesData || []).reduce((acc: any, curr: any) => {
    if (curr) {
      acc[curr.detailId] = curr.inventories
    }
    return acc
  }, {})

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--background)',
          padding: 24,
          borderRadius: 'var(--radius-lg)',
          width: '90%',
          maxWidth: 600,
          maxHeight: '85vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, color: 'var(--foreground)' }}>Configure Bundle</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--foreground-muted)' }}>
              {bundle.name} ({bundle.code})
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--foreground-muted)' }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--foreground-muted)' }}>
              Loading batches...
            </div>
          ) : (
            details.map((detail: any) => {
              const itemId = selectedItems[detail.id]
              const item = detail.items?.find((i: any) => i.id === itemId) || detail.items?.[0] || detail
              const qty = item.qty || detail.qty || 1
              
              const inventories = inventoriesByDetailId[detail.id] || []
              // Keep only rows that still have stock to sell.
              const availableInventories = inventories.filter((i: any) => availableStockOf(i) > 0)
              
              const hasChoices = detail.items && detail.items.length > 1

              return (
              <div
                key={detail.id}
                style={{
                  padding: 16,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Slot (Qty: {qty})</span>
                </div>
                
                {hasChoices ? (
                  <select
                    value={itemId || ''}
                    onChange={(e) => {
                      const newId = Number(e.target.value)
                      setSelectedItems(prev => ({ ...prev, [detail.id]: newId }))
                      // Reset batch selection for this detail
                      setSelectedBatches(prev => ({ ...prev, [detail.id]: undefined }))
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 15,
                      fontWeight: 600,
                      background: 'var(--background)',
                      color: 'var(--foreground)',
                      marginBottom: 8,
                    }}
                  >
                    {detail.items.map((opt: any) => (
                      <option key={opt.id} value={opt.id}>
                        {withProductType(getProductUomName(opt.product_uom, opt.product_uom?.product?.name) || 'Unknown Product', opt.product_uom?.product?.type)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                    {getProductUomName(item.product_uom, item.product_uom?.product?.name) || 'Unknown Product'}
                  </div>
                )}
                
                <select
                  value={selectedBatches[detail.id]?.id || ''}
                  onChange={(e) => {
                    const val = e.target.value
                    const selectedInv = availableInventories.find((i: any) => i.id === Number(val))
                    setSelectedBatches((prev) => ({
                      ...prev,
                      [detail.id]: selectedInv || (val ? Number(val) : undefined),
                    }))
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 14,
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                  }}
                >
                  <option value="">-- Select Batch --</option>
                  {availableInventories.map((inv: any) => {
                    const batchCode = inv.product_uom_batch?.batch_code ?? inv.product_uom_batch?.code ?? 'N/A'
                    const exp = inv.product_uom_batch?.expiry_date ? formatExpiry(inv.product_uom_batch.expiry_date) : 'No Exp Date'
                    const stock = availableStockOf(inv)
                    const uomCode = inv.display_uom_code ? ` ${inv.display_uom_code}` : ''
                    return (
                      <option key={inv.id} value={inv.id}>
                        Batch: {batchCode} | {inv.product_uom_batch?.expiry_date ? `Exp on ${exp}` : exp} | Stock: {stock}{uomCode}
                      </option>
                    )
                  })}
                </select>
                {availableInventories.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--destructive)' }}>Out of stock</div>
                )}
              </div>
            )
          })
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent)',
              color: 'white',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  )
}
