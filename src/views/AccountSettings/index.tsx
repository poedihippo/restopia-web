'use client'
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { accountSettingsService } from '@/services/account-settings.service'
import AccountSettingSheet from './AccountSettingSheet'
import { Settings, Pencil, Search } from 'lucide-react'

export default function AccountSettingsView() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<any | null>(null)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['account-settings'],
    queryFn: () => accountSettingsService.list({ per_page: 100, include: 'account_setting_key_entity,chart_of_account' } as any).then(r => r.data),
  })

  const items: any[] = (data as any)?.data ?? []
  
  const filteredItems = items.filter((item: any) => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
        item.account_setting_key_entity?.label?.toLowerCase().includes(term) ||
        item.account_setting_key_entity?.key?.toLowerCase().includes(term) ||
        item.account_setting_key_entity?.module?.toLowerCase().includes(term) ||
        item.chart_of_account?.name?.toLowerCase().includes(term)
    )
  })

  const thStyle: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
            Account Settings
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Configure default accounts and financial preferences
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', width: 320 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--foreground-muted)' }} />
          <input
            placeholder="Search settings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 36px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none' }}
          />
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 200 }}>Key / Label</th>
                <th style={{ ...thStyle, width: 140 }}>Module</th>
                <th style={{ ...thStyle, width: 250 }}>Chart of Account</th>
                <th style={thStyle}>Description</th>
                <th style={{ ...thStyle, width: 60, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 14 }}>
                    Loading...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '48px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <Settings size={32} style={{ color: 'var(--border)' }} />
                      <div style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>No account settings found</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item: any) => (
                  <tr key={item.id} style={{ transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
                          {item.account_setting_key_entity?.label || item.account_setting_key}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--foreground-muted)', fontFamily: 'monospace' }}>
                          {item.account_setting_key_entity?.key || item.account_setting_key}
                        </span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-block', padding: '4px 8px', background: 'var(--background)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 500, color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
                        {item.account_setting_key_entity?.module || 'SYSTEM'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {item.chart_of_account ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                            {item.chart_of_account.name}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--foreground-muted)', fontFamily: 'monospace' }}>
                            {item.chart_of_account.code}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--foreground-muted)', fontStyle: 'italic' }}>Not configured</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 13, color: 'var(--foreground-muted)' }}>
                      {item.description || '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setEditData(item)
                          setSheetOpen(true)
                        }}
                        style={{ padding: 6, background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--foreground-muted)' }}
                        title="Edit Setting"
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AccountSettingSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setTimeout(() => setEditData(null), 200)
        }}
        editData={editData}
      />
    </div>
  )
}
