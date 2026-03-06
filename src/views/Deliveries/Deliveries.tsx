import React, { useCallback, useMemo } from 'react'
import useDeliveries from './useDeliveries'
import { IDeliveries } from '@/@types/deliveries';
import { format } from 'date-fns';
import { Column, DataTable } from '@/components/ui/data-table';
import Link from 'next/link';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';

const Deliveries = () => {
    const {
        deliveries,
        branches,
        suppliers,
        pagination,
        isLoading,
        search,
        isLoadingBranch,
        isLoadingSupplier,
        filterKey,
        setStartDate,
        setEndDate,
        setStatus,
        handleClearFilter,
        handleSupplierBranchChange,
        handleSupplierChange,
        handleBranchChange,
        handlePageChange,
        handleSearch,
        // deleteModal,
    } = useDeliveries()

    const options = useMemo(
        () =>
            branches.map((item) => ({
                value: item.id,
                label: item.name ?? "",
            })),
        [branches],
    );

    const optionsSupplier = useMemo(
        () =>
            suppliers.map((item) => ({
                value: item.id,
                label: item.name ?? "",
            })),
        [suppliers],
    );

    const columns: Column<IDeliveries>[] = useMemo(
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
                render: (value) => format(new Date(value as string), "dd MMM yyyy"),
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
                render: (value) => format(new Date(value as string), "dd MMM yyyy"),
            },
        ],
        [],
    );

    const renderActions = useCallback(
        (_record: IDeliveries, _index: number) => (
            <div className="flex gap-2">
                {/* <Link href={`/transfer/deliveries/${_record.id}/detail`}>
                    <button className="p-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white cursor-pointer">
                        <Eye className="h-4 w-4" />
                    </button>
                </Link> */}
                {/* <Link href={`/transfer/deliveries/${_record.id}/edit`}>
                    <button className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer">
                        <Pencil className="h-4 w-4" />
                    </button>
                </Link> */}
                {/* <button
                    className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
                    onClick={() => deleteModal.openModal(deliveries[_index])}
                >
                    <Trash2 className="h-4 w-4" />
                </button> */}
            </div>
        ),
        [deliveries],
    );

    return (
        <div className="p-4 sm:p-6">
            <div className="mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-bold">Deliveries</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                    Manage your deliveries here
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
                            key={`supplier-${filterKey}`}
                            isClearable
                            isLoading={isLoadingSupplier}
                            placeholder="Filter by supplier..."
                            options={optionsSupplier}
                            onChange={(selected) => {
                                const option = selected as { value: number } | null;
                                handleSupplierChange(option?.value);
                            }}
                            className="w-full sm:w-60"
                        />
                        <Select
                            key={`status-${filterKey}`}
                            onValueChange={(val) =>
                                setStatus(val === "all" ? undefined : val)
                            }
                        >
                            <SelectTrigger className="w-full lg:w-40">
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

                        <div className="flex items-center gap-2">
                            <Input
                                key={`startDate-${filterKey}`}
                                type="date"
                                min={0}
                                placeholder="Start"
                                onChange={(e) => setStartDate(e.target.value || undefined)}
                            />
                            <span className="text-muted-foreground">–</span>
                            <Input
                                key={`endDate-${filterKey}`}
                                type="date"
                                min={0}
                                placeholder="End"
                                onChange={(e) => setEndDate(e.target.value || undefined)}
                            />
                        </div>

                        <Button
                            className="bg-yellow-500 hover:bg-yellow-600"
                            onClick={() => handleClearFilter()}
                        >
                            Clear Filter
                        </Button>
                    </div>
                    <Link href={"/transfer/deliveries/create"}>
                        <Button type="button" className="w-full sm:w-auto">
                            Create Delivery
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Data Table */}
            <DataTable
                columns={columns}
                data={deliveries}
                loading={isLoading}
                emptyText="No deliveries found"
                pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    onChange: handlePageChange,
                }}
                actions={renderActions}
            />

            {/* Modals */}
            {/* <DeleteConfirmModal
                isOpen={deleteModal.isOpen}
                onClose={deleteModal.closeModal}
                onConfirm={deleteModal.handleConfirmDelete}
                label={deleteModal.selected?.code}
                isDeleting={deleteModal.isDeleting}
            /> */}
        </div>
    )
}

export default Deliveries
