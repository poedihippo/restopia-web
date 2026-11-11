'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Save, Eye, Scissors } from 'lucide-react'
import BackLink from '@/components/BackLink'
import { portioningsService } from '@/services/portionings.service'
import { companiesService } from '@/services/companies.service'
import api from '@/hooks/useApi'
import { parseApiError, toastMutationApiError } from '@/utils/apiError'
import SearchableSelect from '@/components/SearchableSelect'
import { useFormKeyboardNavigation } from '@/hooks/useFormKeyboardNavigation'
import { useAuth } from '@/hooks/useAuth'
import ProductCutSheet from '@/views/ProductCuts/ProductCutSheet'
import type { Portioning, PortioningRequest } from '@/types/api'
import type { PortioningSource, PortioningSourceOutput } from '@/services/portionings.service'

// Location pickers are hidden on this form; the backend always gets GENERAL.
const LOCATION_GENERAL = 'GENERAL'
const GENERAL_OWNER_OPTION = { value: 'GENERAL', label: 'Umum (GENERAL)' }

// ── Schemas ──────────────────────────────────────────────────────────────────

const detailSchema = z.object({
  // The source stock row this detail is cut from (a product_inventory_id).
  base_product_inventory_id: z.coerce.number().min(1, 'Sumber wajib dipilih'),
  product_uom_id: z.coerce.number().min(1, 'SKU hasil wajib dipilih'),
  qty: z.coerce.number().gt(0, 'Qty hasil harus lebih dari 0'),
  // Optional whole number of source units this cut uses; blank = let the API
  // compute ceil(sum of qty / yield).
  source_qty: z.coerce.number().min(0).optional(),
  batch_code: z.string().optional(),
  expiry_date: z.string().optional(),
  description: z.string().optional(),
  // Saved per-detail output overrides (null = follow the header output).
  owner_ref: z.string().nullable().optional(),
  stage: z.string().nullable().optional(),
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

// ── Shared styles ─────────────────────────────────────────────────────────────

const fieldInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 12,
  color: 'var(--foreground)',
  background: 'var(--surface-raised)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
  minWidth: 0,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--foreground)',
  marginBottom: 4,
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
  minWidth: 0,
}

const cardHeaderStyle: React.CSSProperties = {
  padding: '12px 20px',
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
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

// minmax(0, 1fr) stops long content (e.g. the source dropdown text) from
// pushing a column wider than its parent card.
const twoColGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 16,
}

const columnBox: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  minWidth: 0,
}

const fieldWrap: React.CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
}

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--foreground-muted)',
  marginTop: 4,
  display: 'block',
  lineHeight: 1.4,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Local calendar date (not UTC) so early-morning WIB entries don't default to yesterday. */
function todayLocalISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const emptyDetail = (): FormValues['details'][number] => ({
  base_product_inventory_id: 0,
  product_uom_id: 0,
  qty: 1,
  // Default 1 (like the old `base_qty: 1`) so picking an SKU immediately
  // derives qty hasil = source_qty × yield instead of leaving it blank.
  source_qty: 1,
  batch_code: '',
  expiry_date: '',
})

const formatNumber = (v: unknown, maxFractionDigits = 2): string => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('id-ID', { maximumFractionDigits: maxFractionDigits }) : '—'
}

/** Signature of the raw form state; `status` is excluded because the save buttons override it. */
const formSignature = (values: unknown): string =>
  JSON.stringify({ ...(values as object), status: undefined })

// ── Preview (P5: POST /portionings/preview — dry run, persists nothing) ──────

interface PreviewSource {
  product_inventory_id: number
  product_id: number
  source_qty: number
  sum_fractions: number
  scrap_qty: number
  available_base_qty: number
}

interface PreviewDetail {
  detail_index: number
  product_uom_id: number
  qty: number
  fraction: number
  source_qty: number
  scrap_qty: number
  yield_qty: number
  batch_code: string
  expiry_date: string
}

interface PreviewShortfall {
  product_inventory_id: number
  product_id: number
  requested_qty: number
  available_qty: number
  owner_ref?: string
  stage?: string
  location_ref?: string
}

interface PreviewResult {
  sufficient: boolean
  sources: PreviewSource[]
  details: PreviewDetail[]
  shortfalls: PreviewShortfall[]
}

