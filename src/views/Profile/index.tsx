'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Eye, EyeOff, KeyRound, Mail, Building2, UserRound, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/auth.service';
import { toastMutationApiError } from '@/utils/apiError';
import IdCard, { parseApiDate } from './IdCard';

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  phone: z.string().trim().max(50).optional(),
  birth: z.string().optional(),
  gender: z.enum(['male', 'female', '']).optional(),
});
type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z.string().min(8, 'Use at least 8 characters').max(72),
    new_password_confirmation: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.new_password === v.new_password_confirmation, {
    path: ['new_password_confirmation'],
    message: 'Passwords do not match',
  })
  .refine((v) => v.new_password !== v.current_password, {
    path: ['new_password'],
    message: 'New password must differ from the current one',
  });
type PasswordForm = z.infer<typeof passwordSchema>;

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--foreground-muted)',
};
const inputStyle: React.CSSProperties = { width: '100%', height: 36, fontSize: 13 };
const errorStyle: React.CSSProperties = { fontSize: 11.5, color: 'var(--destructive)' };

function Field({
  label,
  error,
  hint,
  children,
  span,
}: {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  span?: boolean;
}) {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        gridColumn: span ? '1 / -1' : undefined,
        minWidth: 0,
      }}
    >
      <span style={labelStyle}>{label}</span>
      {children}
      {error ? <span style={errorStyle}>{error}</span> : hint}
    </label>
  );
}

function PasswordInput({ invalid, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className="v2-input"
        style={{
          ...inputStyle,
          paddingRight: 36,
          borderColor: invalid ? 'var(--destructive)' : undefined,
        }}
      />
      <button
        type="button"
        data-fast-click
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
        className="profile-eye"
        style={{
          position: 'absolute',
          right: 4,
          top: 4,
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
        }}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function Chip({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'accent' | 'warning' }) {
  const tones = {
    neutral: { background: 'var(--background)', color: 'var(--foreground-muted)', border: '1px solid var(--border)' },
    accent: { background: 'var(--accent-light-bg)', color: 'var(--accent)', border: '1px solid transparent' },
    warning: { background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid transparent' },
  } as const;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 9px',
        borderRadius: 99,
        fontSize: 11.5,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        ...tones[tone],
      }}
    >
      {children}
    </span>
  );
}

/** Formats an API date for display; empty when missing/invalid. */
const fmtDate = (v: unknown, opts: Intl.DateTimeFormatOptions) =>
  parseApiDate(v)?.toLocaleDateString('en-GB', opts) ?? '';

const toProfileForm = (user: any): ProfileForm => ({
  name: user?.name ?? '',
  email: user?.email ?? '',
  phone: user?.phone ?? '',
  birth: user?.birth ? String(user.birth).slice(0, 10) : '',
  gender: user?.gender === 'male' || user?.gender === 'female' ? user.gender : '',
});

