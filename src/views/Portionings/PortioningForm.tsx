'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, ArrowLeft, Loader2, Save, Eye } from 'lucide-react'
import api from '@/hooks/useApi'
import { useAuth } from '@/hooks/useAuth'
import { portioningsService } from '@/services/portionings.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { companiesService } from '@/services/companies.service'
import { parseApiError, toastMutationApiError } from '@/utils/apiError'
import {
  availableStockOf,
  cutableStockOf,
  isCutableSourceInventoryRow,
  isDeferredInventoryRow,
} from '@/utils/inventoryStock'
import { getProductUomName } from '@/utils/productUomName'
import SearchableSelect from '@/components/SearchableSelect'
import { useFormKeyboardNavigation } from '@/hooks/useFormKeyboardNavigation'
import type { PortioningRequest } from '@/types/api'

const GENERAL_OWNER_OPTION = { value: 'GENERAL', label: 'Umum (GENERAL)' }
// Location pickers are hidden on this form; the backend always gets GENERAL.
const LOCATION_GENERAL = 'GENERAL'

// ── Schemas ──────────────────────────────────────────────────────────────────

const detailSchema = z.object({
  base_product_inventory_id: z.coerce.number().min(1, 'Base cake wajib dipilih'),
  base_qty: z.coerce.number().gt(0, 'Qty base harus lebih dari 0'),
  product_uom_id: z.coerce.number().min(1, 'SKU hasil wajib dipilih'),
  batch_code: z.string().optional(),
  expiry_date: z.string().optional(),
})

const schema = z.object({
  date: z.string().min(1, 'Tanggal wajib diisi'),
  status: z.enum(['pending', 'final']),
  description: z.string().optional(),
  source_owner_ref: z.string().min(1, 'Owner sumber wajib diisi'),
  source_stage: z.string().min(1, 'Stage sumber wajib diisi'),
  output_owner_ref: z.string().min(1, 'Owner output wajib diisi'),
  output_stage: z.string().min(1, 'Stage output wajib diisi'),
  details: z.array(detailSchema).min(1, 'Minimal satu potongan'),
})

type FormValues = z.infer<typeof schema>
type DetailValues = FormValues['details'][number]

// ── Shared styles ─────────────────────────────────────────────────────────────

const fieldInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 12,
  color: 'var(--foreground)',
  background: 'var(--surface-raised)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--foreground)',
  marginBottom: 2,
  display: 'block',
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'visible',
  boxShadow: 'var(--shadow-sm)',
}

const cardHeaderStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--background)',
  borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
}

const errorTextStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--destructive)',
  marginTop: 3,
}

const roStyle: React.CSSProperties = {
  ...fieldInputStyle,
  background: 'var(--background)',
  borderStyle: 'dashed',
  color: 'var(--foreground-muted)',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Local calendar date (not UTC) so early-morning WIB entries don't default to yesterday. */
function todayLocalISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const emptyDetail = (): DetailValues => ({
  base_product_inventory_id: 0,
  base_qty: 1,
  product_uom_id: 0,
  batch_code: '',
  expiry_date: '',
})

/** Signature of the raw form state; `status` is excluded because the save buttons override it. */
const formSignature = (values: unknown): string =>
  JSON.stringify({ ...(values as object), status: undefined })

const formatNumber = (v: unknown, maxFractionDigits = 2): string => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('id-ID', { maximumFractionDigits: maxFractionDigits }) : '—'
}

/**
 * A row is picked by its cutable stock (not `stock`, which is 0 on a deferred
 * anchor) when its product is a cutable source or it already holds cutable stock.
 */
const isCutableRow = (inv: any): boolean =>
  isCutableSourceInventoryRow(inv) || Number(inv?.cutable_stock ?? 0) > 0

/**
 * A deferred SKU's anchor row holds no physical stock (always 0); its units live
 * in sellable lots. Unless the product is a cutable source it cannot be a base.
 */
const isSellableOnlyRow = (inv: any): boolean => isDeferredInventoryRow(inv) && !isCutableRow(inv)

// ── Error wording ────────────────────────────────────────────────────────────
// The API answers with literal English sentences. Rewrite the ones operators
// kept asking about into plain Indonesian instead of leaking the raw text.
const humanizePortioningError = (msg: string): string => {
  const deferred = msg.match(
    /product\s+(.+?)\s+is not a deferred final product,?\s+so it cannot be portioned/i,
  )
  if (deferred) {
    return `Produk "${deferred[1].trim()}" tidak bisa dipotong karena bukan produk final ber-flag Deferred — aktifkan Deferred pada produk tersebut terlebih dahulu.`
  }
  return msg
}

/** Deep-rewrites every string inside an axios error payload. */
const humanizeApiError = (err: any): any => {
  const data = err?.response?.data
  if (!data) return err
  const rewrite = (v: any): any => {
    if (typeof v === 'string') return humanizePortioningError(v)
    if (Array.isArray(v)) return v.map(rewrite)
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rewrite(x)]))
    }
    return v
  }
  return { ...err, response: { ...err.response, data: rewrite(data) } }
}

// ── Preview response (field paths are assumptions — confirm against the live API) ──

interface PreviewDetail {
  fractionBase: unknown
  fractionSource: string | null
  warnings: string[]
  shortfalls: string[]
}

interface PreviewResult {
  details: PreviewDetail[]
  warnings: string[]
  shortfalls: string[]
}

function issueText(x: unknown): string {
  if (x == null) return ''
  if (typeof x === 'string') return x
  if (typeof x === 'number') return x.toLocaleString('id-ID')
  if (typeof x === 'object') {
    const o = x as Record<string, unknown>
    if (typeof o.message === 'string') return o.message
    return Object.entries(o)
      .filter(([, v]) => v != null)
      .map(([k, v]) => {
        const val =
          typeof v === 'number' ? v.toLocaleString('id-ID') : typeof v === 'object' ? JSON.stringify(v) : String(v)
        return `${k}: ${val}`
      })
      .join(' · ')
  }
  return String(x)
}

const issueList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : v == null ? [] : [v]).map(issueText).filter(Boolean)