function normalizePreview(resp: any): PreviewResult {
  const root = resp?.data ?? resp
  return {
    sufficient: root?.sufficient !== false,
    sources: Array.isArray(root?.sources) ? root.sources : [],
    details: Array.isArray(root?.details) ? root.details : [],
    shortfalls: Array.isArray(root?.shortfalls) ? root.shortfalls : [],
  }
}

function PreviewPanel({ result, stale }: { result: PreviewResult; stale: boolean }) {
  const shortfallText = (s: PreviewShortfall) =>
    `Kurang stok: diminta ${formatNumber(s.requested_qty)}, tersedia ${formatNumber(s.available_qty)}` +
    `${s.owner_ref || s.stage ? ` di ${s.stage ?? '—'}/${s.owner_ref ?? '—'}` : ''}`

  return (
    <div style={cardStyle}>
      <div
        style={{
          ...cardHeaderStyle,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={sectionHeaderStyle}>Hasil Preview</span>
        <span
          style={{
            padding: '3px 10px',
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 700,
            background: result.sufficient ? 'var(--success-bg)' : 'var(--destructive-bg)',
            color: result.sufficient ? 'var(--success)' : 'var(--destructive)',
          }}
        >
          {result.sufficient ? 'Cukup' : 'Stok kurang'}
        </span>
        {stale && (
          <span style={{ fontSize: 11, color: 'var(--warning)' }}>
            Form berubah sejak preview — jalankan Preview ulang
          </span>
        )}
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {result.shortfalls.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {result.shortfalls.map((s, i) => (
              <div
                key={i}
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--destructive)',
                  background: 'var(--destructive-bg)',
                  color: 'var(--destructive)',
                }}
              >
                {shortfallText(s)}
              </div>
            ))}
          </div>
        )}

        {/* Per-source summary — how many whole source units each row burns, and its scrap. */}
        {result.sources.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)' }}>
              Sumber
            </span>
            {result.sources.map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  fontSize: 12,
                  color: 'var(--foreground-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                }}
              >
                <span>
                  Baris #{s.product_inventory_id} — butuh{' '}
                  <strong style={{ color: 'var(--foreground)' }}>{formatNumber(s.source_qty)}</strong> unit
                  (fraksi {formatNumber(s.sum_fractions, 6)}, scrap{' '}
                  {formatNumber(s.scrap_qty, 6)}), tersedia{' '}
                  <strong style={{ color: 'var(--foreground)' }}>{formatNumber(s.available_base_qty)}</strong>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Per-detail result — the numbers create will use. */}
        {result.details.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)' }}>
              Potongan
            </span>
            {result.details.map((d, i) => (
              <div
                key={i}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--background)',
                  padding: '10px 12px',
                  display: 'flex',
                  gap: 16,
                  flexWrap: 'wrap',
                  fontSize: 12,
                  color: 'var(--foreground-muted)',
                }}
              >
                <span>
                  #{d.detail_index + 1} · hasil{' '}
                  <strong style={{ color: 'var(--foreground)' }}>{formatNumber(d.qty)}</strong>
                </span>
                <span>
                  yield <strong style={{ color: 'var(--foreground)' }}>{formatNumber(d.yield_qty)}</strong>
                </span>
                <span>
                  fraksi <strong style={{ color: 'var(--foreground)' }}>{formatNumber(d.fraction, 6)}</strong>
                </span>
                <span>
                  source <strong style={{ color: 'var(--foreground)' }}>{formatNumber(d.source_qty, 6)}</strong>
                </span>
                <span>
                  scrap <strong style={{ color: 'var(--foreground)' }}>{formatNumber(d.scrap_qty, 6)}</strong>
                </span>
                {d.batch_code && <span>batch {d.batch_code}</span>}
                {d.expiry_date && <span>exp {String(d.expiry_date).slice(0, 10)}</span>}
              </div>
            ))}
          </div>
        )}

        {result.sources.length === 0 &&
          result.details.length === 0 &&
          result.shortfalls.length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
              Preview tidak mengembalikan detail.
            </span>
          )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PortioningForm({ editId }: { editId?: number } = {}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const isEdit = editId != null
  const validEditId = !!editId && Number.isFinite(Number(editId)) && Number(editId) > 0

  const [preview, setPreview] = useState<{ sig: string; result: PreviewResult } | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    reset,
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

  const watchedValues = watch()

  // ── Sources (S1: GET /portionings/sources) ───────────────────────────────
  // This branch's stock rows of products that are the parent of at least one
  // cut. Not paged. `stock` is the only quantity.
  // Re-fetched whenever the Konsumsi Dari stage/owner changes. The documented
  // endpoint only takes product_id/include_empty, so stage/owner_ref are sent
  // for the backend to honour once supported, and the stage is also applied
  // client-side so the picker always matches the selected stage.
  const sourceStage = watch('source_stage')
  const sourceOwnerRef = watch('source_owner_ref')
  const { data: sourcesData, isFetching: sourcesLoading } = useQuery({
    queryKey: ['portioning-sources', sourceStage, sourceOwnerRef],
    staleTime: 30 * 1000,
    placeholderData: (prev: any) => prev,
    queryFn: () =>
      portioningsService
        .sources({ stage: sourceStage || undefined, owner_ref: sourceOwnerRef || undefined })
        .then((r) => r.data),
  })
  const allSources: PortioningSource[] = (sourcesData as any)?.data ?? []
  const selectedSourceIds = new Set(
    (watch('details') ?? []).map((d: any) => Number(d?.base_product_inventory_id)).filter((id: number) => id > 0),
  )
  const sources: PortioningSource[] = allSources.filter(
    (s) =>
      !sourceStage ||
      !s.stage ||
      s.stage.toLowerCase() === sourceStage.toLowerCase() ||
      // keep rows already picked so their label/stock don't vanish
      selectedSourceIds.has(s.product_inventory_id),
  )

  const sourceOptions = sources.map((s) => ({
    value: s.product_inventory_id,
    label: s.product_name ?? `Baris #${s.product_inventory_id}`,
    sublabel: [
      s.product_code ? `SKU: ${s.product_code}` : '',
      s.batch_code ? `Batch: ${s.batch_code}` : '',
      `Stok: ${formatNumber(s.stock)}`,
      s.stage ? `Stage: ${s.stage}` : '',
      s.owner_ref ? `Owner: ${s.owner_ref}` : '',
      s.expiry_date ? `Exp: ${String(s.expiry_date).slice(0, 10)}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  }))

  const sourceById = new Map<number, PortioningSource>(
    sources.map((s) => [s.product_inventory_id, s]),
  )

  // ── Outputs per source row (S2: GET /portionings/sources/:id/outputs) ────
  // `id` is the STOCK ROW id. One query per distinct source row used by the
  // form; deduped so re-picking the same row doesn't re-hit the API.
  const usedSourceIds = Array.from(
    new Set(
      (watchedValues.details ?? [])
        .map((d) => Number(d?.base_product_inventory_id ?? 0))
        .filter((id) => id > 0),
    ),
  )

  const outputQueries = useQuery({
    queryKey: ['portioning-source-outputs', usedSourceIds.slice().sort((a, b) => a - b)],
    enabled: usedSourceIds.length > 0,
    staleTime: 30 * 1000,
    retry: 1,
    queryFn: async () => {
      const entries = await Promise.all(
        usedSourceIds.map(async (invId) => {
          try {
            const res = await portioningsService.sourceOutputs(invId)
            return [invId, (res.data as any)?.data ?? []] as [number, PortioningSourceOutput[]]
          } catch {
            return [invId, []] as [number, PortioningSourceOutput[]]
          }
        }),
      )
      return Object.fromEntries(entries)
    },
  })
  const outputsBySource: Record<number, PortioningSourceOutput[]> = outputQueries.data ?? {}

  /** Output options + loading state for one detail row, given its source row. */
  const optionsFor = (invId: number): { options: { value: number; label: string; sublabel?: string }[]; loading: boolean } => {
    if (!invId) return { options: [], loading: sourcesLoading }
    const rows = outputsBySource[invId]
    if (!rows) return { options: [], loading: outputQueries.isFetching }
    return {
      options: rows
        .map((o) => ({
          value: o.product_uom_id,
          label: o.product_name ?? `SKU #${o.product_uom_id}`,
          sublabel: [
            o.product_code ? `SKU: ${o.product_code}` : '',
            `Yield: ${formatNumber(o.yield_qty)} per unit sumber`,
          ]
            .filter(Boolean)
            .join(' · '),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      loading: false,
    }
  }

  /** The cut's yield for one (source row, output SKU) pair, straight from the cut table. */
  const yieldFor = (invId: number, puId: number): number | null => {
    const rows = outputsBySource[invId]
    if (!rows) return null
    const hit = rows.find((o) => o.product_uom_id === puId)
    return hit ? Number(hit.yield_qty) : null
  }

  // ── Flow: qty hasil diturunkan dari source_qty ─────────────────────────────
  // qty hasil is no longer typed — it is `source_qty × yield`, the same
  // relationship the old base_qty form used (base_qty / fraction_base).
  //
  // Runs only from user edits (source_qty / SKU onChange), never on load, so:
  //  - an existing document whose qty intentionally differs from
  //    source_qty × yield (a partial cut, i.e. scrap — see P6) is left alone, and
  //  - a seed into the form never rewrites a stored value.
  // When the yield is not loaded yet nothing happens and the field simply
  // stays manual until it is; picking a SKU happens from a dropdown the same
  // query populated, so in practice yield is available at that moment.
  const deriveQtyFromSource = (index: number, invId: number, puId: number, srcRaw: unknown) => {
    const y = yieldFor(invId, puId)
    const raw = Number(srcRaw)
    if (!y || y <= 0 || !Number.isFinite(raw) || raw <= 0) return
    // Round first — buildPayload sends `Math.round(source_qty)`, so deriving
    // from the same rounded value keeps qty and source_qty in agreement (a
    // typed 1.5 becomes 2 on both sides instead of 2 sent with qty for 1.5).
    const next = Math.round(raw) * y
    if (Number(getValues(`details.${index}.qty`)) !== next) {
      setValue(`details.${index}.qty`, next)
    }
  }

  // ── Dimension pickers (owner + stage) ────────────────────────────────────
  const [companySearch, setCompanySearch] = useState('')
  // Pop-up "Buat Product Cut" — cut table baru langsung terpakai di dropdown SKU hasil
  // (sheet meng-invalidate 'portioning-source-outputs').
  const [cutModalOpen, setCutModalOpen] = useState(false)
  const { hasPermission } = useAuth()
  const canCreateCut = hasPermission('product-cut.create')
  const [debouncedCompanySearch, setDebouncedCompanySearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCompanySearch(companySearch), 400)
    return () => clearTimeout(t)
  }, [companySearch])

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

  // Default Output stage to 'finished' on a fresh form only (never clobber an
  // edit-mode stored stage).
  const didDefaultOutputStage = useRef(false)
  useEffect(() => {
    if (isEdit || didDefaultOutputStage.current || stages.length === 0) return
    didDefaultOutputStage.current = true
    if (stages.some((s) => s.code === 'finished')) setValue('output_stage', 'finished')
  }, [isEdit, stages, setValue])

  // ── Edit mode (P4: GET /portionings/:id?include=details,details.materials) ─
  const didLoadEdit = useRef(false)
  const { data: editData, isError: editIsError } = useQuery({
    queryKey: ['portioning', 'edit', editId],
    enabled: validEditId,
    retry: 1,
    queryFn: () =>
      portioningsService
        .findById(Number(editId), { include: 'created_by,updated_by,details,details.materials' })
        .then((r) => r.data),
  })
  const editEnvelope = (editData ?? null) as { data?: Portioning | { data?: Portioning } } | null
  const editBody = editEnvelope?.data
  const editRecord: Portioning | null =
    editBody && 'id' in editBody ? editBody : (editBody as { data?: Portioning } | undefined)?.data ?? null

  useEffect(() => {
    if (!isEdit || didLoadEdit.current || !editRecord?.id) return
    if (!Array.isArray(editRecord.details)) return
    didLoadEdit.current = true
    didDefaultOutputStage.current = true

    const details = (editRecord.details ?? []).map((d) => ({
      base_product_inventory_id: Number(d.base_product_inventory_id ?? 0),
      product_uom_id: Number(d.product_uom_id ?? 0),
      qty: Number(d.qty ?? 0),
      source_qty: d.source_qty ? Number(d.source_qty) : undefined,
      batch_code: d.batch_code ?? '',
      expiry_date: d.expiry_date ? String(d.expiry_date).slice(0, 10) : '',
      description: d.description ?? '',
      // Keep only values that differ from the header, so a later header
      // change still applies to details that simply followed it.
      owner_ref: d.owner_ref && d.owner_ref !== editRecord.output_owner_ref ? d.owner_ref : null,
      stage: d.stage && d.stage !== editRecord.output_stage ? d.stage : null,
    }))

    reset({
      date: editRecord.date ? String(editRecord.date).slice(0, 10) : todayLocalISO(),
      status: editRecord.status === 'final' ? 'final' : 'pending',
      description: editRecord.description ?? '',
      source_owner_ref: editRecord.source_owner_ref || 'GENERAL',
      source_stage: editRecord.source_stage || 'GENERAL',
      output_owner_ref: editRecord.output_owner_ref || 'GENERAL',
      output_stage: editRecord.output_stage || 'GENERAL',
      details: details.length > 0 ? details : [emptyDetail()],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editRecord])

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
    details: values.details.map((d) => ({
      product_uom_id: d.product_uom_id,
      qty: Number(d.qty),
      base_product_inventory_id: Number(d.base_product_inventory_id),
      // Only send a whole number >= 1; blank lets the API compute
      // ceil(sum of qty / yield) for the shared source row.
      source_qty: Number(d.source_qty) > 0 ? Math.round(Number(d.source_qty)) : undefined,
      batch_code: d.batch_code || undefined,
      expiry_date: d.expiry_date || undefined,
      description: d.description || undefined,
      status,
      owner_ref: d.owner_ref || values.output_owner_ref || null,
      stage: d.stage || values.output_stage || null,
      location_ref: LOCATION_GENERAL,
      // Packaging is auto-resolved by the backend when materials is empty.
      materials: [],
    })),
  })

  const previewMutation = useMutation({
    // `sig` rides along in the variables so onSuccess can store it; it is not
    // needed to call the endpoint itself.
    mutationFn: ({ body }: { body: PortioningRequest; sig: string }) =>
      portioningsService.preview(body).then((r) => r.data),
    onSuccess: (resp, { sig }) => {
      setPreview({ sig, result: normalizePreview(resp) })
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal memuat preview'),
  })

  const saveMutation = useMutation({
    mutationFn: (body: PortioningRequest) =>
      isEdit ? portioningsService.update(Number(editId), body) : portioningsService.create(body),
    onSuccess: (_resp, body) => {
      queryClient.invalidateQueries({ queryKey: ['portionings'] })
      queryClient.invalidateQueries({ queryKey: ['product-inventories'] })
      queryClient.invalidateQueries({ queryKey: ['product-inventories-all'] })
      queryClient.invalidateQueries({ queryKey: ['portioning-sources'] })
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['portioning', 'edit', editId] })
      toast.success(
        isEdit
          ? body.status === 'final'
            ? 'Perubahan portioning disimpan & stok dibangun ulang'
            : 'Draft portioning diperbarui'
          : body.status === 'final'
            ? 'Portioning disimpan & stok bergerak'
            : 'Portioning disimpan sebagai draft',
      )
      router.push('/production/portioning')
    },
    onError: (err: any) =>
      toastMutationApiError(
        err,
        isEdit ? 'Gagal memperbarui portioning' : 'Gagal menyimpan portioning',
      ),
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
    // `sig` must be built from the FORM details (not the API payload) so it
    // compares equal to `formSignature(watchedValues.details)` below —
    // otherwise the panel shows "Form berubah sejak preview" permanently.
    previewMutation.mutate({ body: buildPayload(values, values.status), sig: formSignature(values.details) })
  }

  const saveAs = (status: 'pending' | 'final') =>
    handleSubmit((values) => {
      setValue('status', status)
      saveMutation.mutate(buildPayload(values, status))
    }, onInvalid)()

  // Preview's `sufficient` is the authoritative gate for saving (P5: "Use
  // sufficient to enable or disable the Save button").
  const insufficient = !!preview && !preview.result.sufficient
  const previewStale = !!preview && preview.sig !== formSignature(watchedValues.details)
  const isPending = saveMutation.isPending

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isEdit && !validEditId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 80 }}>
        <span style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>
          Id portioning tidak valid.
        </span>
        <BackLink href="/production/portioning" label="Portioning" style={{ alignSelf: 'center' }} />
      </div>
    )
  }

  if (isEdit && !editData && !editIsError) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 99,
              border: '3px solid var(--border)', borderTop: '3px solid var(--accent)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Memuat portioning...</span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (isEdit && (editIsError || !editRecord?.id)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 80 }}>
        <span style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>
          Portioning tidak ditemukan atau tidak bisa dimuat.
        </span>
        <BackLink href="/production/portioning" label="Portioning" style={{ alignSelf: 'center' }} />
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 24,
        width: '100%', paddingTop: 8, paddingBottom: 24,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex', flexDirection: 'column', gap: 12,
          paddingBottom: 20, borderBottom: '1px solid var(--border)',
        }}
      >
        <BackLink href="/production/portioning" label="Portioning" />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
            {isEdit ? 'Edit Portioning' : 'New Portioning'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '2px 0 0' }}>
            {isEdit && editRecord?.code ? (
              <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{editRecord.code}</span>
            ) : (
              'Potong sumber (mis. kue 20x40) menjadi SKU hasil'
            )}
            {isEdit &&
              ' — penyimpanan ulang membalik lalu menulis ulang stok (ditolak bila output sudah terjual, dipotong atau dipindah).'}
          </p>
        </div>
      </div>

      {/* Form — Enter must never submit (Final moves stock) */}
      <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--foreground-subtle)' }}>
          <span style={{ color: 'var(--destructive)' }}>*</span>
          <span>Required fields</span>
        </div>

        {/* Section 1 — Header */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={sectionHeaderStyle}>Portioning Details</span>
          </div>
          <div style={{ padding: 20, ...twoColGrid }}>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Tanggal
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <input
                type="date"
                {...register('date')}
                style={{ ...fieldInputStyle, border: `1px solid ${errors.date ? 'var(--destructive)' : 'var(--border)'}` }}
              />
              {errors.date && <span style={errorTextStyle}>{errors.date.message}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
                            padding: '6px 18px', borderRadius: 'var(--radius-md)', fontSize: 13,
                            fontWeight: 500, cursor: 'pointer',
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
              <span style={hintStyle}>Draft tidak memindah stok.</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2', minWidth: 0 }}>
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

        {/* Section 1b — Dimension pickers (location hidden → GENERAL) */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={sectionHeaderStyle}>Dimensi Portioning</span>
          </div>
          <div style={{ padding: 20, ...twoColGrid, gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              <span style={{ ...sectionHeaderStyle, color: 'var(--accent)' }}>Konsumsi Dari</span>
              <div style={{ ...twoColGrid, gap: 10 }}>
                <div style={fieldWrap}>
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
                        disabled
                        error={errors.source_owner_ref?.message as string | undefined}
                        onSearchChange={setCompanySearch}
                      />
                    )}
                  />
                </div>
                <div style={fieldWrap}>
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
              <span style={{ ...hintStyle, marginTop: 0 }}>
                Memotong hasil portioning (mis. Loaf → Ind)? Pilih stage <strong>finished</strong>.
              </span>
            </div>

            <div
              style={{
                display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0,
                paddingLeft: 24, borderLeft: '1px solid var(--border)',
              }}
            >
              <span style={{ ...sectionHeaderStyle, color: 'var(--accent)' }}>Output Ke</span>
              <div style={{ ...twoColGrid, gap: 10 }}>
                <div style={fieldWrap}>
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
                        disabled
                        error={errors.output_owner_ref?.message as string | undefined}
                        onSearchChange={setCompanySearch}
                      />
                    )}
                  />
                </div>
                <div style={fieldWrap}>
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
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span style={sectionHeaderStyle}>Potongan (SKU Hasil)</span>
            <div style={{ display: 'flex', gap: 8 }}>
            {canCreateCut && (
              <button
                type="button"
                onClick={() => setCutModalOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', color: 'var(--accent)',
                }}
              >
                <Scissors size={12} />
                Buat Product Cut
              </button>
            )}
            <button
              type="button"
              onClick={handleAddDetail}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', color: 'var(--foreground)',
              }}
            >
              <Plus size={12} />
              Tambah Potongan
            </button>
            </div>
          </div>

          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {detailFields.map((field, index) => {
              const rowErrors = errors.details?.[index]
              const d = watchedValues.details?.[index]
              const invId = Number(d?.base_product_inventory_id ?? 0)
              const puId = Number(d?.product_uom_id ?? 0)
              // Documented RHF compose pattern: spread the rest, keep register's
              // onChange so the value stays tracked, then derive qty hasil.
              const { onChange: onSourceQtyChange, ...sourceQtyField } = register(`details.${index}.source_qty`)
              const qtyVal = Number(d?.qty ?? 0)
              const src = sourceById.get(invId)
              const { options: outOptions, loading: outLoading } = optionsFor(invId)
              const yld = yieldFor(invId, puId)
              // Source units this row alone burns, and the whole-unit total the
              // API would use if source_qty is left blank.
              const srcConsumed = yld && yld > 0 ? qtyVal / yld : null
              const totalSrcConsumed = usedSourceIds.includes(invId)
                ? (watchedValues.details ?? []).reduce((sum, row) => {
                    if (Number(row?.base_product_inventory_id) !== invId) return sum
                    const y = yieldFor(invId, Number(row?.product_uom_id))
                    return y && y > 0 ? sum + Number(row?.qty ?? 0) / y : sum
                  }, 0)
                : null
              const impliedSourceQty = totalSrcConsumed != null ? Math.ceil(totalSrcConsumed) : null

              return (
                <div
                  key={field.id}
                  data-portioning-detail-index={index}
                  style={{
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    background: 'var(--background)', padding: 16,
                    display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0,
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
                        display: 'flex', alignItems: 'center', padding: 4, background: 'transparent',
                        border: 'none', cursor: detailFields.length <= 1 ? 'not-allowed' : 'pointer',
                        color: 'var(--destructive)', opacity: detailFields.length <= 1 ? 0.4 : 1,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div style={{ ...twoColGrid, alignItems: 'stretch' }}>
                    {/* FROM — source stock row */}
                    <div
                      style={{
                        ...columnBox,
                        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                        background: 'var(--surface)', padding: 14,
                      }}
                    >
                      <span style={{ ...sectionHeaderStyle, color: 'var(--accent)' }}>From · sumber</span>
                      <div style={fieldWrap}>
                        <label style={labelStyle}>
                          Baris sumber <span style={{ color: 'var(--destructive)' }}>*</span>
                        </label>
                        <Controller
                          name={`details.${index}.base_product_inventory_id`}
                          control={control}
                          render={({ field: f }) => (
                            <SearchableSelect
                              value={f.value ?? 0}
                              onChange={(v) => {
                                f.onChange(v)
                                // The allowed outputs belong to one source row, so
                                // clear the SKU when the source changes. source_qty
                                // goes back to 1 and qty is re-based — both were
                                // derived from the previous row and would be stale.
                                setValue(`details.${index}.product_uom_id`, 0)
                                setValue(`details.${index}.source_qty`, 1)
                                setValue(`details.${index}.qty`, 1)
                              }}
                              options={sourceOptions}
                              placeholder="Pilih baris sumber..."
                              searchPlaceholder="Cari produk/batch..."
                              loading={sourcesLoading}
                              error={rowErrors?.base_product_inventory_id?.message as string | undefined}
                            />
                          )}
                        />
                      </div>
                      <div style={fieldWrap}>
                        <label style={labelStyle}>Stok sumber</label>
                        <div style={roStyle}>
                          {src
                            ? `${formatNumber(src.stock)}${src.product_code ? ` · ${src.product_code}` : ''}${src.batch_code ? ` · ${src.batch_code}` : ''}`
                            : '—'}
                        </div>
                      </div>
                      <div style={fieldWrap}>
                        <label style={labelStyle}>
                          Source qty <span style={{ color: 'var(--foreground-subtle)', fontWeight: 400 }}>(opsional)</span>
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          placeholder={impliedSourceQty != null ? `Otomatis: ${formatNumber(impliedSourceQty)}` : 'Otomatis'}
                          {...sourceQtyField}
                          onChange={(e) => {
                            onSourceQtyChange(e)
                            deriveQtyFromSource(index, invId, puId, e.target.value)
                          }}
                          style={fieldInputStyle}
                        />
                        <span style={hintStyle}>
                          Jumlah unit sumber utuh yang dipakai potongan ini. Kosongkan untuk otomatis
                          (ceil total fraksi).
                        </span>
                      </div>
                    </div>

                    {/* TO — output SKU */}
                    <div
                      style={{
                        ...columnBox,
                        border: '1px solid var(--accent-light)', borderRadius: 'var(--radius-md)',
                        background: 'var(--surface)', padding: 14,
                      }}
                    >
                      <span style={{ ...sectionHeaderStyle, color: 'var(--accent)' }}>To · hasil</span>
                      <div style={fieldWrap}>
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
                                // A different SKU means a different yield, so the
                                // derived qty hasil has to be recomputed. Read
                                // source_qty fresh — the closure value is fine
                                // here (unchanged) but getValues never goes stale.
                                deriveQtyFromSource(
                                  index,
                                  invId,
                                  Number(v),
                                  getValues(`details.${index}.source_qty`),
                                )
                              }}
                              options={outOptions}
                              placeholder={
                                invId === 0
                                  ? 'Pilih baris sumber dulu...'
                                  : outLoading
                                    ? 'Memuat SKU hasil...'
                                    : outOptions.length === 0
                                      ? 'Sumber ini tidak bisa dipotong'
                                      : 'Pilih SKU hasil...'
                              }
                              searchPlaceholder="Cari SKU..."
                              loading={outLoading}
                              error={rowErrors?.product_uom_id?.message as string | undefined}
                            />
                          )}
                        />
                        {invId > 0 && !outLoading && outOptions.length === 0 && (
                          <span style={{ ...hintStyle, color: 'var(--warning)' }}>
                            Tidak ada cut table dari produk sumber ini — klik &quot;Buat Product Cut&quot;
                            untuk menambahkannya.
                          </span>
                        )}
                      </div>
                      <div style={fieldWrap}>
                        <label style={labelStyle}>
                          Qty hasil <span style={{ color: 'var(--destructive)' }}>*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          {...register(`details.${index}.qty`)}
                          style={{
                            ...fieldInputStyle,
                            color: 'var(--foreground)',
                            border: `1px solid ${rowErrors?.qty ? 'var(--destructive)' : 'var(--border)'}`,
                          }}
                        />
                        {rowErrors?.qty && <span style={errorTextStyle}>{rowErrors.qty.message}</span>}
                      </div>
                      <div style={fieldWrap}>
                        <label style={labelStyle}>Yield</label>
                        <div style={roStyle}>
                          {yld ? `1 sumber = ${formatNumber(yld)} hasil` : '—'}
                        </div>
                      </div>
                      {srcConsumed != null && (
                        <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                          Memakai {formatNumber(srcConsumed, 4)} unit sumber.
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      ...twoColGrid, gap: 16,
                      paddingTop: 14, borderTop: '1px dashed var(--border)',
                    }}
                  >
                    <div style={fieldWrap}>
                      <label style={labelStyle}>Batch Code</label>
                      <input
                        type="text"
                        placeholder="Opsional (default: kode portioning)"
                        {...register(`details.${index}.batch_code`)}
                        style={fieldInputStyle}
                      />
                    </div>
                    <div style={fieldWrap}>
                      <label style={labelStyle}>Expiry Date</label>
                      <input
                        type="date"
                        placeholder="Opsional (default: expiry sumber)"
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
        {preview && <PreviewPanel result={preview.result} stale={previewStale} />}

        {/* Form actions */}
        <div
          style={{
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10,
            position: 'sticky', bottom: 0, zIndex: 5,
            padding: '12px 0', background: 'var(--background)',
            borderTop: '1px solid var(--border)', flexWrap: 'wrap',
          }}
        >
          {insufficient && (
            <span style={{ fontSize: 12, color: 'var(--destructive)', marginRight: 'auto' }}>
              Stok kurang pada preview — Simpan &amp; Final dinonaktifkan.
            </span>
          )}
          <button
            type="button"
            onClick={() => router.push('/production/portioning')}
            style={{
              padding: '9px 20px', background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
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
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px',
              background: 'var(--surface)', border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              color: 'var(--accent)', opacity: previewMutation.isPending || isPending ? 0.7 : 1,
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
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px',
              background: 'var(--surface)', border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              color: 'var(--foreground)', opacity: isPending ? 0.7 : 1,
            }}
          >
            Simpan Draft
          </button>
          <button
            type="button"
            onClick={() => saveAs('final')}
            disabled={isPending || insufficient}
            title={insufficient ? 'Perbaiki stok lalu Preview ulang' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px',
              background: 'var(--accent)', color: 'white', border: 'none',
              borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500,
              cursor: isPending || insufficient ? 'not-allowed' : 'pointer',
              opacity: isPending || insufficient ? 0.5 : 1,
            }}
          >
            {isPending ? (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Save size={14} />
            )}
            {isPending ? 'Menyimpan...' : 'Simpan & Final'}
          </button>
        </div>
      </form>

      {/* Di luar <form> agar form cut tidak ter-nest di form portioning */}
      <ProductCutSheet
        open={cutModalOpen}
        onClose={() => setCutModalOpen(false)}
        variant="modal"
      />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
