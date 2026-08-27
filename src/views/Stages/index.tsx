'use client'
import { formatDateShort, formatDateTime } from '@/utils/date'

import React, { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { stagesService } from '@/services/stages.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Eye,
  X,
  Loader2,
} from 'lucide-react'

interface Stage {
  id: number
  name: string
  code: string
  is_active?: boolean
  created_at?: string
}

const schema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  code: z
    .string()
    .min(1, 'Kode wajib diisi')
    .regex(/^\S+$/, 'Kode tidak boleh mengandung spasi'),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

interface StageSheetProps {
  open: boolean
  onClose: () => void
  editData?: Stage | null
}

function StageSheet({ open, onClose, editData }: StageSheetProps) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { name: '', code: '', is_active: true },
  })

  useEffect(() => {
    if (open) {
      if (editData) {
        reset({ name: editData.name, code: editData.code, is_active: editData.is_active ?? true })
      } else {
        reset({ name: '', code: '', is_active: true })
      }
    }
  }, [open, editData, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => stagesService.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stages'] })
      toast.success('Stage berhasil dibuat')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal membuat stage'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => stagesService.update(editData!.id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stages'] })
      toast.success('Stage berhasil diperbarui')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal memperbarui stage'),
  })

  const onSubmit = (values: FormValues) => {
    if (editData) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
      {/* Overlay */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />

      {/* Sheet panel */}
      <div
        style={{
          position: 'relative',
          zIndex: 50,
          width: 380,
          height: '100%',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
            {editData ? 'Edit Stage' : 'Stage Baru'}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 'var(--radius-sm)', color: 'var(--foreground-muted)', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form body */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, fontSize: 11, color: 'var(--foreground-subtle)' }}>
            <span style={{ color: 'var(--destructive)' }}>*</span>
            <span>Field wajib diisi</span>
          </div>

          {/* Name field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 2 }}>
              Nama
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <input
              {...register('name')}
              placeholder="e.g. Chilled Storage"
              style={{
                width: '100%',
                padding: '9px 12px',
                border: `1px solid ${errors.name ? 'var(--destructive)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                color: 'var(--foreground)',
                background: 'var(--surface)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                boxSizing: 'border-box',
              }}
            />
            {errors.name && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.name.message}</span>}
            <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>Label yang ditampilkan di UI</span>
          </div>

          {/* Code field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 2 }}>
              Kode
              <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
            </label>
            <input
              {...register('code')}
              placeholder="e.g. chilled"
              style={{
                width: '100%',
                padding: '9px 12px',
                border: `1px solid ${errors.code ? 'var(--destructive)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                color: 'var(--foreground)',
                background: 'var(--surface)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                boxSizing: 'border-box',
              }}
            />
            {errors.code && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.code.message}</span>}
            <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
              Nilai mesin yang dipakai transfer dimensi (tanpa spasi) — bukan label tampilan
            </span>
          </div>

          {/* Active toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Status</label>
            <Controller
              name="is_active"
              control={control}
              render={({ field }) => (
                <div style={{ display: 'flex', gap: 8 }}>
                  {([true, false] as const).map((val) => {
                    const isSelected = field.value === val
                    return (
                      <button
                        key={String(val)}
                        type="button"
                        onClick={() => field.onChange(val)}
                        style={{
                          padding: '6px 16px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                          background: isSelected
                            ? val
                              ? 'var(--success-bg)'
                              : 'var(--destructive-bg)'
                            : 'var(--background)',
                          color: isSelected ? (val ? 'var(--success)' : 'var(--destructive)') : 'var(--foreground-muted)',
                          border: isSelected
                            ? `1px solid ${val ? 'var(--success)' : 'var(--destructive)'}`
                            : '1px solid var(--border)',
                        }}
                      >
                        {val ? 'Aktif' : 'Nonaktif'}
                      </button>
                    )
                  })}
                </div>
              )}
            />
          </div>
        </form>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
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
            Batal
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSubmit(onSubmit)}
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {editData ? 'Simpan Perubahan' : 'Buat Stage'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default function StagesView() {
  const queryClient = useQueryClient()
  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = isSuperadmin || hasPermission('stage.read')
  const canCreate = isSuperadmin || hasPermission('stage.create')
  const canEdit = isSuperadmin || hasPermission('stage.update')
  const canDelete = isSuperadmin || hasPermission('stage.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(1000)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<Stage | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<Stage | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['stages', page, perPage, debouncedSearch],
    enabled: canRead,
    queryFn: () =>
      stagesService
        .list({
          page,
          per_page: perPage,
          sort: '-id',
          'filter[search]': debouncedSearch || undefined,
        })
        .then((r) => r.data),
  })

  const items: Stage[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => stagesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stages'] })
      toast.success('Stage berhasil dihapus')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal menghapus stage'),
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
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
            Stages
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0 0' }}>
            Kelola stage yang dipakai pada transfer dimensi stok
          </p>
        </div>

        {canCreate && (
          <button
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
            }}
          >
            <Plus size={15} />
            Stage Baru
          </button>
        )}
      </div>

      {!canRead ? (
        <div
          style={{
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning)',
            borderRadius: 'var(--radius-lg)',
            padding: 24,
            color: 'var(--warning)',
            fontSize: 13,
          }}
        >
          Anda tidak memiliki izin untuk melihat stages.
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--foreground-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari stage..."
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 32px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  color: 'var(--foreground)',
                  background: 'var(--surface)',
                  outline: 'none',
                  fontFamily: 'var(--font-sans)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                  {[
                    { label: 'Kode', width: 120 },
                    { label: 'Nama', width: undefined },
                    { label: 'Aktif', width: 100 },
                    { label: 'Dibuat', width: 140 },
                    { label: '', width: 80 },
                  ].map((col, i) => (
                    <th
                      key={i}
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--foreground-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: 0.6,
                        width: col.width,
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '48px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        {[60, 40, 80, 50, 70].map((w, i) => (
                          <div
                            key={i}
                            style={{
                              height: 16,
                              borderRadius: 4,
                              background: 'var(--border)',
                              width: `${w}%`,
                              animation: 'pulse 1.5s ease-in-out infinite',
                            }}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                )}

                {isError && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 48, fontSize: 13, color: 'var(--destructive)' }}>
                      Gagal memuat data stages
                    </td>
                  </tr>
                )}

                {!isLoading && !isError && items.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <Layers size={32} style={{ color: 'var(--foreground-subtle)' }} />
                        <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Belum ada stage</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  items.map((item) => (
                    <tr
                      key={item.id}
                      onMouseEnter={() => setHoveredRow(item.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: hoveredRow === item.id ? 'var(--background)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 8px',
                            background: 'var(--accent-light-bg)',
                            color: 'var(--accent)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: 0.5,
                            fontFamily: 'monospace',
                          }}
                        >
                          {item.code}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                        {item.name}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 10px',
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 500,
                            background: item.is_active === false ? 'var(--destructive-bg)' : 'var(--success-bg)',
                            color: item.is_active === false ? 'var(--destructive)' : 'var(--success)',
                          }}
                        >
                          {item.is_active === false ? 'Nonaktif' : 'Aktif'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--foreground-muted)' }}>
                        {item.created_at ? formatDateShort(item.created_at) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setSelectedItem(item)}
                            style={{
                              padding: 6,
                              background: 'none',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              color: 'var(--foreground-muted)',
                              display: 'flex',
                            }}
                          >
                            <Eye size={14} />
                          </button>
                          {canEdit && (
                            <button
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
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteConfirmId(item.id)}
                              style={{
                                padding: 6,
                                background: 'none',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                color: 'var(--destructive)',
                                display: 'flex',
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

          {/* Delete confirm dialog */}
          {deleteConfirmId !== null && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div
                onClick={() => setDeleteConfirmId(null)}
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }}
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
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>Hapus Stage</h3>
                <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px' }}>
                  Menghapus stage ini dapat memengaruhi data stok yang masih memakainya.
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
                    Batal
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
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      opacity: deleteMutation.isPending ? 0.7 : 1,
                    }}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Detail panel */}
          {selectedItem && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
              <div
                onClick={() => setSelectedItem(null)}
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }}
              />
              <div
                style={{
                  position: 'relative',
                  zIndex: 50,
                  width: 420,
                  height: '100%',
                  background: 'var(--surface)',
                  borderLeft: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: 'var(--shadow-lg)',
                  overflowY: 'auto',
                }}
              >
                <div
                  style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>
                    Detail Stage
                  </h2>
                  <button
                    onClick={() => setSelectedItem(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
                  >
                    <X size={18} color="var(--foreground-muted)" />
                  </button>
                </div>
                <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { label: 'ID', value: selectedItem.id },
                    { label: 'Kode', value: selectedItem.code },
                    { label: 'Nama', value: selectedItem.name },
                    { label: 'Status', value: selectedItem.is_active === false ? 'Nonaktif' : 'Aktif' },
                    {
                      label: 'Dibuat',
                      value: selectedItem.created_at ? formatDateTime(selectedItem.created_at) : '—',
                    },
                  ].map((f) => (
                    <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--foreground-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.6px',
                        }}
                      >
                        {f.label}
                      </span>
                      <span style={{ fontSize: 14, color: 'var(--foreground)' }}>{f.value ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Sheet */}
      <StageSheet
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
  )
}