function normalizePreview(resp: any): PreviewResult {
  const root = resp?.data ?? resp
  const rawDetails: any[] = Array.isArray(root?.details) ? root.details : []
  return {
    details: rawDetails.map((d) => ({
      fractionBase: d?.fraction_base ?? d?.fraction?.base ?? null,
      fractionSource: d?.fraction_source ?? d?.fraction?.source ?? null,
      warnings: issueList(d?.warnings),
      shortfalls: issueList(d?.shortfalls),
    })),
    warnings: issueList(root?.warnings),
    shortfalls: issueList(root?.shortfalls),
  }
}

const hasAnyShortfall = (r: PreviewResult | null | undefined): boolean =>
  !!r && (r.shortfalls.length > 0 || r.details.some((d) => d.shortfalls.length > 0))

interface PreviewState {
  sig: string
  labels: string[]
  result: PreviewResult
}

function IssueNotes({ items, tone }: { items: string[]; tone: 'warning' | 'destructive' }) {
  if (items.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((text, i) => (
        <div
          key={i}
          style={{
            padding: '6px 10px',
            fontSize: 12,
            borderRadius: 'var(--radius-md)',
            border: `1px solid var(--${tone})`,
            background: `var(--${tone}-bg)`,
            color: `var(--${tone})`,
          }}
        >
          {text}
        </div>
      ))}
    </div>
  )
}

