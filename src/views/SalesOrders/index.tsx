'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { toast } from 'sonner'
import { Download, Loader2, ArrowUpRight } from 'lucide-react'
import { FilterBar, FilterGroup, FilterField, FilterSelect, FilterInput, DateRange, countActive } from '@/components/ListFilters'
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
// funds_status: a Cash/Visa/BCA payment still waiting for Settle Payments.
// Shown in the Settlement column in place of settlement_status (which drives
// the sale journal and stays as it is).
const AWAITING_FUNDS_META = { label: 'Menunggu settlement', color: 'var(--warning)', bg: 'var(--warning-bg)' }

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
  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = hasPermission('sales-order.read')
  const canCreate = hasPermission('sales-order.create')
  const canDelete = hasPermission('sales-order.delete')
  const canBulkSettlement =
    isSuperadmin || hasPermission('sales-order.bulk-update-settlement-status')

  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [settlementFilter, setSettlementFilter] = useState<
    '' | 'pending' | 'credit' | 'settled' | 'cancelled' | 'awaiting_settlement'
  >('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    '' | 'pending' | 'partial' | 'paid'
  >('')
  const [creditTypeFilter, setCreditTypeFilter] = useState<
    '' | 'user' | 'customer'
  >('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateGte, setDateGte] = useState('')
  const [dateLte, setDateLte] = useState('')

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
  const [isCredit, setIsCredit] = useState<'' | 'true' | 'false'>('')
  const [buyerBranchId, setBuyerBranchId] = useState<number | ''>('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerSearchDebounced, setCustomerSearchDebounced] = useState('')
  const [customerId, setCustomerId] = useState<number | ''>('')

  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [isExporting, setIsExporting] = useState(false)

  // Bulk settlement (POST /sales-orders/bulk-update-settlement-status)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [bulkSettlement, setBulkSettlement] = useState<
    '' | 'pending' | 'credit' | 'settled' | 'cancelled'
  >('')

  const toggleSelected = (id: number) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

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
    enabled: customerSearchDebounced.length > 0,
    queryFn: () =>
      customersService
        .list({ per_page: 20, 'filter[search]': customerSearchDebounced } as any)
        .then((r) => r.data),
  })
  const customerOptions: any[] = (customersData as any)?.data ?? []

  const clearAllFilters = () => {
    setSearch('')
    setStatusFilter('')
    setSettlementFilter('')
    setPaymentStatusFilter('')
    setCreditTypeFilter('')
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
    setIsCredit('')
    setBuyerBranchId('')
    setPage(1)
  }

  // Shared by the list query and the Excel export so both apply the same filters.
  const filterParams = {
    'filter[search]': searchDebounced || undefined,
    'filter[status]': statusFilter || undefined,
    'filter[settlement_status]':
      settlementFilter && settlementFilter !== 'awaiting_settlement' ? settlementFilter : undefined,
    'filter[funds_status]': settlementFilter === 'awaiting_settlement' ? 'awaiting_settlement' : undefined,
    'filter[payment_status]': paymentStatusFilter || undefined,
    'filter[credit_type]': creditTypeFilter || undefined,
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
    'filter[is_credit]': isCredit || undefined,
    'filter[buyer_branch_id]': buyerBranchId || undefined,
  }

  const handleExport = async () => {
    try {
      setIsExporting(true)
      const response = await salesOrderService.exportExcel(filterParams)

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

  const { data, isLoading: listFirstLoad, isFetching: listFetching } = useQuery({
    queryKey: [
      'sales-orders',
      page, perPage,
      searchDebounced,
      statusFilter,
      settlementFilter,
      paymentStatusFilter,
      creditTypeFilter,
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
      isCredit,
      buyerBranchId,
    ],
    queryFn: () =>
      salesOrderService
        .list({
          page,
          per_page: perPage,
          sort: '-created_at',
          include: 'customer,sales_channel,credit_by,shift,additional_charges,updated_by',
          ...filterParams,
        } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const items: any[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const allOnPageSelected =
    items.length > 0 && items.every((i: any) => selectedIds.includes(Number(i.id)))

  const toggleSelectAllOnPage = () =>
    setSelectedIds((prev) => {
      const pageIds = items.map((i: any) => Number(i.id))
      if (pageIds.length > 0 && pageIds.every((id) => prev.includes(id))) {
        return prev.filter((id) => !pageIds.includes(id))
      }
      return Array.from(new Set([...prev, ...pageIds]))
    })

  // Selection is page-scoped — reset it whenever the list query changes.
  useEffect(() => {
    setSelectedIds([])
    setBulkSettlement('')
  }, [
    page, perPage, searchDebounced, statusFilter, settlementFilter,
    paymentStatusFilter, creditTypeFilter, typeFilter, dateGte, dateLte,
    branchId, salesChannelId, customerId, creditById, voucherId, shiftId,
    fulfillmentGte, fulfillmentLte, settlementAtGte, settlementAtLte,
    hasInvoice, hasPurchaseOrder, hasDelivery, isCredit, buyerBranchId,
  ])

  const { mutate: doBulkSettlement, isPending: bulkUpdating } = useMutation({
    mutationFn: (payload: { sales_order_id: number; settlement_status: string }[]) =>
      salesOrderService.bulkUpdateSettlement({ items: payload }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.success(`Settlement status updated for ${vars.length} order(s)`)
      setSelectedIds([])
      setBulkSettlement('')
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update settlement status'),
  })

  const handleBulkSettlement = () => {
    if (selectedIds.length === 0) {
      toast.error('Select at least one order')
      return
    }
    if (!bulkSettlement) {
      toast.error('Choose a settlement status first')
      return
    }
    // Online orders are settled by their marketplace payout and cancelled via
    // void/return — the API refuses both through `items`.
    const onlineSelected = items.filter(
      (i: any) => selectedIds.includes(Number(i.id)) && i.type === 'online',
    )
    if (onlineSelected.length > 0 && bulkSettlement === 'settled') {
      toast.error(
        `${onlineSelected.map((o: any) => o.code).join(', ')}: online orders are settled from the Unpaid Online Orders screen.`,
        { action: { label: 'Unpaid Online Orders', onClick: () => router.push('/sales/settle-payout') } },
      )
      return
    }
    // An order with partial returns can no longer move out of its settlement status.
    const returnedSelected = items.filter(
      (i: any) => selectedIds.includes(Number(i.id)) && Number(i.returned_amount ?? 0) > 0,
    )
    if (returnedSelected.length > 0) {
      toast.error(
        `${returnedSelected.map((o: any) => o.code).join(', ')}: has partial returns and can no longer change settlement status.`,
      )
      return
    }
    if (onlineSelected.length > 0 && bulkSettlement === 'cancelled') {
      toast.error(
        `${onlineSelected.map((o: any) => o.code).join(', ')}: cancel online orders with void or return.`,
      )
      return
    }
    doBulkSettlement(
      selectedIds.map((id) => ({ sales_order_id: id, settlement_status: bulkSettlement })),
    )
  }

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

      <FilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        searchPlaceholder="Code / customer..."
        activeCount={countActive(
          statusFilter, settlementFilter, paymentStatusFilter, creditTypeFilter, typeFilter,
          dateGte, dateLte, fulfillmentGte, fulfillmentLte, settlementAtGte, settlementAtLte,
          branchId, buyerBranchId, salesChannelId,
          customerId, creditById, voucherId, shiftId,
          hasInvoice, hasPurchaseOrder, hasDelivery, isCredit,
        )}
        onClear={clearAllFilters}
        quick={
          <>
            <FilterSelect
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="final">Final</option>
            </FilterSelect>
            <FilterSelect
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All Types</option>
              <option value="offline">Offline</option>
              <option value="online">Online</option>
              <option value="franchise">Franchise</option>
            </FilterSelect>
          </>
        }
      >
        <FilterGroup title="Status">
          <FilterField label="Settlement">
            <FilterSelect
              block
              value={settlementFilter}
              onChange={(e) => {
                setSettlementFilter(e.target.value as any)
                setPage(1)
              }}
            >
              <option value="">All Settlements</option>
              <option value="pending">Pending</option>
              <option value="credit">Credit</option>
              <option value="awaiting_settlement">Menunggu settlement</option>
              <option value="settled">Settled</option>
              <option value="cancelled">Cancelled</option>
            </FilterSelect>
          </FilterField>
          <FilterField label="Payment">
            <FilterSelect
              block
              value={paymentStatusFilter}
              onChange={(e) => {
                setPaymentStatusFilter(e.target.value as any)
                setPage(1)
              }}
            >
              <option value="">All Payments</option>
              <option value="pending">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </FilterSelect>
          </FilterField>
          <FilterField label="Credit type">
            <FilterSelect
              block
              value={creditTypeFilter}
              onChange={(e) => {
                setCreditTypeFilter(e.target.value as any)
                setPage(1)
              }}
            >
              <option value="">All Credit Types</option>
              <option value="user">Staff (user)</option>
              <option value="customer">Customer</option>
            </FilterSelect>
          </FilterField>
        </FilterGroup>

        <FilterGroup title="Dates">
          <FilterField label="Order date">
            <DateRange
              from={dateGte}
              to={dateLte}
              onFromChange={(v) => { setDateGte(v); setPage(1) }}
              onToChange={(v) => { setDateLte(v); setPage(1) }}
            />
          </FilterField>
          <FilterField label="Fulfillment date">
            <DateRange
              from={fulfillmentGte}
              to={fulfillmentLte}
              onFromChange={(v) => { setFulfillmentGte(v); setPage(1) }}
              onToChange={(v) => { setFulfillmentLte(v); setPage(1) }}
            />
          </FilterField>
          <FilterField label="Settlement date">
            <DateRange
              from={settlementAtGte}
              to={settlementAtLte}
              onFromChange={(v) => { setSettlementAtGte(v); setPage(1) }}
              onToChange={(v) => { setSettlementAtLte(v); setPage(1) }}
            />
          </FilterField>
        </FilterGroup>

        <FilterGroup title="Branches & channel">
          <FilterField label="Branch">
            <FilterSelect
              block
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value ? Number(e.target.value) : '')
                setPage(1)
              }}
            >
              <option value="">All branches</option>
              {branchOptions.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </FilterSelect>
          </FilterField>
          <FilterField label="Buyer branch">
            <FilterSelect
              block
              value={buyerBranchId}
              onChange={(e) => {
                setBuyerBranchId(e.target.value ? Number(e.target.value) : '')
                setPage(1)
              }}
            >
              <option value="">All buyer branches</option>
              {branchOptions.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </FilterSelect>
          </FilterField>
          <FilterField label="Sales channel">
            <FilterSelect
              block
              value={salesChannelId}
              onChange={(e) => {
                setSalesChannelId(e.target.value ? Number(e.target.value) : '')
                setPage(1)
              }}
            >
              <option value="">All Channels</option>
              {channelOptions.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </FilterSelect>
          </FilterField>
        </FilterGroup>

        <FilterGroup title="Related">
          <FilterField label="Customer">
            <FilterInput
              value={customerId !== '' ? selectedCustomerLabel : customerSearch}
              onChange={(e) => {
                setCustomerId('')
                setCustomerSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search customer..."
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
              <FilterSelect
                block
                value=""
                onChange={(e) => {
                  if (!e.target.value) return
                  setCustomerId(Number(e.target.value))
                  setPage(1)
                }}
                style={{ fontSize: 12 }}
              >
                <option value="">Select customer...</option>
                {customerOptions.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.phone ? ` — ${c.phone}` : ''}
                  </option>
                ))}
              </FilterSelect>
            )}
          </FilterField>
          <FilterField label="Credit by">
            <FilterSelect
              block
              value={creditById}
              onChange={(e) => {
                setCreditById(e.target.value ? Number(e.target.value) : '')
                setPage(1)
              }}
            >
              <option value="">All users</option>
              {creditUserOptions.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </FilterSelect>
          </FilterField>
          <FilterField label="Voucher">
            <FilterSelect
              block
              value={voucherId}
              onChange={(e) => {
                setVoucherId(e.target.value ? Number(e.target.value) : '')
                setPage(1)
              }}
            >
              <option value="">All vouchers</option>
              {voucherOptions.map((v: any) => (
                <option key={v.id} value={v.id}>{v.code || v.name || `#${v.id}`}</option>
              ))}
            </FilterSelect>
          </FilterField>
          <FilterField label="Shift">
            <FilterSelect
              block
              value={shiftId}
              onChange={(e) => {
                setShiftId(e.target.value ? Number(e.target.value) : '')
                setPage(1)
              }}
            >
              <option value="">All shifts</option>
              {shiftOptions.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.code || s.name || `Shift #${s.id}`}
                </option>
              ))}
            </FilterSelect>
          </FilterField>
        </FilterGroup>

        <FilterGroup title="Flags">
          {([
            ['Is credit', isCredit, setIsCredit],
            ['Has invoice', hasInvoice, setHasInvoice],
            ['Has purchase order', hasPurchaseOrder, setHasPurchaseOrder],
            ['Has delivery', hasDelivery, setHasDelivery],
          ] as const).map(([label, value, setter]) => (
            <FilterField key={label} label={label}>
              <FilterSelect
                block
                value={value}
                onChange={(e) => {
                  setter(e.target.value as any)
                  setPage(1)
                }}
              >
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </FilterSelect>
            </FilterField>
          ))}
        </FilterGroup>
      </FilterBar>

      {/* Bulk settlement bar */}
      {canBulkSettlement && selectedIds.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            padding: '12px 16px',
            background: 'var(--accent-light-bg)',
            border: '1px solid var(--accent-light)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
            {selectedIds.length} order{selectedIds.length > 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Set settlement to</span>
            <select
              value={bulkSettlement}
              onChange={(e) => setBulkSettlement(e.target.value as any)}
              style={controlStyle}
            >
              <option value="">Choose status…</option>
              <option value="pending">Pending</option>
              <option value="credit">Credit</option>
              <option value="settled">Settled</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              type="button"
              onClick={handleBulkSettlement}
              disabled={bulkUpdating || !bulkSettlement}
              style={{
                height: 36,
                padding: '0 16px',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background:
                  bulkUpdating || !bulkSettlement ? 'var(--foreground-subtle)' : 'var(--accent)',
                color: 'white',
                fontSize: 13,
                fontWeight: 600,
                cursor: bulkUpdating || !bulkSettlement ? 'not-allowed' : 'pointer',
                opacity: bulkUpdating || !bulkSettlement ? 0.7 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {bulkUpdating && <Loader2 size={14} className="animate-spin" />}
              {bulkUpdating ? 'Applying…' : 'Apply'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedIds([])
                setBulkSettlement('')
              }}
              style={{
                height: 36,
                padding: '0 14px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface)',
                color: 'var(--foreground)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
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
              {canBulkSettlement && (
                <th style={{ ...thStyle, width: 44 }}>
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAllOnPage}
                    aria-label="Select all orders on this page"
                    style={{ cursor: 'pointer' }}
                  />
                </th>
              )}
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
                  {Array.from({ length: canBulkSettlement ? 13 : 12 }).map((_, j) => (
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
                  colSpan={canBulkSettlement ? 13 : 12}
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
                  {canBulkSettlement && (
                    <td
                      style={{ ...tdStyle, width: 44 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(Number(item.id))}
                        onChange={() => toggleSelected(Number(item.id))}
                        aria-label={`Select order ${item.code}`}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                  )}
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--accent)' }}>
                    {canRead ? <span className="v2-link">{item.code}<ArrowUpRight size={12} /></span> : '***'}
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
                    {Number(item.returned_amount ?? 0) > 0 && (
                      <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--warning)', marginTop: 2 }}>
                        Returned −<PriceDisplay amount={item.returned_amount} />
                      </div>
                    )}
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
                        item.funds_status === 'awaiting_settlement'
                          ? AWAITING_FUNDS_META
                          : SETTLEMENT_META[
                              item.settlement_status as keyof typeof SETTLEMENT_META
                            ] ?? SETTLEMENT_META.pending
                      const creditTypeLabel =
                        item.credit_type === 'user'
                          ? 'Staff'
                          : item.credit_type === 'customer'
                            ? 'Customer'
                            : null
                      return (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
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
                          {creditTypeLabel && item.settlement_status === 'credit' && (
                            <span
                              style={{
                                display: 'inline-flex',
                                padding: '2px 8px',
                                borderRadius: 99,
                                fontSize: 10,
                                fontWeight: 600,
                                background: 'var(--info-bg)',
                                color: 'var(--info)',
                              }}
                            >
                              {creditTypeLabel}
                            </span>
                          )}
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
                      {/* An order with partial returns can't be voided — return its remaining lines instead. */}
                      {canDelete && !(Number(item.returned_amount ?? 0) > 0) && (
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
