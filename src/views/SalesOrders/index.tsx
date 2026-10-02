'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { Download, Loader2, SlidersHorizontal, X } from 'lucide-react'
import { salesOrdersService as salesOrderService } from '@/services/sales-orders.service'
import { branchesService } from '@/services/branches.service'
import { salesChannelsService } from '@/services/sales-channels.service'
import { usersService } from '@/services/users.service'
import { customersService } from '@/services/customers.service'
import { vouchersService } from '@/services/vouchers.service'
import { shiftsService } from '@/services/shifts.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { PriceDisplay } from '@/components/PriceDisplay'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { formatDateShort, formatDateTime } from '@/utils/date'

const SETTLEMENT_META = {
  pending: { label: 'Pending', color: 'var(--foreground-muted)', bg: 'var(--background)' },
  credit: { label: 'Credit', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  settled: { label: 'Settled', color: 'var(--success)', bg: 'var(--success-bg)' },
  cancelled: { label: 'Cancelled', color: 'var(--destructive)', bg: 'var(--destructive-bg)' },
}

const PAYMENT_STATUS_META = {
  pending: { label: 'Unpaid', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  partial: { label: 'Partial', color: 'var(--info)', bg: 'var(--info-bg)' },
  paid: { label: 'Paid', color: 'var(--success)', bg: 'var(--success-bg)' },
}

const controlStyle: React.CSSProperties = {
  height: 36,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '0 10px',
  fontSize: 13,
  color: 'var(--foreground)',
  background: 'var(--surface-raised)',
  outline: 'none',
  minWidth: 0,
}

export default function SalesOrdersView() {
  const router = useRouter()
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission('sales-order.read')
  const canCreate = hasPermission('sales-order.create')
  const canDelete = hasPermission('sales-order.delete')

  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [settlementFilter, setSettlementFilter] = useState<
    '' | 'pending' | 'credit' | 'settled' | 'cancelled'
  >('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    '' | 'pending' | 'partial' | 'paid'
  >('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateGte, setDateGte] = useState('')
  const [dateLte, setDateLte] = useState('')
  const [showMoreFilters, setShowMoreFilters] = useState(false)

  const [branchId, setBranchId] = useState<number | ''>('')
  const [salesChannelId, setSalesChannelId] = useState<number | ''>('')
  const [creditById, setCreditById] = useState<number | ''>('')
  const [voucherId, setVoucherId] = useState<number | ''>('')
  const [shiftId, setShiftId] = useState<number | ''>('')
  const [fulfillmentGte, setFulfillmentGte] = useState('')
  const [fulfillmentLte, setFulfillmentLte] = useState('')
  const [settlementAtGte, setSettlementAtGte] = useState('')
  const [settlementAtLte, setSettlementAtLte] = useState('')
  const [hasInvoice, setHasInvoice] = useState<'' | 'true' | 'false'>('')
  const [hasPurchaseOrder, setHasPurchaseOrder] = useState<'' | 'true' | 'false'>('')
  const [hasDelivery, setHasDelivery] = useState<'' | 'true' | 'false'>('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerSearchDebounced, setCustomerSearchDebounced] = useState('')
  const [customerId, setCustomerId] = useState<number | ''>('')

  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const t = setTimeout(() => setCustomerSearchDebounced(customerSearch), 400)
    return () => clearTimeout(t)
  }, [customerSearch])

  const { data: branchesData } = useQuery({
    queryKey: ['so-filter-branches'],
    queryFn: () => branchesService.list({ per_page: 200, sort: 'name' } as any).then((r) => r.data),
  })
  const branchOptions: any[] = (branchesData as any)?.data ?? []

  const { data: channelsData } = useQuery({
    queryKey: ['so-filter-channels'],
    queryFn: () => salesChannelsService.list({ per_page: 100, sort: 'name' } as any).then((r) => r.data),
  })
  const channelOptions: any[] = (channelsData as any)?.data ?? []

  const { data: creditUsersData } = useQuery({
    queryKey: ['so-filter-credit-users'],
    queryFn: () => usersService.list({ per_page: 100, 'filter[type]': 'user', sort: 'name' } as any).then((r) => r.data),
  })
  const creditUserOptions: any[] = (creditUsersData as any)?.data ?? []

  const { data: vouchersData } = useQuery({
    queryKey: ['so-filter-vouchers'],
    queryFn: () => vouchersService.list({ per_page: 100, sort: '-id' } as any).then((r) => r.data),
  })
  const voucherOptions: any[] = (vouchersData as any)?.data ?? []

  const { data: shiftsData } = useQuery({
    queryKey: ['so-filter-shifts'],
    queryFn: () => shiftsService.list({ per_page: 100, sort: '-id' } as any).then((r) => r.data),
  })
  const shiftOptions: any[] = (shiftsData as any)?.data ?? []

  const { data: customersData } = useQuery({
    queryKey: ['so-filter-customers', customerSearchDebounced],
    enabled: showMoreFilters && customerSearchDebounced.length > 0,
    queryFn: () =>
      customersService
        .list({ per_page: 20, 'filter[search]': customerSearchDebounced } as any)
        .then((r) => r.data),
  })
  const customerOptions: any[] = (customersData as any)?.data ?? []

  const activeAdvancedCount = useMemo(() => {
    let n = 0
    if (branchId !== '') n++
    if (salesChannelId !== '') n++
    if (customerId !== '') n++
    if (creditById !== '') n++
    if (voucherId !== '') n++
    if (shiftId !== '') n++
    if (fulfillmentGte || fulfillmentLte) n++
    if (settlementAtGte || settlementAtLte) n++
    if (hasInvoice) n++
    if (hasPurchaseOrder) n++
    if (hasDelivery) n++
    return n
  }, [
    branchId, salesChannelId, customerId, creditById, voucherId, shiftId,
    fulfillmentGte, fulfillmentLte, settlementAtGte, settlementAtLte,
    hasInvoice, hasPurchaseOrder, hasDelivery,
  ])

  const hasAnyFilter = useMemo(() => {
    return Boolean(
      search || statusFilter || settlementFilter || paymentStatusFilter ||
      typeFilter || dateGte || dateLte || activeAdvancedCount > 0,
    )
  }, [
    search, statusFilter, settlementFilter, paymentStatusFilter,
    typeFilter, dateGte, dateLte, activeAdvancedCount,
  ])

  const clearAllFilters = () => {
    setSearch('')
    setStatusFilter('')
    setSettlementFilter('')
    setPaymentStatusFilter('')
    setTypeFilter('')
    setDateGte('')
    setDateLte('')
    setBranchId('')
    setSalesChannelId('')
    setCustomerId('')
    setCustomerSearch('')
    setCreditById('')
    setVoucherId('')
    setShiftId('')
    setFulfillmentGte('')
    setFulfillmentLte('')
    setSettlementAtGte('')
    setSettlementAtLte('')
    setHasInvoice('')
    setHasPurchaseOrder('')
    setHasDelivery('')
    setPage(1)
  }

  const handleExport = async () => {
    try {
      setIsExporting(true)
      const response = await salesOrderService.exportExcel({
        'filter[search]': searchDebounced || undefined,
        'filter[status]': statusFilter || undefined,
        'filter[type]': typeFilter || undefined,
        'filter[settlement_status]': settlementFilter || undefined,
        'filter[payment_status]': paymentStatusFilter || undefined,
      })

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `sales-orders-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Export downloaded successfully')
    } catch (err) {
      toast.error('Failed to export')
    } finally {
      setIsExporting(false)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: [
      'sales-orders',
      page, perPage,
      searchDebounced,
      statusFilter,
      settlementFilter,
      paymentStatusFilter,
      typeFilter,
      dateGte,
      dateLte,
      branchId,
      salesChannelId,
      customerId,
      creditById,
      voucherId,
      shiftId,
      fulfillmentGte,
      fulfillmentLte,
      settlementAtGte,
      settlementAtLte,
      hasInvoice,
      hasPurchaseOrder,
      hasDelivery,
    ],
    queryFn: () =>
      salesOrderService
        .list({
          page,
          per_page: perPage,
          sort: '-created_at',
          include: 'customer,sales_channel,credit_by,shift,additional_charges,updated_by',
          'filter[search]': searchDebounced || undefined,
          'filter[status]': statusFilter || undefined,
          'filter[settlement_status]': settlementFilter || undefined,
          'filter[payment_status]': paymentStatusFilter || undefined,
          'filter[type]': typeFilter || undefined,
          'filter[date_gte]': dateGte || undefined,
          'filter[date_lte]': dateLte || undefined,
          'filter[branch_id]': branchId || undefined,
          'filter[sales_channel_id]': salesChannelId || undefined,
          'filter[customer_id]': customerId || undefined,
          'filter[credit_by_id]': creditById || undefined,
          'filter[voucher_id]': voucherId || undefined,
          'filter[shift_id]': shiftId || undefined,
          'filter[fulfillment_date_gte]': fulfillmentGte || undefined,
          'filter[fulfillment_date_lte]': fulfillmentLte || undefined,
          'filter[settlement_at_gte]': settlementAtGte || undefined,
          'filter[settlement_at_lte]': settlementAtLte || undefined,
          'filter[has_invoice]': hasInvoice || undefined,
          'filter[has_purchase_order]': hasPurchaseOrder || undefined,
          'filter[has_delivery]': hasDelivery || undefined,
        } as any)
        .then((r) => r.data),
  })

  const items: any[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const { mutate: doDelete, isPending: deleting } = useMutation({
    mutationFn: (id: number) => salesOrderService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.success('Order deleted')
      setDeleteTarget(null)
    },
    onError: (err: any) => toastMutationApiError(err),
  })

  const statusColor = (s: string) =>
    s === 'final'
      ? { bg: 'var(--success-bg)', color: 'var(--success)' }
      : { bg: 'var(--warning-bg)', color: 'var(--warning)' }

  const typeColor = (t: string) =>
    t === 'online'
      ? { bg: 'var(--info-bg)', color: 'var(--info)' }
      : t === 'franchise'
        ? { bg: 'var(--warning-bg)', color: 'var(--warning)' }
        : { bg: 'var(--accent-light-bg)', color: 'var(--accent)' }

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  }
  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    fontSize: 14,
    color: 'var(--foreground)',
    borderBottom: '1px solid var(--border)',
  }

  const selectedCustomerLabel = useMemo(() => {
    if (customerId === '') return ''
    const fromList = customerOptions.find((c: any) => Number(c.id) === Number(customerId))
    return fromList?.name ?? `Customer #${customerId}`
  }, [customerId, customerOptions])

  return (
    <div style={{ padding: '32px 40px', fontFamily: 'var(--font-sans)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            Sales Orders
          </h1>
          <p style={{ color: 'var(--foreground-muted)', fontSize: 14, marginTop: 4 }}>
            All offline, online, and franchise orders
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--foreground)',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              opacity: isExporting ? 0.7 : 1,
            }}
          >
            {isExporting ? (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Download size={14} />
            )}
            <span>{isExporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => router.push('/sales/sales-orders/create')}
              style={{
                height: 40,
                padding: '0 20px',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              + New Order
            </button>
          )}
        </div>
      </div>

      {/* Core filters */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 12,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Search</span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Code / customer..."
            style={{ ...controlStyle, width: 220, padding: '0 12px' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Status</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            style={controlStyle}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="final">Final</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Settlement</span>
          <select
            value={settlementFilter}
            onChange={(e) => {
              setSettlementFilter(e.target.value as any)
              setPage(1)
            }}
            style={controlStyle}
          >
            <option value="">All Settlements</option>
            <option value="pending">Pending</option>
            <option value="credit">Credit</option>
            <option value="settled">Settled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Payment</span>
          <select
            value={paymentStatusFilter}
            onChange={(e) => {
              setPaymentStatusFilter(e.target.value as any)
              setPage(1)
            }}
            style={controlStyle}
          >
            <option value="">All Payments</option>
            <option value="pending">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Type</span>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setPage(1)
            }}
            style={controlStyle}
          >
            <option value="">All Types</option>
            <option value="offline">Offline</option>
            <option value="online">Online</option>
            <option value="franchise">Franchise</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Sales Channel</span>
          <select
            value={salesChannelId}
            onChange={(e) => {
              setSalesChannelId(e.target.value ? Number(e.target.value) : '')
              setPage(1)
            }}
            style={{ ...controlStyle, minWidth: 160 }}
          >
            <option value="">All Channels</option>
            {channelOptions.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Order Date</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              value={dateGte}
              onChange={(e) => {
                setDateGte(e.target.value)
                setPage(1)
              }}
              style={controlStyle}
            />
            <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>–</span>
            <input
              type="date"
              value={dateLte}
              onChange={(e) => {
                setDateLte(e.target.value)
                setPage(1)
              }}
              style={controlStyle}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'transparent', userSelect: 'none' }}>.</span>
          <button
            type="button"
            onClick={() => setShowMoreFilters((v) => !v)}
            style={{
              height: 36,
              padding: '0 12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              border: `1px solid ${showMoreFilters || activeAdvancedCount > 0 ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              background: showMoreFilters || activeAdvancedCount > 0 ? 'var(--accent-light-bg)' : 'var(--surface)',
              color: showMoreFilters || activeAdvancedCount > 0 ? 'var(--accent)' : 'var(--foreground-muted)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <SlidersHorizontal size={14} />
            More filters
            {activeAdvancedCount > 0 && (
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 99,
                  background: 'var(--accent)',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {activeAdvancedCount}
              </span>
            )}
          </button>
        </div>

        {hasAnyFilter && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'transparent', userSelect: 'none' }}>.</span>
            <button
              type="button"
              onClick={clearAllFilters}
              style={{
                height: 36,
                padding: '0 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface)',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--foreground-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <X size={14} />
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Advanced filters panel */}
      {showMoreFilters && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 16,
            marginBottom: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Branch</span>
            <select
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value ? Number(e.target.value) : '')
                setPage(1)
              }}
              style={controlStyle}
            >
              <option value="">All branches</option>
              {branchOptions.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Credit By</span>
            <select
              value={creditById}
              onChange={(e) => {
                setCreditById(e.target.value ? Number(e.target.value) : '')
                setPage(1)
              }}
              style={controlStyle}
            >
              <option value="">All users</option>
              {creditUserOptions.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Voucher</span>
            <select
              value={voucherId}
              onChange={(e) => {
                setVoucherId(e.target.value ? Number(e.target.value) : '')
                setPage(1)
              }}
              style={controlStyle}
            >
              <option value="">All vouchers</option>
              {voucherOptions.map((v: any) => (
                <option key={v.id} value={v.id}>{v.code || v.name || `#${v.id}`}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Shift</span>
            <select
              value={shiftId}
              onChange={(e) => {
                setShiftId(e.target.value ? Number(e.target.value) : '')
                setPage(1)
              }}
              style={controlStyle}
            >
              <option value="">All shifts</option>
              {shiftOptions.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.code || s.name || `Shift #${s.id}`}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Customer</span>
            <input
              value={customerId !== '' ? selectedCustomerLabel : customerSearch}
              onChange={(e) => {
                setCustomerId('')
                setCustomerSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search customer..."
              style={controlStyle}
            />
            {customerId !== '' && (
              <button
                type="button"
                onClick={() => {
                  setCustomerId('')
                  setCustomerSearch('')
                  setPage(1)
                }}
                style={{
                  alignSelf: 'flex-start',
                  fontSize: 11,
                  color: 'var(--destructive)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Clear customer
              </button>
            )}
            {customerId === '' && customerOptions.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (!e.target.value) return
                  setCustomerId(Number(e.target.value))
                  setPage(1)
                }}
                style={{ ...controlStyle, fontSize: 12 }}
              >
                <option value="">Select customer...</option>
                {customerOptions.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.phone ? ` — ${c.phone}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Fulfillment From</span>
            <input
              type="date"
              value={fulfillmentGte}
              onChange={(e) => {
                setFulfillmentGte(e.target.value)
                setPage(1)
              }}
              style={controlStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Fulfillment To</span>
            <input
              type="date"
              value={fulfillmentLte}
              onChange={(e) => {
                setFulfillmentLte(e.target.value)
                setPage(1)
              }}
              style={controlStyle}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Settlement From</span>
            <input
              type="date"
              value={settlementAtGte}
              onChange={(e) => {
                setSettlementAtGte(e.target.value)
                setPage(1)
              }}
              style={controlStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Settlement To</span>
            <input
              type="date"
              value={settlementAtLte}
              onChange={(e) => {
                setSettlementAtLte(e.target.value)
                setPage(1)
              }}
              style={controlStyle}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Has Invoice</span>
            <select
              value={hasInvoice}
              onChange={(e) => {
                setHasInvoice(e.target.value as any)
                setPage(1)
              }}
              style={controlStyle}
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Has Purchase Order</span>
            <select
              value={hasPurchaseOrder}
              onChange={(e) => {
                setHasPurchaseOrder(e.target.value as any)
                setPage(1)
              }}
              style={controlStyle}
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Has Delivery</span>
            <select
              value={hasDelivery}
              onChange={(e) => {
                setHasDelivery(e.target.value as any)
                setPage(1)
              }}
              style={controlStyle}
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>
      )}

      {/* Table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Code</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Customer</th>
              <th style={thStyle}>Channel</th>
              <th style={thStyle}>Order Date</th>
              <th style={thStyle}>Fulfillment</th>
              <th style={thStyle}>Created</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, width: 90 }}>Payment</th>
              <th style={{ ...thStyle, width: 110 }}>Settlement</th>
              <th style={{ ...thStyle, width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 12 }).map((_, j) => (
                    <td key={j} style={tdStyle}>
                      <div
                        style={{
                          height: 16,
                          background: 'var(--border)',
                          borderRadius: 4,
                          opacity: 0.6,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading && items.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  style={{
                    ...tdStyle,
                    textAlign: 'center',
                    padding: 48,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  No orders found
                </td>
              </tr>
            )}
            {items.map((item: any) => {
              const sc = statusColor(item.status)
              const tc = typeColor(item.type)
              return (
                <tr
                  key={item.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/sales/sales-orders/${item.id}/detail`)}
                >
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--accent)' }}>
                    {canRead ? item.code : '***'}
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-xl)',
                        background: tc.bg,
                        color: tc.color,
                        textTransform: 'capitalize',
                      }}
                    >
                      {item.type}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {canRead ? item.customer?.name ?? item.customer_name ?? '—' : '***'}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 13, color: 'var(--foreground-muted)' }}>
                    {canRead ? item.sales_channel?.name ?? '—' : '***'}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: 13 }}>
                    {canRead ? formatDateShort(item.date) : '***'}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: 13 }}>
                    {canRead ? formatDateShort(item.fulfillment_date) : '***'}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: 13, color: 'var(--foreground-muted)' }}>
                    {canRead ? formatDateTime(item.created_at) : '***'}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    <PriceDisplay amount={item.total_price} />
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-xl)',
                        background: sc.bg,
                        color: sc.color,
                        textTransform: 'capitalize',
                      }}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {canRead ? (() => {
                      const paymentMeta =
                        PAYMENT_STATUS_META[
                          item.payment_status as keyof typeof PAYMENT_STATUS_META
                        ] ?? PAYMENT_STATUS_META.pending
                      return (
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '3px 10px',
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 600,
                            background: paymentMeta.bg,
                            color: paymentMeta.color,
                          }}
                        >
                          {paymentMeta.label}
                        </span>
                      )
                    })() : '***'}
                  </td>
                  <td style={tdStyle}>
                    {canRead ? (() => {
                      const settlementMeta =
                        SETTLEMENT_META[
                          item.settlement_status as keyof typeof SETTLEMENT_META
                        ] ?? SETTLEMENT_META.pending
                      return (
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '3px 10px',
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 600,
                            background: settlementMeta.bg,
                            color: settlementMeta.color,
                          }}
                        >
                          {settlementMeta.label}
                        </span>
                      )
                    })() : '***'}
                  </td>
                  <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => router.push(`/sales/sales-orders/${item.id}/detail`)}
                        style={{
                          fontSize: 12,
                          padding: '4px 10px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface)',
                          cursor: 'pointer',
                          color: 'var(--foreground)',
                        }}
                      >
                        View
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          style={{
                            fontSize: 12,
                            padding: '4px 10px',
                            border: '1px solid var(--destructive)',
                            borderRadius: 'var(--radius-sm)',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--destructive)',
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <CustomPagination
        page={page}
        setPage={setPage}
        perPage={perPage}
        setPerPage={setPerPage}
        meta={meta}
      />

      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              padding: 32,
              width: 360,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                marginBottom: 8,
                color: 'var(--foreground)',
              }}
            >
              Delete Order
            </h3>
            <p style={{ fontSize: 14, color: 'var(--foreground-muted)', marginBottom: 24 }}>
              Delete order <strong>{deleteTarget.code}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{
                  flex: 1,
                  height: 40,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => doDelete(deleteTarget.id)}
                disabled={deleting}
                style={{
                  flex: 1,
                  height: 40,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--destructive)',
                  color: 'white',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