function PreviewPanel({ preview, stale }: { preview: PreviewState; stale: boolean }) {
  const { result, labels } = preview
  const empty = result.details.length === 0 && result.warnings.length === 0 && result.shortfalls.length === 0
  return (
    <div style={cardStyle}>
      <div
        style={{
          ...cardHeaderStyle,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={sectionHeaderStyle}>Hasil Preview</span>
        {stale && (
          <span style={{ fontSize: 11, color: 'var(--warning)' }}>
            Form berubah sejak preview — jalankan Preview ulang
          </span>
        )}
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <IssueNotes items={result.warnings} tone="warning" />
        <IssueNotes items={result.shortfalls} tone="destructive" />
        {empty && (
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
            Preview tidak mengembalikan detail.
          </span>
        )}
        {result.details.map((d, i) => (
          <div
            key={i}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--background)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>
                #{i + 1} {labels[i] ?? ''}
              </span>
              {d.fractionSource && (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    background: d.fractionSource === 'cuts' ? 'var(--info-bg)' : 'var(--accent-light-bg)',
                    color: d.fractionSource === 'cuts' ? 'var(--info)' : 'var(--accent)',
                  }}
                >
                  {d.fractionSource}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
              Fraksi base:{' '}
              <strong style={{ color: 'var(--foreground)' }}>{formatNumber(d.fractionBase, 6)}</strong>
            </div>
            <IssueNotes items={d.warnings} tone="warning" />
            <IssueNotes items={d.shortfalls} tone="destructive" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PortioningForm() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const activeBranchId = user?.branch?.id

  const [preview, setPreview] = useState<PreviewState | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      date: todayLocalISO(),
      status: 'final',
      description: '',
      source_owner_ref: 'GENERAL',
      source_stage: 'GENERAL',
      output_owner_ref: 'GENERAL',
      output_stage: 'GENERAL',
      details: [emptyDetail()],
    },
  })

  const { fields: detailFields, append: appendDetail, remove: removeDetail } =
    useFieldArray({ control, name: 'details' })

  const handleAddDetail = () => appendDetail(emptyDetail())

  useFormKeyboardNavigation({ onAddItem: handleAddDetail })

  const watchSourceOwnerRef = watch('source_owner_ref')
  const watchSourceStage = watch('source_stage')
  const watchedValues = watch()

  // Cut ratio cache: fraction_base (base consumed per 1 hasil) per base-inventory × result-SKU,
  // probed through the existing /portionings/preview endpoint.
  const [ratios, setRatios] = useState<Record<string, number>>({})
  // Why a base × SKU pair could not be probed (e.g. the SKU is not a cut of that base).
  const [ratioErrors, setRatioErrors] = useState<Record<string, string>>({})
  const ratioKey = (invId: number, puId: number) => `${invId}:${puId}`
  /** fraction_base of one result unit out of the base row, asked of the backend (throws if it refuses the pair). */
  const previewFraction = async (invId: number, puId: number): Promise<number> => {
    const v = getValues()
    const resp = await portioningsService
      .preview({
        date: v.date,
        status: 'pending',
        source_owner_ref: v.source_owner_ref,
        source_stage: v.source_stage,
        source_location_ref: LOCATION_GENERAL,
        output_owner_ref: v.output_owner_ref,
        output_stage: v.output_stage,
        output_location_ref: LOCATION_GENERAL,
        details: [
          {
            product_uom_id: puId,
            qty: 1,
            base_product_inventory_id: invId,
            status: 'pending',
            owner_ref: v.output_owner_ref || null,
            stage: v.output_stage || null,
            location_ref: LOCATION_GENERAL,
            materials: [],
          },
        ],
      } as any)
      .then((r) => r.data)
    const n = Number(normalizePreview(resp).details[0]?.fractionBase)
    if (!Number.isFinite(n) || n <= 0) throw new Error('Rasio potong tidak ditemukan')
    return n
  }
  const probeRatio = (invId: number, puId: number) => {
    if (!invId || !puId || ratios[ratioKey(invId, puId)] != null) return
    previewFraction(invId, puId)
      .then((n) => {
        setRatios((p) => ({ ...p, [ratioKey(invId, puId)]: n }))
        setRatioErrors((p) => {
          const { [ratioKey(invId, puId)]: _cleared, ...rest } = p
          return rest
        })
      })
      .catch((err) => {
        setRatioErrors((p) => ({ ...p, [ratioKey(invId, puId)]: parseApiError(humanizeApiError(err)) }))
      })
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  const [companySearch, setCompanySearch] = useState('')
  const [debouncedCompanySearch, setDebouncedCompanySearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCompanySearch(companySearch), 400)
    return () => clearTimeout(t)
  }, [companySearch])

  // Dimension pickers: owner (company) + stage
  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies-all', debouncedCompanySearch],
    queryFn: () =>
      companiesService
        .list({ 'filter[search]': debouncedCompanySearch || undefined, per_page: 100 } as any)
        .then((r) => r.data),
  })
  const companies: { id: number; name: string }[] = (companiesData as any)?.data ?? []
  const companyOptions = [
    GENERAL_OWNER_OPTION,
    ...companies.map((c) => ({ value: String(c.id), label: c.name })),
  ]

  const { data: stagesData, isLoading: stagesLoading } = useQuery({
    queryKey: ['stages-all'],
    queryFn: () => api.get('/stages', { params: { per_page: 100 } }).then((r) => r.data),
  })
  const stages: { code: string; name: string }[] = (stagesData as any)?.data ?? []
  const stageOptions = stages.map((s) => ({ value: s.code, label: s.name }))

  // Default Output Ke stage to 'finished' once stages load (fresh form only).
  const didDefaultOutputStage = useRef(false)
  useEffect(() => {
    if (didDefaultOutputStage.current || stages.length === 0) return
    didDefaultOutputStage.current = true
    if (stages.some((s) => s.code === 'finished')) {
      setValue('output_stage', 'finished')
    }
  }, [stages, setValue])

  // Base-cake picker: this branch's inventory rows under the "Konsumsi Dari" dimension.
  const { data: inventoriesData, isLoading: inventoriesLoading } = useQuery({
    queryKey: ['product-inventories-all', 'portioning', activeBranchId, watchSourceOwnerRef, watchSourceStage],
    enabled: !!activeBranchId,
    queryFn: () =>
      productInventoriesService
        .list({
          per_page: 1000,
          include:
            'branch,product_uom_batch,product_uom_batch.product_uom,product_uom_batch.product_uom.product,product_uom_batch.product_uom.uom',
          'filter[branch_id]': activeBranchId,
          'filter[owner_refs]': watchSourceOwnerRef || undefined,
          'filter[stages]': watchSourceStage || undefined,
        } as any)
        .then((r) => r.data),
  })
  const inventories: any[] = (inventoriesData as any)?.data ?? []
  const inventoryOptions = inventories.map((inv: any) => {
    const pu = inv?.product_uom_batch?.product_uom ?? inv?.product_uom
    const stockQty = inv.display_qty ?? inv.stock ?? 0
    const expiry = inv?.product_uom_batch?.expiry_date ?? inv?.expiry_date
    // Cutable stock is in the base uom.
    const cutableUnit = inv.base_uom_code ?? inv.display_uom_code ?? pu?.uom?.code
    return {
      value: Number(inv.id),
      label: [getProductUomName(pu, inv.code), pu?.uom?.code].filter(Boolean).join(' · '),
      sublabel: [
        inv.code ? `SKU: ${inv.code}` : '',
        isCutableRow(inv)
          ? `Cutable: ${formatNumber(cutableStockOf(inv))}${cutableUnit ? ` ${cutableUnit}` : ''}`
          : isSellableOnlyRow(inv)
            ? `Sellable: ${formatNumber(inv.sellable_qty ?? 0)} (bukan Cutable Source)`
            : `Stok: ${formatNumber(stockQty)}${inv.display_uom_code ? ` ${inv.display_uom_code}` : ''}`,
        expiry ? `Exp: ${String(expiry).slice(0, 10)}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    }
  })
  const invStockById = new Map<number, string>()
  // What a base row can still give to a cut, in the base unit "Qty base" is
  // entered in: cutable stock for cutable rows, available stock otherwise.
  // `kind` says which figure that is: cutable stock, the sellable lots of a deferred
  // SKU that is not a cutable source (it cannot be cut), or plain stock.
  const invAvailById = new Map<
    number,
    { qty: number; unit: string; cutable: boolean; kind: 'cutable' | 'sellable' | 'stock'; sellable: number }
  >()
  for (const inv of inventories) {
    const pu = inv?.product_uom_batch?.product_uom ?? inv?.product_uom
    const stockQty = inv.display_qty ?? inv.stock ?? 0
    const cutable = isCutableRow(inv)
    const unit: string = inv.base_uom_code ?? inv.display_uom_code ?? pu?.uom?.code ?? ''
    const sellable = Number(inv?.sellable_qty ?? 0)
    if (cutable) {
      invStockById.set(Number(inv.id), `${formatNumber(cutableStockOf(inv))}${unit ? ` ${unit}` : ''}`)
      invAvailById.set(Number(inv.id), { qty: cutableStockOf(inv), unit, cutable, kind: 'cutable', sellable })
      continue
    }
    if (isSellableOnlyRow(inv)) {
      invStockById.set(Number(inv.id), `${formatNumber(sellable)}${unit ? ` ${unit}` : ''}`)
      invAvailById.set(Number(inv.id), { qty: 0, unit, cutable, kind: 'sellable', sellable })
      continue
    }
    invStockById.set(
      Number(inv.id),
      `${formatNumber(stockQty)}${inv.display_uom_code ? ` ${inv.display_uom_code}` : pu?.uom?.code ? ` ${pu.uom.code}` : ''}`,
    )
    invAvailById.set(Number(inv.id), {
      qty: inv.available_base_stock != null ? Number(inv.available_base_stock) : availableStockOf(inv),
      unit,
      cutable,
      kind: 'stock',
      sellable,
    })
  }

  // Base cake → its product-UOM, used to resolve which result SKUs can be cut
  // from it (see /recipes?filter[material_product_uom_id]=...). Every documented
  // path to that id is checked, because a missing include silently empties the
  // SKU- hasil picker.
  const invProductUomById = new Map<number, number>()
  for (const inv of inventories) {
    const puId = Number(
      inv?.product_uom_batch?.product_uom?.id ??
        inv?.product_uom_batch?.product_uom_id ??
        inv?.product_uom?.id ??
        inv?.product_uom_id ??
        0,
    )
    if (puId) invProductUomById.set(Number(inv.id), puId)
  }

  // Deferred final SKUs — the only valid "SKU hasil" for a portioning. The
  // backend rejects anything else with
  // "product X is not a deferred final product, so it cannot be portioned".
  // Read from /product-uoms rather than /product-inventories because a
  // deferred product can legitimately have no stock row yet, and that must
  // not hide it from the picker.
  const { data: deferredUomsData, isLoading: deferredUomsLoading } = useQuery({
    queryKey: ['portioning-deferred-final-uoms'],
    staleTime: 60 * 1000,
    queryFn: () =>
      api
        .get('/product-uoms', {
          params: { per_page: 500, include: 'product,uom', 'filter[product_types]': 'final' },
        })
        .then((r) => r.data),
  })
  const deferredPuIds = new Set<number>(
    ((deferredUomsData as any)?.data ?? [])
      .filter((pu: any) => pu?.product?.is_deferred === true)
      .map((pu: any) => Number(pu.id))
      .filter((id: number) => id > 0),
  )

  // Deferred final SKUs as picker entries (label + product), used to name the
  // cut targets of a cutable source below.
  const deferredFinalOptions: { value: number; productId: number; label: string; sublabel?: string }[] = (
    ((deferredUomsData as any)?.data ?? []) as any[]
  )
    .filter((pu) => pu?.product?.is_deferred === true && Number(pu?.id) > 0)
    .map((pu) => ({
      value: Number(pu.id),
      productId: Number(pu?.product?.id ?? pu?.product_id ?? 0),
      label: [getProductUomName(pu), pu?.uom?.code].filter(Boolean).join(' · '),
      sublabel: pu?.code ? `SKU: ${pu.code}` : undefined,
    }))
  const inventoryById = new Map<number, any>(inventories.map((inv: any) => [Number(inv.id), inv]))
  const deferredOptionByPu = new Map(deferredFinalOptions.map((o) => [o.value, o]))

  // Result-SKU options per selected base cake: recipes whose materials contain
  // that base are exactly the SKUs the backend can portion out of it.
  // NOTE: /recipes requires the `recipe.read` permission — failures are surfaced
  // in the row instead of being silently swallowed.
  const watchedDetails: DetailValues[] = watchedValues.details ?? []
  const basePuIds = Array.from(
    new Set(
      watchedDetails
        .map((d) => invProductUomById.get(Number(d?.base_product_inventory_id)) ?? 0)
        .filter((id) => id > 0),
    ),
  )

  const cutQueries = useQueries({
    queries: basePuIds.map((id) => ({
      queryKey: ['portioning-cut-recipes', id],
      // Short stale time: re-selecting a base cake must hit the API again
      // instead of being served from a long-lived cache.
      staleTime: 30 * 1000,
      retry: 1,
      queryFn: () =>
        api
          .get('/recipes', {
            params: {
              per_page: 200,
              include: 'product_uom,recipe_materials',
              'filter[material_product_uom_id]': id,
            },
          })
          .then((r) => r.data),
    })),
  })

  // A cutable source (e.g. a Loaf) is rarely a material of its smaller cuts, so
  // recipes alone cannot say what it can be cut into. Take what it is itself made
  // from (its recipe's production materials, e.g. the 20x40), look at the deferred
  // SKUs whose recipes use the same material, and keep only the ones the backend
  // accepts for this exact base row (/portionings/preview) — the same check a save
  // runs, so the list never offers a pair that would be refused.
  const cutableBaseInvIds = Array.from(
    new Set(
      watchedDetails
        .map((d) => Number(d?.base_product_inventory_id))
        .filter((id) => id > 0 && isCutableSourceInventoryRow(inventoryById.get(id))),
    ),
  )
  const cutTargetQueries = useQueries({
    queries: cutableBaseInvIds.map((invId) => ({
      queryKey: ['portioning-cut-targets', activeBranchId, invId],
      enabled: deferredPuIds.size > 0,
      staleTime: 30 * 1000,
      retry: 0,
      queryFn: async (): Promise<{ puId: number; fraction: number }[]> => {
        const basePuId = invProductUomById.get(invId) ?? 0
        const baseProductId = deferredOptionByPu.get(basePuId)?.productId ?? 0
        const own: any = await api
          .get('/recipes', { params: { per_page: 50, include: 'recipe_materials', 'filter[product_uom_id]': basePuId } })
          .then((r) => r.data)
        const materials = new Set<number>()
        for (const rec of (own?.data ?? []) as any[]) {
          for (const m of (rec?.recipe_materials ?? []) as any[]) {
            if (m?.deduction_type === 'deduct_on_sold' || m?.deduction_type === 'deduct_on_sellable_settlement') continue
            if (Number(m?.product_uom_id) > 0) materials.add(Number(m.product_uom_id))
          }
        }
        const candidates = new Set<number>()
        for (const materialPuId of materials) {
          const used: any = await api
            .get('/recipes', {
              params: { per_page: 200, include: 'product_uom', 'filter[material_product_uom_id]': materialPuId },
            })
            .then((r) => r.data)
          for (const rec of (used?.data ?? []) as any[]) {
            const puId = Number(rec?.product_uom_id ?? rec?.product_uom?.id ?? 0)
            if (!puId || puId === basePuId || !deferredPuIds.has(puId)) continue
            if (baseProductId && deferredOptionByPu.get(puId)?.productId === baseProductId) continue
            candidates.add(puId)
          }
        }
        const accepted = await Promise.all(
          Array.from(candidates).map(async (puId) => {
            try {
              return { puId, fraction: await previewFraction(invId, puId) }
            } catch {
              return null
            }
          }),
        )
        return accepted.filter((x): x is { puId: number; fraction: number } => x != null)
      },
    })),
  })
  const cutTargetsByInv = new Map<number, { options: { value: number; label: string; sublabel?: string }[]; loading: boolean; error?: string }>()
  cutTargetQueries.forEach((q, i) => {
    const options = ((q.data ?? []) as { puId: number; fraction: number }[])
      .map(({ puId, fraction }) => {
        const o = deferredOptionByPu.get(puId)
        return {
          value: puId,
          label: o?.label ?? `SKU #${puId}`,
          sublabel: [o?.sublabel, `Base: ${formatNumber(fraction, 4)} per hasil`].filter(Boolean).join(' · '),
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
    cutTargetsByInv.set(cutableBaseInvIds[i], {
      options,
      loading: q.isLoading || (q.isFetching && !q.data),
      error: q.isError ? parseApiError(q.error) : undefined,
    })
  })
  // The probe already produced each pair's ratio: seed the ratio cache with it, so
  // picking one of these SKUs needs no further preview call.
  const cutTargetSig = cutTargetQueries.map((q) => JSON.stringify(q.data ?? null)).join('|')
  useEffect(() => {
    const seeded: Record<string, number> = {}
    cutTargetQueries.forEach((q, i) => {
      for (const t of (q.data ?? []) as { puId: number; fraction: number }[]) {
        seeded[ratioKey(cutableBaseInvIds[i], t.puId)] = t.fraction
      }
    })
    setRatios((prev) => {
      const next = { ...prev }
      let changed = false
      for (const [k, v] of Object.entries(seeded)) {
        if (next[k] !== v) {
          next[k] = v
          changed = true
        }
      }
      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutTargetSig])

  const cutOptionsByBase = new Map<number, { value: number; label: string; sublabel?: string }[]>()
  const cutLoadingByBase = new Map<number, boolean>()
  const cutErrorByBase = new Map<number, string>()
  // Set when a base cake has recipes, but none of their results are deferred
  // final SKUs — worth saying out loud, because that is exactly the case the
  // backend refuses to portion.
  const cutAllNonDeferredByBase = new Set<number>()
  cutQueries.forEach((q, i) => {
    const basePuId = basePuIds[i]
    cutLoadingByBase.set(basePuId, q.isLoading)
    if (q.isError) cutErrorByBase.set(basePuId, parseApiError(q.error))
    const seen = new Set<number>()
    const opts: { value: number; label: string; sublabel?: string }[] = []
    let sawFinalRecipe = false
    for (const rec of ((q.data as any)?.data ?? []) as any[]) {
      const pu = rec?.product_uom
      const puId = Number(pu?.id ?? rec?.product_uom_id ?? 0)
      if (!puId || seen.has(puId)) continue
      // Only a final product is a valid cut result.
      if (pu?.product?.type && pu.product.type !== 'final') continue
      sawFinalRecipe = true
      seen.add(puId)
      // …and only a DEFERRED final one: portioning any other product is
      // rejected by the backend.
      if (!deferredPuIds.has(puId)) continue
      // recipe_materials carries how much of the chosen base one result eats.
      const materials: any[] = rec?.recipe_materials ?? []
      const baseMaterial = materials.find((m) => Number(m?.product_uom_id) === basePuId)
      const recipeQty = Number(rec?.qty ?? 0) || 1
      const basePerResult = baseMaterial ? Number(baseMaterial.qty) / recipeQty : NaN
      opts.push({
        value: puId,
        label: [getProductUomName(pu), pu?.uom?.code].filter(Boolean).join(' · '),
        sublabel:
          [
            pu?.code ? `SKU: ${pu.code}` : '',
            Number.isFinite(basePerResult) ? `Base: ${formatNumber(basePerResult)} per hasil` : '',
          ]
            .filter(Boolean)
            .join(' · ') || undefined,
      })
    }
    if (sawFinalRecipe && opts.length === 0) cutAllNonDeferredByBase.add(basePuId)
    cutOptionsByBase.set(basePuId, opts)
  })

  /** Result-SKU options + loading/error state for one row, given its base cake. */
  const cutOptionsFor = (invId: number) => {
    const basePuId = invProductUomById.get(Number(invId)) ?? 0
    if (basePuId <= 0) {
      // The inventory list may not have loaded yet — don't claim "no stock".
      return { basePuId, options: [], loading: inventoriesLoading || deferredUomsLoading, error: undefined, allNonDeferred: false }
    }
    const recipeOptions = cutOptionsByBase.get(basePuId) ?? []
    const seen = new Set(recipeOptions.map((o) => o.value))
    const targets = cutTargetsByInv.get(Number(invId))
    return {
      basePuId,
      options: [...recipeOptions, ...(targets?.options ?? []).filter((o) => !seen.has(o.value))],
      loading: (cutLoadingByBase.get(basePuId) ?? false) || deferredUomsLoading || (targets?.loading ?? false),
      error: cutErrorByBase.get(basePuId) ?? targets?.error,
      allNonDeferred: cutAllNonDeferredByBase.has(basePuId),
    }
  }

  const cutLabelFor = (invId: unknown, puId: unknown) =>
    cutOptionsFor(Number(invId)).options.find((o) => o.value === Number(puId))?.label ??
    `SKU #${puId}`

  // To-side stock: this branch's DEFERRED final inventories, summed per
  // product-UOM. `filter[is_deferred]=true` keeps this aligned with the SKU
  // hasil picker — the only products that can be portioned at all — and
  // `availableStockOf` reads sellable_qty for those rows rather than the
  // produced-but-unsellable `stock`.
  const { data: finalInvData } = useQuery({
    queryKey: ['portioning-final-inventories', activeBranchId],
    enabled: !!activeBranchId,
    queryFn: () =>
      productInventoriesService
        .list({
          per_page: 1000,
          'filter[branch_id]': activeBranchId,
          'filter[product_type]': 'final',
          'filter[is_deferred]': true,
          include: 'product_uom_batch,product_uom_batch.product_uom,product_uom_batch.product_uom.product',
        } as any)
        .then((r) => r.data),
  })
  const finalStockById = new Map<number, number>()
  // Cutable stock per result product-UOM — only for cutable-source SKUs (or rows
  // already holding some), so ordinary results keep showing the sellable figure alone.
  const finalCutableById = new Map<number, number>()
  for (const inv of (finalInvData as any)?.data ?? []) {
    const pu = inv?.product_uom_batch?.product_uom ?? inv?.product_uom
    const id = Number(pu?.id)
    if (!id) continue
    finalStockById.set(id, (finalStockById.get(id) ?? 0) + availableStockOf(inv))
    if (isCutableRow(inv)) finalCutableById.set(id, (finalCutableById.get(id) ?? 0) + cutableStockOf(inv))
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  const buildPayload = (values: FormValues, status: 'pending' | 'final'): PortioningRequest => ({
    date: values.date,
    status,
    description: values.description || undefined,
    source_owner_ref: values.source_owner_ref,
    source_stage: values.source_stage,
    source_location_ref: LOCATION_GENERAL,
    output_owner_ref: values.output_owner_ref,
    output_stage: values.output_stage,
    output_location_ref: LOCATION_GENERAL,
    details: values.details.map((d) => {
      const fraction = ratios[ratioKey(Number(d.base_product_inventory_id), Number(d.product_uom_id))]
      const finalQty = fraction ? Number(d.base_qty) / fraction : 0
      return {
        product_uom_id: d.product_uom_id,
        qty: finalQty,
        base_product_inventory_id: d.base_product_inventory_id,
        batch_code: d.batch_code || undefined,
        expiry_date: d.expiry_date || undefined,
        status,
        owner_ref: values.output_owner_ref || null,
        stage: values.output_stage || null,
        location_ref: LOCATION_GENERAL,
        // Packaging is auto-resolved by the backend when materials is empty.
        materials: [],
      }
    }),
  })

  const ratiosReady = (values: FormValues) =>
    values.details.every(
      (d) =>
        Number(d.base_qty) > 0 &&
        ratios[ratioKey(Number(d.base_product_inventory_id), Number(d.product_uom_id))] != null,
    )

  const previewMutation = useMutation({
    mutationFn: ({ body }: { body: PortioningRequest; sig: string; labels: string[] }) =>
      portioningsService.preview(body).then((r) => r.data),
    onSuccess: (resp, { sig, labels }) => {
      setPreview({ sig, labels, result: normalizePreview(resp) })
    },
    onError: (err: any) => toastMutationApiError(humanizeApiError(err), 'Gagal memuat preview'),
  })

  const createMutation = useMutation({
    mutationFn: (body: PortioningRequest) => portioningsService.create(body),
    onSuccess: (_resp, body) => {
      queryClient.invalidateQueries({ queryKey: ['portionings'] })
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      queryClient.invalidateQueries({ queryKey: ['product-inventories-all'] })
      toast.success(body.status === 'final' ? 'Portioning disimpan & direserve' : 'Portioning disimpan sebagai draft')
      // Land on the list so the freshly created document is visible right away.
      router.push('/production/portioning')
    },
    onError: (err: any) => toastMutationApiError(humanizeApiError(err), 'Gagal menyimpan portioning'),
  })

  const getFirstErrorMessage = (errs: any): string | undefined => {
    if (!errs || typeof errs !== 'object') return undefined
    if (typeof errs.message === 'string') return errs.message
    for (const key of Object.keys(errs)) {
      const msg = getFirstErrorMessage(errs[key])
      if (msg) return msg
    }
    return undefined
  }

  const onInvalid = (errs: any) => {
    toast.error(getFirstErrorMessage(errs) ?? 'Form tidak valid, periksa kembali data.')
  }

  const RATIO_NOT_READY_MSG = 'Rasio potong belum termuat — pilih base & hasil, tunggu sebentar, lalu coba lagi.'

  const onPreview = (values: FormValues) => {
    if (!ratiosReady(values)) {
      toast.error(RATIO_NOT_READY_MSG)
      return
    }
    previewMutation.mutate({
      body: buildPayload(values, values.status),
      sig: formSignature(getValues()),
      labels: values.details.map((d) => cutLabelFor(d.base_product_inventory_id, d.product_uom_id)),
    })
  }

  const saveAs = (status: 'pending' | 'final') =>
    handleSubmit((values) => {
      if (!ratiosReady(values)) {
        toast.error(RATIO_NOT_READY_MSG)
        return
      }
      setValue('status', status)
      createMutation.mutate(buildPayload(values, status))
    }, onInvalid)()

  const shortfallBlocksFinal = hasAnyShortfall(preview?.result)
  const previewStale = !!preview && preview.sig !== formSignature(watchedValues)
  const isPending = createMutation.isPending

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1000 }}>

      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingBottom: 20,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            cursor: 'pointer',
            color: 'var(--foreground-muted)',
          }}
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 500,
              margin: 0,
              color: 'var(--foreground)',
            }}
          >
            New Portioning
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '2px 0 0' }}>
            Potong kue base menjadi SKU final
          </p>
        </div>
      </div>

      {/* Form — Enter must never submit (Final reserves stock) */}
      <form
        onSubmit={(e) => e.preventDefault()}
        style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--foreground-subtle)' }}>
          <span style={{ color: 'var(--destructive)' }}>*</span>
          <span>Required fields</span>
        </div>

        {/* Section 1 — Portioning Details */}
        <div style={cardStyle}>
          <div style={{ ...cardHeaderStyle, padding: '14px 20px' }}>
            <span style={sectionHeaderStyle}>Portioning Details</span>
          </div>

          <div
            style={{
              padding: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16,
            }}
          >
            {/* Date */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Tanggal
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <input
                type="date"
                {...register('date')}
                style={{
                  ...fieldInputStyle,
                  border: `1px solid ${errors.date ? 'var(--destructive)' : 'var(--border)'}`,
                }}
              />
              {errors.date && <span style={errorTextStyle}>{errors.date.message}</span>}
            </div>

            {/* Status */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Status
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {([
                      { value: 'pending', label: 'Draft' },
                      { value: 'final', label: 'Final' },
                    ] as const).map((s) => {
                      const isSel = field.value === s.value
                      const tone = s.value === 'final' ? 'success' : 'warning'
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => field.onChange(s.value)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: 'pointer',
                            border: isSel ? `1px solid var(--${tone})` : '1px solid var(--border)',
                            background: isSel ? `var(--${tone}-bg)` : 'var(--surface)',
                            color: isSel ? `var(--${tone})` : 'var(--foreground-muted)',
                          }}
                        >
                          {s.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              />
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
              <label style={labelStyle}>Notes</label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Optional notes"
                style={{ ...fieldInputStyle, resize: 'vertical', fontFamily: 'var(--font-sans)' }}
              />
            </div>
          </div>
        </div>

        {/* Section 1b — Dimension Pickers (location hidden → GENERAL) */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={sectionHeaderStyle}>Dimensi Portioning</span>
          </div>

          <div
            style={{
              padding: '10px 16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
            }}
          >
            {/* Konsumsi Dari */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ ...sectionHeaderStyle, fontSize: 9 }}>Konsumsi Dari</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={labelStyle}>
                    Owner <span style={{ color: 'var(--destructive)' }}>*</span>
                  </label>
                  <Controller
                    name="source_owner_ref"
                    control={control}
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value ?? 'GENERAL'}
                        onChange={field.onChange}
                        options={companyOptions}
                        placeholder="Pilih owner..."
                        searchPlaceholder="Cari perusahaan..."
                        loading={companiesLoading}
                        error={errors.source_owner_ref?.message as string | undefined}
                        onSearchChange={setCompanySearch}
                      />
                    )}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Stage <span style={{ color: 'var(--destructive)' }}>*</span>
                  </label>
                  <Controller
                    name="source_stage"
                    control={control}
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value ?? 'GENERAL'}
                        onChange={field.onChange}
                        options={stageOptions}
                        placeholder="Pilih stage..."
                        searchPlaceholder="Cari stage..."
                        loading={stagesLoading}
                        error={errors.source_stage?.message as string | undefined}
                      />
                    )}
                  />
                </div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                Memotong hasil portioning (mis. Loaf → Ind)? Pilih stage <strong>finished</strong>.
              </span>
            </div>

            {/* Output Ke */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ ...sectionHeaderStyle, fontSize: 9 }}>Output Ke</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={labelStyle}>
                    Owner <span style={{ color: 'var(--destructive)' }}>*</span>
                  </label>
                  <Controller
                    name="output_owner_ref"
                    control={control}
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value ?? 'GENERAL'}
                        onChange={field.onChange}
                        options={companyOptions}
                        placeholder="Pilih owner..."
                        searchPlaceholder="Cari perusahaan..."
                        loading={companiesLoading}
                        error={errors.output_owner_ref?.message as string | undefined}
                        onSearchChange={setCompanySearch}
                      />
                    )}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Stage <span style={{ color: 'var(--destructive)' }}>*</span>
                  </label>
                  <Controller
                    name="output_stage"
                    control={control}
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value ?? 'GENERAL'}
                        onChange={field.onChange}
                        options={stageOptions}
                        placeholder="Pilih stage..."
                        searchPlaceholder="Cari stage..."
                        loading={stagesLoading}
                        error={errors.output_stage?.message as string | undefined}
                      />
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2 — Cuts */}
        <div style={cardStyle}>
          <div
            style={{
              ...cardHeaderStyle,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={sectionHeaderStyle}>Potongan (SKU Final)</span>
            <button
              type="button"
              onClick={handleAddDetail}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                color: 'var(--foreground)',
              }}
            >
              <Plus size={12} />
              Tambah Potongan
            </button>
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {detailFields.map((field, index) => {
              const rowErrors = errors.details?.[index]
              const d = watchedValues.details?.[index]
              const invId = Number(d?.base_product_inventory_id ?? 0)
              const puId = Number(d?.product_uom_id ?? 0)
              const baseQty = Number(d?.base_qty ?? 0)
              const baseStock = invId > 0 ? (invStockById.get(invId) ?? '—') : '—'
              const baseAvail = invId > 0 ? invAvailById.get(invId) : undefined
              const baseOver = baseAvail != null && baseAvail.kind !== 'sellable' && baseQty > baseAvail.qty
              const resultStock =
                puId > 0 && finalStockById.has(puId)
                  ? `${formatNumber(finalStockById.get(puId))}${
                      finalCutableById.has(puId) ? ` · Cutable: ${formatNumber(finalCutableById.get(puId))}` : ''
                    }`
                  : '—'
              const fraction = ratios[ratioKey(invId, puId)]
              const resultQty = fraction ? baseQty / fraction : null
              const yieldN = fraction ? 1 / fraction : null
              const { options: cutOptions, loading: cutLoading, error: cutError, allNonDeferred } = cutOptionsFor(invId)
              return (
                <div
                  key={field.id}
                  data-portioning-detail-index={index}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--background)',
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>
                      Potongan #{index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDetail(index)}
                      disabled={detailFields.length <= 1}
                      title="Hapus potongan"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: 4,
                        background: 'transparent',
                        border: 'none',
                        cursor: detailFields.length <= 1 ? 'not-allowed' : 'pointer',
                        color: 'var(--destructive)',
                        opacity: detailFields.length <= 1 ? 0.4 : 1,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {/* FROM — base cake */}
                    <div
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface)',
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <span style={{ ...sectionHeaderStyle, color: 'var(--accent)' }}>From · base</span>
                      <div>
                        <label style={labelStyle}>
                          Base cake <span style={{ color: 'var(--destructive)' }}>*</span>
                        </label>
                        <Controller
                          name={`details.${index}.base_product_inventory_id`}
                          control={control}
                          render={({ field: f }) => (
                            <SearchableSelect
                              value={f.value ?? 0}
                              onChange={(v) => {
                                f.onChange(v)
                                setValue(`details.${index}.product_uom_id`, 0)
                                setValue(`details.${index}.base_qty`, 1)
                              }}
                              options={inventoryOptions}
                              placeholder="Pilih base cake..."
                              searchPlaceholder="Cari inventory..."
                              loading={inventoriesLoading}
                              error={rowErrors?.base_product_inventory_id?.message as string | undefined}
                            />
                          )}
                        />
                        {invId > 0 && !inventoryOptions.some((o) => o.value === invId) && (
                          <span style={{ fontSize: 11, color: 'var(--warning)', marginTop: 3, display: 'block' }}>
                            Inventory ini tidak ada di dimensi &quot;Konsumsi Dari&quot; saat ini.
                          </span>
                        )}
                      </div>
                      <div>
                        <label style={labelStyle}>
                          {baseAvail?.kind === 'cutable' ? 'Cutable' : baseAvail?.kind === 'sellable' ? 'Sellable' : 'Stok'}
                        </label>
                        <div style={roStyle}>{baseStock}</div>
                      </div>
                      <div>
                        <label style={labelStyle}>
                          Qty base <span style={{ color: 'var(--destructive)' }}>*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          {...register(`details.${index}.base_qty`)}
                          style={{
                            ...fieldInputStyle,
                            border: `1px solid ${rowErrors?.base_qty ? 'var(--destructive)' : 'var(--border)'}`,
                          }}
                        />
                        {rowErrors?.base_qty && <span style={errorTextStyle}>{rowErrors.base_qty.message}</span>}
                        {baseAvail != null && baseAvail.kind !== 'sellable' && (
                          <span style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 3, display: 'block' }}>
                            Tersedia untuk dipotong: {formatNumber(baseAvail.qty)}
                            {baseAvail.unit ? ` ${baseAvail.unit}` : ''}
                          </span>
                        )}
                        {baseAvail?.kind === 'sellable' && (
                          <span style={{ fontSize: 11, color: 'var(--warning)', marginTop: 3, display: 'block' }}>
                            SKU final Deferred tidak punya stok fisik (selalu 0) — yang ada hanya lot sellable (
                            {formatNumber(baseAvail.sellable)}). Baru bisa dipotong lagi setelah produknya ber-flag
                            Cutable Source (menu Products).
                          </span>
                        )}
                        {baseAvail?.kind === 'cutable' && baseAvail.qty <= 0 && baseAvail.sellable > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--warning)', marginTop: 3, display: 'block' }}>
                            Stok cutable 0 padahal ada {formatNumber(baseAvail.sellable)} lot sellable — lot yang dibuat
                            sebelum produk ber-flag Cutable Source belum punya stok cutable (perlu backfill).
                          </span>
                        )}
                        {baseOver && baseAvail != null && (
                          <span style={{ fontSize: 11, color: 'var(--warning)', marginTop: 3, display: 'block' }}>
                            Qty base melebihi yang tersedia ({formatNumber(baseAvail.qty)}
                            {baseAvail.unit ? ` ${baseAvail.unit}` : ''}) — server tetap memvalidasi saat simpan.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* TO — result SKU */}
                    <div
                      style={{
                        border: '1px solid var(--accent-light)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface)',
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <span style={{ ...sectionHeaderStyle, color: 'var(--accent)' }}>To · hasil</span>
                      <div>
                        <label style={labelStyle}>
                          SKU hasil <span style={{ color: 'var(--destructive)' }}>*</span>
                        </label>
                        <Controller
                          name={`details.${index}.product_uom_id`}
                          control={control}
                          render={({ field: f }) => (
                            <SearchableSelect
                              value={f.value ?? 0}
                              onChange={(v) => {
                                f.onChange(v)
                                const b = Number(getValues(`details.${index}.base_product_inventory_id`))
                                if (b && v) probeRatio(b, Number(v))
                              }}
                              options={cutOptions}
                              placeholder={
                                invId === 0
                                  ? 'Pilih base cake dulu...'
                                  : cutLoading
                                    ? 'Memuat SKU hasil...'
                                    : 'Pilih SKU hasil...'
                              }
                              searchPlaceholder="Cari SKU..."
                              loading={cutLoading || inventoriesLoading}
                              error={rowErrors?.product_uom_id?.message as string | undefined}
                            />
                          )}
                        />
                        {invId > 0 && !cutLoading && cutOptions.length === 0 && (
                          <span
                            style={{
                              fontSize: 11,
                              color: cutError ? 'var(--destructive)' : 'var(--warning)',
                              marginTop: 3,
                              display: 'block',
                            }}
                          >
                            {cutError
                              ? `Gagal memuat daftar SKU hasil: ${cutError}`
                              : baseAvail?.kind === 'sellable'
                                ? 'Base ini SKU final Deferred yang belum ber-flag Cutable Source, jadi tidak bisa dipotong lagi. Aktifkan Cutable Source di menu Products.'
                                : allNonDeferred
                                ? 'Base cake ini punya resep, tetapi semua hasilnya belum ber-flag Deferred. Portioning hanya menerima produk final ber-flag Deferred — aktifkan dulu di menu Products.'
                                : 'Tidak ada stok produk yang dapat dibagi dari base cake ini.'}
                          </span>
                        )}
                        {invId > 0 && puId > 0 && ratioErrors[ratioKey(invId, puId)] && (
                          <span style={{ fontSize: 11, color: 'var(--destructive)', marginTop: 3, display: 'block' }}>
                            SKU ini tidak bisa dipotong dari base yang dipilih: {ratioErrors[ratioKey(invId, puId)]}
                          </span>
                        )}
                      </div>
                      <div>
                        <label style={labelStyle}>Stok</label>
                        <div style={roStyle}>{resultStock}</div>
                      </div>
                      <div>
                        <label style={labelStyle}>Qty hasil</label>
                        <div style={roStyle}>{resultQty != null ? formatNumber(resultQty) : '—'}</div>
                      </div>
                    </div>
                  </div>

                  {yieldN != null && (
                    <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                      1 base = {formatNumber(yieldN)} hasil
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Batch Code</label>
                      <input
                        type="text"
                        placeholder="Opsional"
                        {...register(`details.${index}.batch_code`)}
                        style={fieldInputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Expiry Date</label>
                      <input
                        type="date"
                        {...register(`details.${index}.expiry_date`)}
                        style={fieldInputStyle}
                      />
                    </div>
                  </div>
                </div>
              )
            })}

            {errors.details && typeof (errors.details as any).message === 'string' && (
              <span style={{ fontSize: 12, color: 'var(--destructive)' }}>
                {(errors.details as any).message}
              </span>
            )}
          </div>
        </div>

        {/* Preview result */}
        {preview && <PreviewPanel preview={preview} stale={previewStale} />}

        {/* Form actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 10,
            paddingTop: 4,
          }}
        >
          {shortfallBlocksFinal && (
            <span style={{ fontSize: 12, color: 'var(--destructive)', marginRight: 'auto' }}>
              Ada shortfall pada preview — Simpan &amp; Reserve dinonaktifkan.
            </span>
          )}
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              padding: '9px 20px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              color: 'var(--foreground)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit(onPreview, onInvalid)}
            disabled={previewMutation.isPending || isPending}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 20px',
              background: 'var(--surface)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              color: 'var(--accent)',
              opacity: previewMutation.isPending || isPending ? 0.7 : 1,
            }}
          >
            {previewMutation.isPending ? (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Eye size={14} />
            )}
            {previewMutation.isPending ? 'Memuat...' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={() => saveAs('pending')}
            disabled={isPending}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 20px',
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              color: 'var(--foreground)',
              opacity: isPending ? 0.7 : 1,
            }}
          >
            Simpan Draft
          </button>
          <button
            type="button"
            onClick={() => saveAs('final')}
            disabled={isPending || shortfallBlocksFinal}
            title={shortfallBlocksFinal ? 'Perbaiki shortfall lalu Preview ulang' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 20px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              cursor: isPending || shortfallBlocksFinal ? 'not-allowed' : 'pointer',
              opacity: isPending || shortfallBlocksFinal ? 0.5 : 1,
            }}
          >
            {isPending ? (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Save size={14} />
            )}
            {isPending ? 'Menyimpan...' : 'Simpan & Reserve'}
          </button>
        </div>
      </form>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