export default function ProfileView() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<'details' | 'profile' | 'password'>('details');

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema) as any,
    defaultValues: toProfileForm(user),
  });
  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema) as any,
    defaultValues: { current_password: '', new_password: '', new_password_confirmation: '' },
  });

  useEffect(() => {
    if (user) profileForm.reset(toProfileForm(user));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const profileMutation = useMutation({
    mutationFn: (v: ProfileForm) =>
      authService.updateProfile({
        name: v.name.trim(),
        email: v.email.trim(),
        phone: v.phone?.trim() || null,
        birth: v.birth || null,
        gender: v.gender || null,
      }),
    onSuccess: async () => {
      await refreshUser();
      toast.success('Profile updated');
      setTab('details');
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update profile'),
  });

  const passwordMutation = useMutation({
    mutationFn: (v: PasswordForm) => authService.changePassword(v),
    onSuccess: () => {
      passwordForm.reset();
      toast.success('Password changed');
      setTab('details');
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to change password'),
  });

  const pErr = profileForm.formState.errors;
  const pwErr = passwordForm.formState.errors;
  const isDirty = profileForm.formState.isDirty;
  const gender = profileForm.watch('gender');
  const newPassword = passwordForm.watch('new_password') ?? '';

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() || 'U';
  const roles = user?.roles ?? [];
  const branches = user?.branches ?? [];
  const isSuperadmin = user?.type === 'superadmin';

  return (
    <div style={{ padding: '24px 28px 40px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <style>{`
        .profile-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        :root[data-ui="v2"] .profile-tab[aria-pressed="true"] { background: var(--accent-light-bg); color: var(--accent); border-color: transparent; font-weight: 600; }
        :root[data-ui="v2"] .profile-tab[aria-pressed="true"]:hover:not(:disabled) { background: color-mix(in srgb, var(--accent-light) 30%, var(--accent-light-bg)); border-color: color-mix(in srgb, var(--accent-light) 45%, transparent); }
        .profile-eye { color: var(--foreground-subtle); transition: background 150ms ease, color 150ms ease; }
        .profile-eye:hover { background: var(--surface-muted, var(--background)) !important; color: var(--foreground); }
        .profile-top { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 20px; align-items: start; margin-bottom: 20px; }
        .profile-meta { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: var(--foreground-muted); min-width: 0; }
        .profile-meta > span { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .profile-meta > span > svg { flex-shrink: 0; }
        .profile-meta > span > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .profile-detail-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13px 0; border-bottom: 1px solid var(--border); min-width: 0; }
        .profile-detail-row dt { font-size: 12.5px; color: var(--foreground-muted); flex-shrink: 0; }
        .profile-detail-row dd { margin: 0; font-size: 13px; font-weight: 600; color: var(--foreground); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .profile-detail-row dd[data-empty] { color: var(--foreground-subtle); font-weight: 400; }
        .profile-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 40px; margin: 0; padding: 4px 22px 10px; border-top: 1px solid var(--border); }
        .profile-details > .profile-detail-row:nth-last-child(-n + 2) { border-bottom: none; }
        @media (max-width: 900px) { .profile-details { grid-template-columns: minmax(0, 1fr); } .profile-details > .profile-detail-row:nth-last-child(2) { border-bottom: 1px solid var(--border); } }
        @media (max-width: 760px) { .profile-top { grid-template-columns: minmax(0, 1fr); } .profile-idcard { max-width: 320px; } }
        @media (max-width: 560px) { .profile-fields { grid-template-columns: minmax(0, 1fr); } .profile-identity { flex-direction: column; align-items: flex-start !important; } }
      `}</style>

      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 24,
            fontWeight: 500,
            margin: 0,
            color: 'var(--foreground)',
          }}
        >
          My Profile
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--foreground-muted)' }}>
          Manage your personal details and sign-in password.
        </p>
      </div>

      {/* ID card (left) + personal info (right) */}
      <div className="profile-top">
        <IdCard user={user} />

        <section
          className="v2-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            minWidth: 0,
          }}
        >
          <div className="profile-identity" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '14px 18px', padding: 22 }}>
            <div
              aria-hidden
              style={{
                width: 64,
                height: 64,
                flexShrink: 0,
                borderRadius: 'var(--radius-xl)',
                background: 'var(--accent)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontSize: 28,
                fontWeight: 500,
              }}
            >
              {initial}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: '1 1 280px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>{user?.name ?? '—'}</span>
                <Chip tone={isSuperadmin ? 'warning' : 'accent'}>{isSuperadmin ? 'Superadmin' : 'User'}</Chip>
              </div>
              <div className="profile-meta">
                <span>
                  <Mail size={13} />
                  <span>{user?.email ?? '—'}</span>
                </span>
                <span>
                  <Building2 size={13} />
                  <span>
                    {user?.branch?.name ?? 'No active branch'}
                    {user?.branch?.company?.name ? ` · ${user.branch.company.name}` : ''}
                  </span>
                </span>
              </div>
            </div>
            <div className="profile-tabs" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {([
                ['profile', 'Update personal information', <UserRound key="i" size={14} />],
                ['password', 'Change password', <KeyRound key="i" size={14} />],
              ] as const).map(([key, label, icon]) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className="v2-btn v2-btn-ghost profile-tab"
                    aria-pressed={active}
                    onClick={() => setTab(active ? 'details' : key)}
                  >
                    {icon}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {tab === 'details' && (
            <>
          {/* Details */}
          <dl className="profile-details">
            {[
              ['NIK', user?.nik],
              ['Phone', user?.phone],
              ['Date of birth', fmtDate(user?.birth, { day: 'numeric', month: 'short', year: 'numeric' })],
              ['Gender', user?.gender ? (user.gender === 'male' ? 'Male' : 'Female') : ''],
              ['Active branch', user?.branch?.name],
              ['Company', user?.branch?.company?.name],
              ['Member since', fmtDate(user?.created_at, { day: 'numeric', month: 'long', year: 'numeric' })],
              ['Account type', isSuperadmin ? 'Superadmin' : 'User'],
            ].map(([label, value]) => (
              <div key={label as string} className="profile-detail-row">
                <dt>{label}</dt>
                <dd data-empty={!value || undefined} title={value ? String(value) : undefined}>
                  {value || '—'}
                </dd>
              </div>
            ))}
          </dl>

          {(roles.length > 0 || branches.length > 0) && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                marginTop: 'auto',
                padding: '14px 22px',
                borderTop: '1px solid var(--border)',
                background: 'var(--surface-muted, var(--background))',
                borderRadius: '0 0 var(--radius-xl) var(--radius-xl)',
              }}
            >
              {roles.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ ...labelStyle, width: 96 }}>Roles</span>
                  {roles.map((r: any) => (
                    <Chip key={r.id ?? r.name}>{r.name}</Chip>
                  ))}
                </div>
              )}
              {branches.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ ...labelStyle, width: 96 }}>Branch access</span>
                  {branches.slice(0, 6).map((b: any) => (
                    <Chip key={b.id ?? b.name}>{b.name}</Chip>
                  ))}
                  {branches.length > 6 && <Chip>+{branches.length - 6} more</Chip>}
                </div>
              )}
            </div>
          )}
            </>
          )}

          {tab === 'profile' && (
            <form
              onSubmit={profileForm.handleSubmit((v) => profileMutation.mutate(v))}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, borderTop: '1px solid var(--border)' }}
              noValidate
            >
          <div className="profile-fields" style={{ padding: 22 }}>
            <Field label="Full name" error={pErr.name?.message} span>
              <input {...profileForm.register('name')} className="v2-input" style={inputStyle} autoComplete="name" />
            </Field>
            <Field label="Email" error={pErr.email?.message} hint={<span style={{ fontSize: 11.5, color: 'var(--foreground-subtle)' }}>Used to sign in.</span>}>
              <input {...profileForm.register('email')} type="email" className="v2-input" style={inputStyle} autoComplete="email" />
            </Field>
            <Field label="Phone" error={pErr.phone?.message}>
              <input {...profileForm.register('phone')} type="tel" className="v2-input" style={inputStyle} autoComplete="tel" placeholder="08xx xxxx xxxx" />
            </Field>
            <Field label="Date of birth" error={pErr.birth?.message}>
              <input {...profileForm.register('birth')} type="date" className="v2-input" style={inputStyle} />
            </Field>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={labelStyle}>Gender</span>
              <div className="v2-seg" role="tablist" style={{ height: 36, alignSelf: 'flex-start', alignItems: 'center' }}>
                {(['male', 'female'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="tab"
                    aria-selected={gender === g}
                    onClick={() =>
                      profileForm.setValue('gender', gender === g ? '' : g, { shouldDirty: true })
                    }
                    style={{ height: 28, padding: '0 16px' }}
                  >
                    {g === 'male' ? 'Male' : 'Female'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 'auto',
              padding: '14px 22px',
              borderTop: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              className="v2-btn v2-btn-ghost"
              onClick={() => {
                profileForm.reset(toProfileForm(user));
                setTab('details');
              }}
              disabled={profileMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="v2-btn v2-btn-primary"
              disabled={!isDirty || profileMutation.isPending}
            >
              {profileMutation.isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Save changes
            </button>
          </div>
            </form>
          )}

          {tab === 'password' && (
            <form
              onSubmit={passwordForm.handleSubmit((v) => passwordMutation.mutate(v))}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, borderTop: '1px solid var(--border)' }}
              noValidate
            >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 22, maxWidth: 520 }}>
            <Field label="Current password" error={pwErr.current_password?.message}>
              <PasswordInput
                {...passwordForm.register('current_password')}
                autoComplete="current-password"
                invalid={!!pwErr.current_password}
              />
            </Field>
            <Field
              label="New password"
              error={pwErr.new_password?.message}
              hint={
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11.5,
                    color: newPassword.length >= 8 ? 'var(--success)' : 'var(--foreground-subtle)',
                  }}
                >
                  <Check size={12} /> At least 8 characters
                </span>
              }
            >
              <PasswordInput
                {...passwordForm.register('new_password')}
                autoComplete="new-password"
                invalid={!!pwErr.new_password}
              />
            </Field>
            <Field label="Confirm new password" error={pwErr.new_password_confirmation?.message}>
              <PasswordInput
                {...passwordForm.register('new_password_confirmation')}
                autoComplete="new-password"
                invalid={!!pwErr.new_password_confirmation}
              />
            </Field>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 'auto',
              padding: '14px 22px',
              borderTop: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              className="v2-btn v2-btn-ghost"
              onClick={() => {
                passwordForm.reset();
                setTab('details');
              }}
              disabled={passwordMutation.isPending}
            >
              Cancel
            </button>
            <button type="submit" className="v2-btn v2-btn-primary" disabled={passwordMutation.isPending}>
              {passwordMutation.isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Update password
            </button>
          </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
