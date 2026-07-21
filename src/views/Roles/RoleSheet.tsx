'use client'

import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { rolesService } from '@/services/roles.service'
import { permissionsService } from '@/services/permissions.service'
import { X, Loader2, Search } from 'lucide-react'

const schema = z.object({
  name: z.string().min(1, 'Role name is required'),
  permission_ids: z.array(z.number()).optional(),
})
type FormValues = z.infer<typeof schema>

interface RoleSheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    name: string
    permission_ids?: number[]
    permissions?: Array<{ id: number; name: string }>
  } | null
}

interface Permission {
  id: number
  name: string
}

export default function RoleSheet({ open, onClose, editData }: RoleSheetProps) {
  const qc = useQueryClient()
  const [permissionSearch, setPermissionSearch] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { name: '', permission_ids: [] },
  })

  const { data: permissionsData } = useQuery({
    queryKey: ['permissions-all'],
    queryFn: () => permissionsService.list().then((r) => r.data),
  })

  const permissionGroupsRaw: Array<{ group: string; data: Permission[] }> = (() => {
    const root =
      (permissionsData as any)?.data ??
      (Array.isArray(permissionsData) ? permissionsData : null)
    if (!Array.isArray(root)) return []
    return (root as any[])
      .filter((g) => g && typeof g.group === 'string' && Array.isArray(g.data))
      .map((g) => ({
        group: g.group as string,
        data: (g.data as any[])
          .filter((p) => p && typeof p.name === 'string')
          .map((p) => ({ id: p.id as number, name: p.name as string })),
      }))
  })()
  const allPermissions: Permission[] = permissionGroupsRaw.flatMap((g) => g.data)

  useEffect(() => {
    if (editData) {
      reset({
        name: editData.name,
        permission_ids:
          editData.permissions?.map((p) => p.id) ?? editData.permission_ids ?? [],
      })
    } else {
      reset({ name: '', permission_ids: [] })
    }
    setPermissionSearch('')
  }, [editData, open, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => rolesService.create(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role created')
      onClose()
    },
    onError: () => toast.error('Failed to create role'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => rolesService.update(editData!.id, data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role updated')
      onClose()
    },
    onError: () => toast.error('Failed to update role'),
  })

  const onSubmit = (data: FormValues) => {
    if (editData) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const watchPermissionIds: number[] = watch('permission_ids') ?? []

  const togglePermission = (id: number) => {
    const current = watchPermissionIds
    if (current.includes(id)) {
      setValue(
        'permission_ids',
        current.filter((x) => x !== id),
        { shouldDirty: true }
      )
    } else {
      setValue('permission_ids', [...current, id], { shouldDirty: true })
    }
  }

  const togglePermissionGroup = (perms: Permission[]) => {
    const permIds = perms.map((p) => p.id)
    const allSelected = permIds.every((id) => watchPermissionIds.includes(id))
    
    if (allSelected) {
      setValue(
        'permission_ids',
        watchPermissionIds.filter((id) => !permIds.includes(id)),
        { shouldDirty: true }
      )
    } else {
      const newIds = Array.from(new Set([...watchPermissionIds, ...permIds]))
      setValue('permission_ids', newIds, { shouldDirty: true })
    }
  }

  const selectAll = () => {
    setValue('permission_ids', allPermissions.map((p) => p.id), { shouldDirty: true })
  }
  const clearAll = () => {
    setValue('permission_ids', [], { shouldDirty: true })
  }

  const permissionGroups: Record<string, Permission[]> = permissionGroupsRaw.reduce(
    (acc, g) => {
      acc[g.group] = g.data
      return acc
    },
    {} as Record<string, Permission[]>
  )

  const filteredPermissions = allPermissions.filter((p) =>
    (p.name ?? '').toLowerCase().includes(permissionSearch.toLowerCase())
  )

  if (!open) return null

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    color: 'var(--foreground)',
    background: 'var(--surface)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  }
  const inputErrorStyle: React.CSSProperties = {
    ...inputStyle,
    border: '1px solid var(--destructive)',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--foreground)',
    marginBottom: 4,
    display: 'block',
  }
  const errorStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--destructive)',
    marginTop: 4,
  }

  const smallBtnStyle: React.CSSProperties = {
    padding: '4px 10px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 11,
    color: 'var(--foreground-muted)',
    cursor: 'pointer',
  }

  const renderPermissionRow = (perm: Permission, showBorder: boolean) => {
    const selected = watchPermissionIds.includes(perm.id)
    return (
      <div
        key={perm.id}
        onClick={() => togglePermission(perm.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          cursor: 'pointer',
          borderBottom: showBorder ? '1px solid var(--border)' : 'none',
          background: selected ? 'var(--accent-light-bg)' : 'transparent',
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            flexShrink: 0,
            border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
            background: selected ? 'var(--accent)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected && (
            <span style={{ color: 'white', fontSize: 10, lineHeight: 1 }}>✓</span>
          )}
        </div>
        <span
          style={{
            fontSize: 12,
            color: selected ? 'var(--accent)' : 'var(--foreground)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {perm.name}
        </span>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }}
      />
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 50,
          width: 560,
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
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 600,
                margin: 0,
                color: 'var(--foreground)',
              }}
            >
              {editData ? 'Edit Role' : 'New Role'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
              {editData ? 'Update role and permissions' : 'Create a role and assign permissions'}
            </p>
          </div>
          <button
            onClick={onClose}
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
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--foreground-subtle)' }}>
              <span style={{ color: 'var(--destructive)' }}>*</span>
              <span>Required fields</span>
            </div>
            {/* Name */}
            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Role Name
                <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
              </label>
              <input
                {...register('name')}
                placeholder="e.g. Cashier, Warehouse Manager"
                style={errors.name ? inputErrorStyle : inputStyle}
              />
              {errors.name && <div style={errorStyle}>{errors.name.message}</div>}
            </div>

            {/* Permissions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--foreground)',
                    }}
                  >
                    Permissions
                  </label>
                  <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                    {watchPermissionIds.length} of {allPermissions.length} selected
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={selectAll} style={smallBtnStyle}>
                    Select All
                  </button>
                  <button type="button" onClick={clearAll} style={smallBtnStyle}>
                    Clear
                  </button>
                </div>
              </div>

              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--foreground-muted)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  value={permissionSearch}
                  onChange={(e) => setPermissionSearch(e.target.value)}
                  placeholder="Search permissions..."
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 30px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                    background: 'var(--surface)',
                    outline: 'none',
                    fontFamily: 'var(--font-sans)',
                    boxSizing: 'border-box',
                    color: 'var(--foreground)',
                  }}
                />
              </div>

              {/* Permissions grid */}
              <div
                style={{
                  maxHeight: 320,
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)',
                }}
              >
                {allPermissions.length === 0 ? (
                  <div
                    style={{
                      padding: 20,
                      textAlign: 'center',
                      fontSize: 13,
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    No permissions available
                  </div>
                ) : permissionSearch === '' ? (
                  Object.entries(permissionGroups).map(([group, perms]) => (
                    <div key={group}>
                      <div
                        onClick={() => togglePermissionGroup(perms)}
                        style={{
                          padding: '8px 12px',
                          background: 'var(--background)',
                          borderBottom: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 3,
                            flexShrink: 0,
                            border: `2px solid ${
                              perms.every((p) => watchPermissionIds.includes(p.id))
                                ? 'var(--accent)'
                                : perms.some((p) => watchPermissionIds.includes(p.id))
                                  ? 'var(--accent)'
                                  : 'var(--border)'
                            }`,
                            background: perms.every((p) => watchPermissionIds.includes(p.id))
                              ? 'var(--accent)'
                              : perms.some((p) => watchPermissionIds.includes(p.id))
                                ? 'var(--accent)'
                                : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {perms.every((p) => watchPermissionIds.includes(p.id)) && (
                            <span style={{ color: 'white', fontSize: 10, lineHeight: 1 }}>✓</span>
                          )}
                          {!perms.every((p) => watchPermissionIds.includes(p.id)) &&
                            perms.some((p) => watchPermissionIds.includes(p.id)) && (
                              <span style={{ color: 'white', fontSize: 14, lineHeight: 1 }}>-</span>
                            )}
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: 'var(--foreground-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                          }}
                        >
                          {group}
                        </span>
                      </div>
                      {perms.map((perm, i) =>
                        renderPermissionRow(perm, i < perms.length - 1)
                      )}
                    </div>
                  ))
                ) : filteredPermissions.length === 0 ? (
                  <div
                    style={{
                      padding: 20,
                      textAlign: 'center',
                      fontSize: 13,
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    No permissions match your search
                  </div>
                ) : (
                  filteredPermissions.map((perm, i) =>
                    renderPermissionRow(perm, i < filteredPermissions.length - 1)
                  )
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: '8px 18px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 500,
                color: 'white',
                cursor: isPending ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: isPending ? 0.75 : 1,
              }}
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {editData ? 'Save Changes' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
