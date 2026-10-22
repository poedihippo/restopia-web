'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Package, BookOpen, CheckCircle2, AlertTriangle, MapPin } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import { productionsService } from '@/services/productions.service'
import { recipesService } from '@/services/recipes.service'
import { productUomsService } from '@/services/product-uoms.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { companiesService } from '@/services/companies.service'
import { toastMutationApiError } from '@/utils/apiError'
import { getProductUomName, withProductType } from '@/utils/productUomName'
import { useAuth } from '@/hooks/useAuth'
import { useActiveBranchProductTypes, isProductTypeAllowed } from '@/hooks/useProductTypes'
import api from '@/hooks/useApi'

const GENERAL_OPTION = { value: 'GENERAL', label: 'Umum (GENERAL)' }

type MaterialLine = {
  product_uom_id: number
  name: string
  qty: number
  product_inventory_id: number
  stockLabel: string
  ok: boolean
}

export default function ConversionForm() {
  const router = useRouter()
  const qc = useQueryClient()
  const { user, hasPermission } = useAuth()
  const canCreate = hasPermission('production.create')
  const branchId = user?.branch?.id
  const activeProductTypes = useActiveBranchProductTypes()

  const today = new Date().toISOString().slice(0, 10)

  // ── Source dimension (where stock is taken from) ──────────────────────────
  // Backend validates material stock in THIS dimension. Without matching
  // owner/stage, create fails with "Insufficient stock in source dimension".
  const [sourceOwnerRef, setSourceOwnerRef] = useState('GENERAL')
  const [sourceStage, setSourceStage] = useState('GENERAL')
  const [sourceLocationRef] = useState('GENERAL')
  const [ownerSearch, setOwnerSearch] = useState('')
  const [ownerSearchDebounced, setOwnerSearchDebounced] = useState('')
  const [stageSearch, setStageSearch] = useState('')

  // Step state
  const [materialPuId, setMaterialPuId] = useState<number>(0)
  const [materialSearch, setMaterialSearch] = useState('')
  const [materialSearchDebounced, setMaterialSearchDebounced] = useState('')
  const [showRecipeModal, setShowRecipeModal] = useState(false)
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null)

  // Form state (filled after recipe pick)
  const [date, setDate] = useState(today)
  const [outputQty, setOutputQty] = useState<number>(0)
  const [materials, setMaterials] = useState<MaterialLine[]>([])
  const [outputLabel, setOutputLabel] = useState('')
  const [outputPuId, setOutputPuId] = useState<number>(0)
  const [recipeLabel, setRecipeLabel] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setMaterialSearchDebounced(materialSearch), 400)
    return () => clearTimeout(t)
  }, [materialSearch])

  useEffect(() => {
    const t = setTimeout(() => setOwnerSearchDebounced(ownerSearch), 400)
    return () => clearTimeout(t)
  }, [ownerSearch])

  // ── Owner + Stage options ─────────────────────────────────────────────────
  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['conversion-companies', ownerSearchDebounced],
    queryFn: () =>
      companiesService
        .list({ 'filter[search]': ownerSearchDebounced || undefined, per_page: 100 } as any)
        .then((r) => r.data),
  })
  const companies: { id: number; name: string }[] = (companiesData as any)?.data ?? []
  const ownerOptions = [
    GENERAL_OPTION,
    ...companies.map((c) => ({ value: String(c.id), label: c.name })),
  ]

  const { data: stagesData, isLoading: stagesLoading } = useQuery({
    queryKey: ['conversion-stages'],
    queryFn: () => api.get('/stages', { params: { per_page: 100 } }).then((r) => r.data),
  })
  const stages: { code: string; name: string }[] = (stagesData as any)?.data ?? []
  const stageOptions = useMemo(() => {
    const base = [
      GENERAL_OPTION,
      ...stages.map((s) => ({ value: s.code, label: s.name })),
    ]
    if (!stageSearch) return base
    const q = stageSearch.toLowerCase()
    return base.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
  }, [stages, stageSearch])

  const stageLabel = useMemo(() => {
    if (sourceStage === 'GENERAL') return 'Umum (GENERAL)'
    return stages.find((s) => s.code === sourceStage)?.name ?? sourceStage
  }, [stages, sourceStage])

  const ownerLabel = useMemo(() => {
    if (sourceOwnerRef === 'GENERAL') return 'Umum (GENERAL)'
    return companies.find((c) => String(c.id) === String(sourceOwnerRef))?.name ?? sourceOwnerRef
  }, [companies, sourceOwnerRef])

  // ── Material product-uoms ─────────────────────────────────────────────────
  const { data: materialPusData, isLoading: materialPusLoading } = useQuery({
    queryKey: ['conversion-material-pus', materialSearchDebounced, activeProductTypes],
    queryFn: () =>
      productUomsService
        .list({
          per_page: 100,
          include: 'product,uom',
          'filter[search]': materialSearchDebounced || undefined,
          'filter[is_active]': true,
          'filter[product_types]': activeProductTypes || 'raw,wip,supply',
        } as any)
        .then((r) => r.data),
  })
  const materialPus: any[] = ((materialPusData as any)?.data ?? []).filter((pu: any) =>
    isProductTypeAllowed(pu.product, activeProductTypes),
  )
  const materialOptions = materialPus.map((pu: any) => ({
    value: pu.id as number,
    label: withProductType(getProductUomName(pu, pu.product?.name) || `PU #${pu.id}`, pu.product?.type),
    sublabel: pu.uom?.name ?? '',
    description: pu.code ?? undefined,
  }))

  // ── Recipes that USE this material ────────────────────────────────────────
  const {
    data: recipesData,
    isLoading: recipesLoading,
    isFetching: recipesFetching,
  } = useQuery({
    queryKey: ['conversion-recipes-by-material', materialPuId],
    enabled: !!materialPuId && showRecipeModal,
    queryFn: () =>
      recipesService
        .list({
          per_page: 50,
          sort: '-is_default,-created_at',
          include: 'product_uom,recipe_materials,recipe_materials.product_uom,recipe_materials.product_uom.product',
          'filter[material_product_uom_id]': materialPuId,
        } as any)
        .then((r) => r.data),
  })

  const recipes: any[] = useMemo(() => {
    const raw = (recipesData as any)?.data ?? []
    if (!materialPuId) return []
    const filtered = raw.filter((r: any) => {
      const mats = r.recipe_materials ?? []
      if (mats.length === 0) return false
      return mats.some(
        (m: any) =>
          Number(m.product_uom_id) === Number(materialPuId) ||
          Number(m.product_uom?.id) === Number(materialPuId),
      )
    })
    return filtered.length > 0 ? filtered : raw
  }, [recipesData, materialPuId])

  // Auto-open recipe popup when material is chosen
  useEffect(() => {
    if (materialPuId && materialPuId > 0) {
      setShowRecipeModal(true)
      setSelectedRecipeId(null)
      setMaterials([])
      setOutputPuId(0)
      setOutputLabel('')
      setRecipeLabel('')
      setOutputQty(0)
    }
  }, [materialPuId])

  // ── Inventories filtered by SOURCE dimension ──────────────────────────────
  // Without owner_ref/stage/location_ref the picker can grab stock that does
  // not live in GENERAL — then create fails with insufficient stock.
  const materialPuIdsForInv = useMemo(
    () => Array.from(new Set(materials.map((m) => m.product_uom_id).filter(Boolean))),
    [materials],
  )
  const dimKey = `${sourceOwnerRef}|${sourceStage}|${sourceLocationRef}`
  const { data: invData, isFetching: invFetching } = useQuery({
    queryKey: [
      'conversion-inventories',
      branchId,
      materialPuIdsForInv.join(','),
      dimKey,
    ],
    enabled: !!branchId && materialPuIdsForInv.length > 0,
    queryFn: () =>
      productInventoriesService
        .list({
          per_page: 1000,
          'filter[branch_id]': branchId,
          'filter[status]': 'active',
          'filter[product_uom_ids]': materialPuIdsForInv.join(','),
          'filter[owner_ref]': sourceOwnerRef || undefined,
          'filter[stage]': sourceStage || undefined,
          'filter[location_ref]': sourceLocationRef || undefined,
          include: 'product_uom_batch,product_uom_batch.product_uom',
        } as any)
        .then((r) => r.data),
  })
  const inventories: any[] = (invData as any)?.data ?? []

  // Re-pick stock whenever inventories OR source dimension changes
  useEffect(() => {
    if (materials.length === 0) return
    setMaterials((prev) =>
      prev.map((m) => {
        const ts = (v?: string | null) => {
          if (!v) return Number.POSITIVE_INFINITY
          const t = new Date(v).getTime()
          return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
        }
        const matches = inventories
          .filter((inv: any) => {
            const puId =
              inv.product_uom_batch?.product_uom_id ??
              inv.product_uom?.id ??
              inv.product_uom_id
            return Number(puId) === Number(m.product_uom_id) && Number(inv.stock ?? 0) > 0
          })
          .sort((a: any, b: any) => {
            const ae = ts(a.product_uom_batch?.expiry_date ?? a.expiry_date)
            const be = ts(b.product_uom_batch?.expiry_date ?? b.expiry_date)
            if (ae !== be) return ae - be
            return ts(a.product_uom_batch?.created_at ?? a.created_at) -
              ts(b.product_uom_batch?.created_at ?? b.created_at)
          })
        if (matches.length === 0) {
          return {
            ...m,
            product_inventory_id: 0,
            stockLabel: `Tidak ada stok di ${stageLabel}`,
            ok: false,
          }
        }
        const pick = matches[0]
        const stock = Number(pick.stock ?? pick.qty ?? 0)
        const code = pick.product_uom_batch?.code ?? `Batch #${pick.product_uom_batch?.id ?? pick.id}`
        const invStage = pick.stage ?? pick.product_uom_batch?.stage
        return {
          ...m,
          product_inventory_id: pick.id,
          stockLabel: `${code} · stok ${stock}${invStage ? ` · ${invStage}` : ''}`,
          ok: true,
        }
      }),
    )
  }, [inventories, stageLabel])

  // ── Load recipe ───────────────────────────────────────────────────────────
  const handlePickRecipe = (recipe: any) => {
    const outPu = recipe.product_uom
    const outName = getProductUomName(outPu, outPu?.product?.name) || `Produk #${recipe.product_uom_id}`
    const mats = recipe.recipe_materials ?? []
    if (mats.length === 0) {
      toast.error('Resep ini tidak punya bahan')
      return
    }

    const recipeQty = Number(recipe.qty) || 1
    const lines: MaterialLine[] = mats.map((mat: any) => {
      const name = getProductUomName(mat.product_uom, mat.product_uom?.product?.name) || `Bahan #${mat.product_uom_id}`
      return {
        product_uom_id: Number(mat.product_uom_id),
        name,
        qty: Number(mat.qty) || 0,
        product_inventory_id: 0,
        stockLabel: 'Mencari stok…',
        ok: false,
      }
    })

    setSelectedRecipeId(recipe.id)
    setOutputPuId(Number(recipe.product_uom_id))
    setOutputLabel(outName)
    setOutputQty(recipeQty)
    setMaterials(lines)
    setRecipeLabel(
      `${outName} · hasil ${recipeQty}${recipe.is_default ? ' · resep utama' : ''}`,
    )
    setShowRecipeModal(false)
    toast.success(`Resep dimuat: ${outName}`)
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () => {
      const payload = {
        date,
        status: 'final' as const,
        source_owner_ref: sourceOwnerRef,
        source_stage: sourceStage,
        source_location_ref: sourceLocationRef || 'GENERAL',
        output_owner_ref: 'GENERAL',
        output_stage: 'GENERAL',
        output_location_ref: 'GENERAL',
        details: [
          {
            product_uom_id: outputPuId,
            qty: Number(outputQty) || 0,
            status: 'final' as const,
            materials: materials
              .filter((m) => m.product_inventory_id > 0)
              .map((m) => ({
                product_inventory_id: m.product_inventory_id,
                qty: m.qty,
                owner_ref: sourceOwnerRef,
                stage: sourceStage,
                location_ref: sourceLocationRef || 'GENERAL',
              })),
          },
        ],
      }
      return productionsService.create(payload as any)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['productions'] })
      toast.success('Conversion berhasil disimpan')
      router.push('/production')
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal menyimpan conversion'),
  })

  const missingStock = materials.filter((m) => !m.ok)
  const canSubmit =
    canCreate &&
    outputPuId > 0 &&
    Number(outputQty) > 0 &&
    materials.length > 0 &&
    missingStock.length === 0 &&
    !createMutation.isPending

  const handleSubmit = () => {
    if (!canCreate) {
      toast.error('Anda tidak punya akses membuat conversion')
      return
    }
    if (!outputPuId) {
      toast.error('Pilih bahan dulu, lalu pilih resep')
      return
    }
    if (!(Number(outputQty) > 0)) {
      toast.error('Jumlah hasil produksi harus lebih dari 0')
      return
    }
    if (materials.length === 0) {
      toast.error('Resep belum punya bahan')
      return
    }
    if (missingStock.length > 0) {
      toast.error(
        `Stok tidak ada di tahap "${stageLabel}". Ganti sumber stok di langkah 1, atau pilih bahan lain.`,
      )
      return
    }
    createMutation.mutate()
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 24,
    marginBottom: 20,
  }
  const stepBadge: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 99,
    background: 'var(--accent)',
    color: 'white',
    fontSize: 13,
    fontWeight: 700,
    marginRight: 10,
    flexShrink: 0,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--foreground)',
    display: 'block',
    marginBottom: 8,
  }
  const helpStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--foreground-muted)',
    marginBottom: 12,
  }
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 44,
    padding: '0 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 15,
    color: 'var(--foreground)',
    background: 'var(--surface-raised)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 720, margin: '0 auto', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => router.push('/production')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface)',
            color: 'var(--foreground-muted)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={14} />
          Kembali
        </button>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 700,
              margin: 0,
              color: 'var(--foreground)',
            }}
          >
            Conversion
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Ubah bahan menjadi produk jadi — ikuti langkah di bawah
          </p>
        </div>
      </div>

      {/* Step 1 — source stock + material */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <span style={stepBadge}>1</span>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>
            Sumber Stok &amp; Bahan
          </h2>
        </div>
        <p style={helpStyle}>
          Pilih dulu <strong>di mana stoknya diambil</strong> (pemilik + tahap),
          baru pilih bahan yang akan dikonversi.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginBottom: 16,
            padding: 14,
            borderRadius: 'var(--radius-md)',
            background: 'var(--info-bg)',
            border: '1px solid var(--info)',
          }}
        >
          <div>
            <label style={{ ...labelStyle, fontSize: 13 }}>Pemilik Stok</label>
            <SearchableSelect
              value={sourceOwnerRef}
              onChange={(v) => setSourceOwnerRef(String(v) || 'GENERAL')}
              options={ownerOptions}
              placeholder="Pemilik..."
              searchPlaceholder="Cari perusahaan..."
              loading={companiesLoading}
              onSearchChange={setOwnerSearch}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, fontSize: 13 }}>
              Tahap (Stage) <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <SearchableSelect
              value={sourceStage}
              onChange={(v) => setSourceStage(String(v) || 'GENERAL')}
              options={stageOptions}
              placeholder="Tahap..."
              searchPlaceholder="Cari tahap..."
              loading={stagesLoading}
              onSearchChange={setStageSearch}
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--foreground)',
            fontWeight: 600,
          }}
        >
          <MapPin size={14} color="var(--accent)" />
          Stok diambil dari: <span style={{ color: 'var(--accent)' }}>{ownerLabel}</span>
          {' · '}
          <span style={{ color: 'var(--accent)' }}>{stageLabel}</span>
        </div>

        <label style={labelStyle}>Pilih Bahan</label>
        <SearchableSelect
          value={materialPuId}
          onChange={(v) => setMaterialPuId(Number(v) || 0)}
          options={materialOptions}
          placeholder="Cari bahan / produk..."
          searchPlaceholder="Ketik nama bahan..."
          loading={materialPusLoading}
          onSearchChange={setMaterialSearch}
        />
      </div>

      {/* Step 2 — recipe */}
      <div style={{ ...card, opacity: materialPuId ? 1 : 0.55 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <span style={stepBadge}>2</span>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>
            Pilih Resep
          </h2>
        </div>
        <p style={helpStyle}>
          Resep yang memakai bahan tersebut. Klik untuk memuat bahan &amp; hasil produksi.
        </p>
        {selectedRecipeId ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--success-bg)',
              color: 'var(--success)',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={18} />
            <span>{recipeLabel}</span>
            <button
              type="button"
              onClick={() => setShowRecipeModal(true)}
              style={{
                marginLeft: 'auto',
                padding: '6px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface)',
                color: 'var(--foreground)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Ganti resep
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!materialPuId}
            onClick={() => setShowRecipeModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '14px 16px',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--background)',
              color: materialPuId ? 'var(--accent)' : 'var(--foreground-subtle)',
              fontSize: 14,
              fontWeight: 600,
              cursor: materialPuId ? 'pointer' : 'not-allowed',
            }}
          >
            <BookOpen size={16} />
            {materialPuId ? 'Buka daftar resep' : 'Pilih bahan dulu di langkah 1'}
          </button>
        )}
      </div>

      {/* Step 3 — review & save */}
      <div style={{ ...card, opacity: selectedRecipeId ? 1 : 0.55 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <span style={stepBadge}>3</span>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>
            Periksa &amp; Simpan
          </h2>
        </div>
        <p style={helpStyle}>
          Pastikan jumlah hasil dan bahan sudah benar, lalu tekan Simpan.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--background)',
            border: '1px solid var(--border)',
            fontSize: 13,
            color: 'var(--foreground-muted)',
          }}
        >
          <MapPin size={14} />
          Sumber stok: <strong style={{ color: 'var(--foreground)' }}>{ownerLabel}</strong>
          {' / '}
          <strong style={{ color: 'var(--foreground)' }}>{stageLabel}</strong>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Tanggal</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>
              Jumlah Hasil <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <input
              type="number"
              min={0.001}
              step={0.001}
              value={outputQty || ''}
              onChange={(e) => setOutputQty(Number(e.target.value) || 0)}
              disabled={!selectedRecipeId}
              style={inputStyle}
            />
          </div>
        </div>

        {selectedRecipeId && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--foreground-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Produk jadi
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-light-bg)',
                color: 'var(--accent)',
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              <Package size={18} />
              {outputLabel}
            </div>
          </div>
        )}

        {selectedRecipeId && (
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--foreground-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Bahan-bahan
            </div>
            {invFetching && materials.some((m) => m.stockLabel === 'Mencari stok…') && (
              <div style={{ fontSize: 13, color: 'var(--foreground-muted)', marginBottom: 8 }}>
                Mencari stok di {stageLabel}...
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {materials.map((m, idx) => (
                <div
                  key={`${m.product_uom_id}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    border: `1px solid ${m.ok ? 'var(--border)' : 'var(--destructive)'}`,
                    borderRadius: 'var(--radius-md)',
                    background: m.ok ? 'var(--surface-raised)' : 'var(--destructive-bg)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                      {m.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: m.ok ? 'var(--foreground-muted)' : 'var(--destructive)',
                        marginTop: 2,
                      }}
                    >
                      {m.stockLabel}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>Dibutuhkan</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>
                      {m.qty}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedRecipeId && missingStock.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              marginTop: 16,
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--warning-bg)',
              color: 'var(--warning)',
              fontSize: 13,
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Stok tidak ada di tahap <strong>{stageLabel}</strong> untuk:{' '}
              {missingStock.map((m) => m.name).join(', ')}.
              <br />
              Silakan ganti <strong>Pemilik / Tahap</strong> di langkah 1, atau pilih bahan lain.
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            width: '100%',
            height: 52,
            marginTop: 20,
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: canSubmit ? 'var(--accent)' : 'var(--foreground-subtle)',
            color: 'white',
            fontSize: 16,
            fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {createMutation.isPending && <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />}
          {createMutation.isPending ? 'Menyimpan...' : 'Simpan Conversion'}
        </button>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* Recipe modal */}
      {showRecipeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setShowRecipeModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              maxHeight: '80vh',
              overflow: 'auto',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>
                Resep untuk bahan ini
              </h3>
              <button
                type="button"
                onClick={() => setShowRecipeModal(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: 22,
                  color: 'var(--foreground-muted)',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', marginBottom: 16 }}>
              Pilih satu resep yang ingin dipakai untuk conversion.
            </p>

            {recipesLoading || recipesFetching ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 24, color: 'var(--foreground-muted)' }}>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                Memuat resep...
              </div>
            ) : recipes.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 14 }}>
                Tidak ada resep yang memakai bahan ini.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recipes.map((r: any) => {
                  const outName = getProductUomName(r.product_uom, r.product_uom?.product?.name) || `Produk #${r.product_uom_id}`
                  const matCount = (r.recipe_materials ?? []).length
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handlePickRecipe(r)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        width: '100%',
                        padding: '14px 16px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface-raised)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)' }}>
                          {outName}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}>
                          Hasil {r.qty ?? 1} · {matCount} bahan
                          {r.is_default ? ' · resep utama' : ''}
                        </div>
                      </div>
                      {r.is_default && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 99,
                            background: 'var(--accent-light-bg)',
                            color: 'var(--accent)',
                            flexShrink: 0,
                          }}
                        >
                          UTAMA
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
