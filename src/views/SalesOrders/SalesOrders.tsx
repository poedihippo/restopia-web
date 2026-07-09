import { formatDate } from '@/utils/date';
import React, { useCallback, useMemo } from 'react'
import useSalesOrders from './useSalesOrders'
import { Column, DataTable } from '@/components/ui/data-table';
import { ISalesOrder } from '@/@types/sales-orders';
import { format } from 'date-fns';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import usePermission from '@/hooks/usePermission';

const SalesOrders = () => {
    const {
        salesOrders,
        branches,
        vouchers,
        customers,
        pagination,
        isLoading,
        search,
        isLoadingCustomer,
        isLoadingBranch,
        isLoadingVoucher,
        filterKey,
        setDateGte,
        setDateLte,
        setFulfillmentDateGte,
        setFulfillmentDateLte,
        setStatus,
        handleClearFilter,
        handleCustomerChange,
        handleVoucherChange,
        handleBranchChange,
        handlePageChange,
        handleSearch,
        deleteModal,
    } = useSalesOrders()
    const { canCreate, canUpdate, canDelete } = usePermission();

    const options = useMemo(
        () =>
            branches.map((item) => ({
                value: item.id,
                label: item.name ?? "",
            })),
        [branches],
    );

    const optionsVoucher = useMemo(
        () =>
            vouchers.map((item) => ({
                value: item.id,
                label: item.name ?? "",
            })),
        [vouchers],
    );

    const optionsCustomer = useMemo(
        () =>
            customers.map((item) => ({
                value: item.id,
                label: item.name ?? "",
            })),
        [customers],
    );

    const columns: Column<ISalesOrder>[] = useMemo(
        () => [
            {
                title: "ID",
                key: "id",
            },
            {
                title: "Code",
                key: "code",
            },
            {
                title: "Date",
                key: "date",
                render: (value) => formatDate(value as string),
            },
            {
                title: "Status",
                key: "status",
            },
            {
                title: "Branch Name",
                key: "branch.name",
            },
            {
                title: "Created At",
                key: "created_at",
                render: (value) => formatDate(value as string),
            },
        ],
        [],
    );

    const renderActions = useCallback(
        (_record: ISalesOrder, _index: number) => (
            <div className="flex gap-2">
                <Link href={`/sales/sales-orders/${_record.id}/detail`}>
                    <button className="p-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white cursor-pointer">
                        <Eye className="h-4 w-4" />
                    </button>
                </Link>
                {canUpdate('sales-order') && (
                    <Link href={`/sales/sales-orders/${_record.id}/edit`}>
                        <button className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer">
                            <Pencil className="h-4 w-4" />
                        </button>
                    </Link>
                )}
                {canDelete('sales-order') && (
                    <button
                        className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
                        onClick={() => deleteModal.openModal(salesOrders[_index])}
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
            </div>
        ),
        [salesOrders, deleteModal, canUpdate, canDelete],
    );
    return (
        <div className="p-4 sm:p-6">
            <div className="mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-bold">Sales Orders</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                    Manage your sales orders here
                </p>
            </div>

            <div className="mb-4 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 flex flex-col sm:flex-row gap-4">
                        <Input
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full sm:max-w-sm"
                        />
                        <SearchableSelect
                            key={`branch-${filterKey}`}
                            isClearable
                            isLoading={isLoadingBranch}
                            placeholder="Filter by branch..."
                            options={options}
                            onChange={(selected) => {
                                const option = selected as { value: number } | null;
                                handleBranchChange(option?.value);
                            }}
                            className="w-full sm:w-60"
                        />
                        <SearchableSelect
                            key={`voucher-${filterKey}`}
                            isClearable
                            isLoading={isLoadingVoucher}
                            placeholder="Filter by voucher..."
                            options={optionsVoucher}
                            onChange={(selected) => {
                                const option = selected as { value: number } | null;
                                handleVoucherChange(option?.value);
                            }}
                            className="w-full sm:w-60"
                        />
                        <SearchableSelect
                            key={`customer-${filterKey}`}
                            isClearable
                            isLoading={isLoadingCustomer}
                            placeholder="Filter by customer..."
                            options={optionsVoucher}
                            onChange={(selected) => {
                                const option = selected as { value: number } | null;
                                handleCustomerChange(option?.value);
                            }}
                            className="w-full sm:w-60"
                        />


                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline">More Filters</Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                                <PopoverHeader>
                                    <PopoverTitle>More Filters</PopoverTitle>
                                </PopoverHeader>
                                <div className="mt-3 flex flex-col gap-3">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-muted-foreground">
                                            Status
                                        </span>
                                        <Select
                                            key={`status-${filterKey}`}
                                            onValueChange={(val) =>
                                                setStatus(val === "all" ? undefined : val)
                                            }
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="All" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectItem value="all">All</SelectItem>
                                                    <SelectItem value="pending">Pending</SelectItem>
                                                    <SelectItem value="final">Final</SelectItem>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-muted-foreground">
                                            Date Range
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="date"
                                                min={0}
                                                placeholder="Start"
                                                onChange={(e) =>
                                                    setDateGte(e.target.value || undefined)
                                                }
                                            />
                                            <span className="text-muted-foreground">–</span>
                                            <Input
                                                type="date"
                                                min={0}
                                                placeholder="End"
                                                onChange={(e) =>
                                                    setDateLte(e.target.value || undefined)
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-muted-foreground">
                                            Fulfillment Date Range
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="date"
                                                min={0}
                                                placeholder="Start"
                                                onChange={(e) =>
                                                    setFulfillmentDateGte(e.target.value || undefined)
                                                }
                                            />
                                            <span className="text-muted-foreground">–</span>
                                            <Input
                                                type="date"
                                                min={0}
                                                placeholder="End"
                                                onChange={(e) =>
                                                    setFulfillmentDateLte(e.target.value || undefined)
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Button
                            className="bg-yellow-500 hover:bg-yellow-600"
                            onClick={() => handleClearFilter()}
                        >
                            Clear Filter
                        </Button>
                    </div>
                    {canCreate('sales-order') && (
                        <Link href={"/sales/sales-orders/create"}>
                            <Button type="button" className="w-full sm:w-auto">
                                Create Sales Order
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            {/* Data Table */}
            <DataTable
                columns={columns}
                data={salesOrders}
                loading={isLoading}
                emptyText="No sales orders found"
                pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    onChange: handlePageChange,
                }}
                actions={renderActions}
            />

            {/* Modals */}
            <DeleteConfirmModal
                isOpen={deleteModal.isOpen}
                onClose={deleteModal.closeModal}
                onConfirm={deleteModal.handleConfirmDelete}
                label={deleteModal.selected?.code}
                isDeleting={deleteModal.isDeleting}
            />
        </div>
    )
}

export default SalesOrders
