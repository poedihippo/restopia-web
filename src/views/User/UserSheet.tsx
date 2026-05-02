'use client'

import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usersService } from '@/services/users.service'
import { rolesService } from '@/services/roles.service'
import { branchesService } from '@/services/branches.service'
import { X, Loader2 } from 'lucide-react'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().optional(),
  nik: z.string().optional(),
  type: z.enum(['superadmin', 'user']).default('user'),
  phone: z.string().optional(),
  birth: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  credit: z.coerce.number().min(0).optional(),
  branch_ids: z.array(z.number()).optional(),
  role_ids: z.array(z.number()).optional(),
})
type FormValues = z.infer<typeof schema>

interface UserSheetProps {
  open: boolean
  onClose: () => void
  editData?: {
    id: number
    name: string
    email: string
    nik?: string
    type?: 'superadmin' | 'user'
    phone?: string
    birth?: string
    gender?: 'male' | 'female'
    credit?: number
    branch_ids?: number[]
    role_ids?: number[]
  } | null
}

interface RoleOption {
  id: number
  name: string
}

interface BranchOption {
  id: number
  name: string
}

const toggleId = (arr: number[], id: number): number[] =>
  arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]

export default function UserSheet({ open, onClose, editData }: UserSheetProps) {
  const qc = useQueryClient()
  const isEditMode = !!editData

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: '',
      email: '',
      password: '',
      nik: '',
      type: 'user',
      phone: '',
      birth: '',
      gender: undefined,
      credit: 0,
      branch_ids: [],
      role_ids: [],
    },
  })

  const { data: rolesData } = useQuery({
    queryKey: ['roles-all'],
    queryFn: () => rolesService.list({ per_page: 100 } as any).then((r) => r.data),
  })
  const roles: RoleOption[] = (rolesData as any)?.data ?? []

  const { data: branchesData } = useQuery({
    queryKey: ['branches-all'],
    queryFn: () => branchesService.list({ per_page: 100 } as any).then((r) => r.data),
  })
  const branches: BranchOption[] = (branchesData as any)?.data ?? []

  useEffect(() => {
    if (editData) {
      reset({
        name: editData.name,
        email: editData.email,
        password: '',
        nik: editData.nik ?? '',
        type: 'user',
        phone: editData.phone ?? '',
        birth: editData.birth ?? '',
        gender: editData.gender ?? undefined,
        credit: editData.credit ?? 0,
        branch_ids: editData.branch_ids ?? [],
        role_ids: editData.role_ids ?? [],
      })
    } else {
      reset({
        name: '',
        email: '',
        password: '',
        nik: '',
        type: 'user',
        phone: '',
        birth: '',
        gender: undefined,
        credit: 0,
        branch_ids: [],
        role_ids: [],
      })
    }
  }, [editData, open, reset])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => usersService.create(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created')
      onClose()
    },
    onError: () => toast.error('Failed to create user'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => usersService.update(editData!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated')
      onClose()
    },
    onError: () => toast.error('Failed to update user'),
  })

  const onSubmit = (values: FormValues) => {
    if (isEditMode) {
      const payload: any = {
        name: values.name,
        email: values.email,
        nik: values.nik || undefined,
        type: values.type,
        phone: values.phone || undefined,
        birth: values.birth || undefined,
        gender: values.gender || undefined,
        credit: values.credit ?? 0,
        branch_ids: values.branch_ids?.length
          ? values.branch_ids : undefined,
        role_ids: values.role_ids?.length
          ? values.role_ids : undefined,
      }
      if (values.password && values.password.length > 0) {
        payload.password = values.password
      }
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(values)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

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
  const noteStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--foreground-subtle)',
    marginBottom: 6,
    display: 'block',
  }

  const pillButton = (
    selected: boolean,
    activeBg: string,
    activeColor: string,
    activeBorder: string
  ): React.CSSProperties => ({
    padding: '6px 16px',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    background: selected ? activeBg : 'var(--background)',
    color: selected ? activeColor : 'var(--foreground-muted)',
    border: selected ? `1px solid ${activeBorder}` : '1px solid var(--border)',
  })

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
          width: 540,
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
              {editData ? 'Edit User' : 'New User'}
            </h2>
            <p
              style={{
                fontSize: 12,
                color: 'var(--foreground-muted)',
                margin: '4px 0 0',
              }}
            >
              {editData ? 'Update user details and access' : 'Create a new system user'}
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

        {/* Form body */}
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
            {/* Row 1: name + email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Full Name
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <input
                  {...register('name')}
                  placeholder="e.g. Budi Santoso"
                  style={errors.name ? inputErrorStyle : inputStyle}
                />
                {errors.name && <div style={errorStyle}>{errors.name.message}</div>}
              </div>
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                  Email
                  <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>
                </label>
                <input
                  type="email"
                  {...register('email')}
                  placeholder="e.g. budi@email.com"
                  style={errors.email ? inputErrorStyle : inputStyle}
                />
                {errors.email && <div style={errorStyle}>{errors.email.message}</div>}
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                {isEditMode ? 'New Password (leave blank to keep current)' : 'Password'}
                {!isEditMode && <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>*</span>}
              </label>
              <input
                type="password"
                {...register('password')}
                placeholder={
                  isEditMode ? 'Enter new password to change' : 'Minimum 8 characters'
                }
                style={errors.password ? inputErrorStyle : inputStyle}
              />
              {errors.password && <div style={errorStyle}>{errors.password.message}</div>}
            </div>

            {/* Row 2: nik + phone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>NIK (ID Number)</label>
                <input
                  {...register('nik')}
                  placeholder="e.g. 32011234567807"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input
                  {...register('phone')}
                  placeholder="e.g. 08123456789"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Credit limit */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Credit Limit (Rp)</label>
              <input
                type="number"
                min={0}
                {...register('credit', { valueAsNumber: true })}
                placeholder="e.g. 200000"
                style={inputStyle}
              />
              <span style={{ fontSize: 11, color: 'var(--foreground-subtle)' }}>
                Maximum credit (hutang) this user can use
              </span>
            </div>

            {/* Row 3: gender */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Gender</label>
                <Controller
                  control={control}
                  name="gender"
                  render={({ field }) => (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => field.onChange('male')}
                        style={pillButton(
                          field.value === 'male',
                          'var(--info-bg)',
                          'var(--info)',
                          'var(--info)'
                        )}
                      >
                        Male
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange('female')}
                        style={pillButton(
                          field.value === 'female',
                          'var(--accent-light-bg)',
                          'var(--accent)',
                          'var(--accent)'
                        )}
                      >
                        Female
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange(undefined)}
                        style={{
                          padding: '6px 10px',
                          background: 'none',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12,
                          color: 'var(--foreground-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                />
              </div>
            </div>

            {/* Birth */}
            <div>
              <label style={labelStyle}>Date of Birth</label>
              <input type="date" {...register('birth')} style={inputStyle} />
            </div>

            {/* Branches */}
            <div>
              <label style={labelStyle}>Branches</label>
              <span style={noteStyle}>Select one or more branches this user belongs to</span>
              <Controller
                control={control}
                name="branch_ids"
                render={({ field }) => {
                  const value = field.value ?? []
                  if (branches.length === 0) {
                    return (
                      <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                        No branches available
                      </span>
                    )
                  }
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {branches.map((branch) => {
                        const selected = value.includes(branch.id)
                        return (
                          <button
                            type="button"
                            key={branch.id}
                            onClick={() => field.onChange(toggleId(value, branch.id))}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 'var(--radius-md)',
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: 'pointer',
                              background: selected ? 'var(--accent)' : 'var(--background)',
                              color: selected ? 'white' : 'var(--foreground-muted)',
                              border: selected
                                ? '1px solid var(--accent)'
                                : '1px solid var(--border)',
                            }}
                          >
                            {branch.name}
                          </button>
                        )
                      })}
                    </div>
                  )
                }}
              />
            </div>

            {/* Roles */}
            <div>
              <label style={labelStyle}>Roles</label>
              <span style={noteStyle}>Select roles to assign permissions</span>
              <Controller
                control={control}
                name="role_ids"
                render={({ field }) => {
                  const value = field.value ?? []
                  if (roles.length === 0) {
                    return (
                      <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                        No roles available
                      </span>
                    )
                  }
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {roles.map((role) => {
                        const selected = value.includes(role.id)
                        return (
                          <button
                            type="button"
                            key={role.id}
                            onClick={() => field.onChange(toggleId(value, role.id))}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 'var(--radius-md)',
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: 'pointer',
                              background: selected
                                ? 'var(--accent-light-bg)'
                                : 'var(--background)',
                              color: selected ? 'var(--accent)' : 'var(--foreground-muted)',
                              border: selected
                                ? '1px solid var(--accent)'
                                : '1px solid var(--border)',
                            }}
                          >
                            {role.name}
                          </button>
                        )
                      })}
                    </div>
                  )
                }}
              />
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
              {editData ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
