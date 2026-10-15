'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, ArrowLeft, Loader2, Save, Eye } from 'lucide-react'
import api from '@/hooks/useApi'
import { useAuth } from '@/hooks/useAuth'
import { portioningsService } from '@/services/portionings.service'
import { productInventoriesService } from '@/services/product-inventories.service'
import { productCutsService } from '@/services/product-cuts.service'
import { companiesService } from '@/services/companies.service'
import { toastMutationApiError } from '@/utils/apiError'
import { getProductUomName } from '@/utils/productUomName'
import SearchableSelect from '@/components/SearchableSelect'
import { useFormKeyboardNavigation } from '@/hooks/useFormKeyboardNavigation'
import type { PortioningRequest, ProductCut } from '@/types/api'

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

const formatNumber = (v: unknown, maxFractionDigits = 3): string => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('id-ID', { maximumFractionDigits: maxFractionDigits }) : '—'
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
    reset,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      date: todayLocalISO(),
      status: 'pending',
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

  // Cuts: which result SKUs each base product-UOM can be cut into, and at what yield.
  const { data: cutsData, isLoading: cutsLoading } = useQuery({
    queryKey: ['product-cuts-all', activeBranchId],
    enabled: !!activeBranchId,
    queryFn: () =>
      productCutsService
        .list({
          per_page: 1000,
          include: 'child_product_uom,child_product_uom.product,child_product_uom.uom',
          'filter[branch_id]': activeBranchId,
        } as any)
        .then((r) => r.data),
  })
  const cuts: ProductCut[] = (cutsData as any)?.data ?? []

  const cutsMap = new Map<number, { childPuId: number; label: string; yield: number; childStock: number | null }[]>()
  const childLabelById = new Map<number, string>()
  for (const c of cuts) {
    const child = c.child_product_uom
    const label = [child?.product?.name ?? child?.name ?? `#${c.child_product_uom_id}`, child?.uom?.code]
      .filter(Boolean)
      .join(' · ')
    const arr = cutsMap.get(c.parent_product_uom_id) ?? []
    arr.push({ childPuId: c.child_product_uom_id, label, yield: Number(c.yield_qty) || 0, childStock: c.child_stock ?? null })
    cutsMap.set(c.parent_product_uom_id, arr)
    childLabelById.set(c.child_product_uom_id, label)
  }

  const invMeta = new Map<number, { puId: number; stock: number; uomCode: string; name: string }>()
  for (const inv of inventories) {
    const pu = inv?.product_uom_batch?.product_uom ?? inv?.product_uom
    invMeta.set(Number(inv.id), {
      puId: Number(pu?.id) || 0,
      stock: Number(inv.display_qty ?? inv.stock ?? 0),
      uomCode: inv.display_uom_code ?? pu?.uom?.code ?? '',
      name: getProductUomName(pu, inv.code),
    })
  }

  const inventoryOptions = inventories
    .filter((inv: any) => cutsMap.has(Number((inv?.product_uom_batch?.product_uom ?? inv?.product_uom)?.id)))
    .map((inv: any) => {
      const pu = inv?.product_uom_batch?.product_uom ?? inv?.product_uom
      const stockQty = inv.display_qty ?? inv.stock ?? 0
      const expiry = inv?.product_uom_batch?.expiry_date ?? inv?.expiry_date
      return {
        value: Number(inv.id),
        label: [getProductUomName(pu, inv.code), pu?.uom?.code].filter(Boolean).join(' · '),
        sublabel: [
          inv.code ? `SKU: ${inv.code}` : '',
          `Stok: ${formatNumber(stockQty)}${inv.display_uom_code ? ` ${inv.display_uom_code}` : ''}`,
          expiry ? `Exp: ${String(expiry).slice(0, 10)}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      }
    })

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
      const meta = invMeta.get(Number(d.base_product_inventory_id))
      const kids = meta ? (cutsMap.get(meta.puId) ?? []) : []
      const kid = kids.find((k) => k.childPuId === Number(d.product_uom_id))
      const finalQty = kid ? Number(d.base_qty) * kid.yield : 0
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

  const allRowsHaveCut = (values: FormValues) =>
    values.details.every((d) => {
      const meta = invMeta.get(Number(d.base_product_inventory_id))
      const kids = meta ? (cutsMap.get(meta.puId) ?? []) : []
      return kids.some((k) => k.childPuId === Number(d.product_uom_id)) && Number(d.base_qty) > 0
    })

  const previewMutation = useMutation({
    mutationFn: ({ body }: { body: PortioningRequest; sig: string; labels: string[] }) =>
      portioningsService.preview(body).then((r) => r.data),
    onSuccess: (resp, { sig, labels }) => {
      setPreview({ sig, labels, result: normalizePreview(resp) })
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal memuat preview'),
  })

  const createMutation = useMutation({
    mutationFn: (body: PortioningRequest) => portioningsService.create(body),
    onSuccess: (_resp, body) => {
      queryClient.invalidateQueries({ queryKey: ['portionings'] })
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      queryClient.invalidateQueries({ queryKey: ['product-inventories-all'] })
      toast.success(body.status === 'final' ? 'Portioning disimpan & direserve' : 'Portioning disimpan sebagai draft')
      // No list/detail page yet: stay here, keep date + dimensions, clear the cuts.
      reset({ ...getValues(), description: '', details: [emptyDetail()] })
      setPreview(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal menyimpan portioning'),
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

  const onPreview = (values: FormValues) => {
    if (!allRowsHaveCut(values)) {
      toast.error('Setiap potongan harus punya base, qty base, dan SKU hasil yang valid.')
      return
    }
    previewMutation.mutate({
      body: buildPayload(values, values.status),
      sig: formSignature(getValues()),
      labels: values.details.map((d) => childLabelById.get(Number(d.product_uom_id)) ?? `#${d.product_uom_id}`),
    })
  }

  const saveAs = (status: 'pending' | 'final') =>
    handleSubmit((values) => {
      if (!allRowsHaveCut(values)) {
        toast.error('Setiap potongan harus punya base, qty base, dan SKU hasil yang valid.')
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
              const meta = invMeta.get(invId)
              const baseQty = Number(d?.base_qty ?? 0)
              const childPuId = Number(d?.product_uom_id ?? 0)
              const kids = meta ? (cutsMap.get(meta.puId) ?? []) : []
              const kid = kids.find((k) => k.childPuId === childPuId)
              const resultOptions = kids.map((k) => ({ value: k.childPuId, label: `${k.label} — 1 jadi ${k.yield}` }))
              const resultQty = kid ? baseQty * kid.yield : 0
              const over = !!meta && baseQty > meta.stock
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
                        gap: 10,
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
                              loading={inventoriesLoading || cutsLoading}
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
                        <label style={labelStyle}>Stok</label>
                        <div style={roStyle}>{meta ? `${formatNumber(meta.stock)} ${meta.uomCode}` : '—'}</div>
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
                        gap: 10,
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
                              onChange={f.onChange}
                              options={resultOptions}
                              placeholder={meta ? 'Choose...' : 'Pilih base dulu'}
                              searchPlaceholder="Cari SKU..."
                              loading={cutsLoading}
                              error={rowErrors?.product_uom_id?.message as string | undefined}
                            />
                          )}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Stok</label>
                        <div style={roStyle}>
                          {kid && kid.childStock != null
                            ? `${formatNumber(kid.childStock)} ${meta?.uomCode ?? ''}`
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Qty hasil</label>
                        <div style={{ ...roStyle, fontWeight: 700, color: 'var(--foreground)' }}>
                          {kid ? formatNumber(resultQty) : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {kid && (
                    <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                      1 {meta?.name} = {kid.yield} {kid.label}
                      {' · '}
                      <span style={{ color: over ? 'var(--destructive)' : 'var(--foreground-muted)' }}>
                        {over
                          ? `qty melebihi stok base (${meta?.stock})`
                          : `sisa base ${(meta?.stock ?? 0) - baseQty} ${meta?.uomCode ?? ''}`}
                      </span>
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
