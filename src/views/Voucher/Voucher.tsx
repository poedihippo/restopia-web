import { IVoucher } from '@/@types/voucher';
import { Column, DataTable } from '@/components/ui/data-table';
import { formatterIDR } from '@/helper/convertCurrency';
import { format } from 'date-fns';
import { useCallback, useMemo } from 'react';
import useVoucher from './useVoucher';
import Link from 'next/link';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import usePermission from '@/hooks/usePermission';

const Voucher = () => {
    const {
        vouchers,
        companies,
        pagination,
        isLoading,
        search,
        isLoadingCompany,
        filterKey,
        setValidFromGte,
        setValidFromLte,
        setValidUntilGte,
        setValidUntilLte,
        setStatus,
        setDiscountType,
        setScope,
        handleClearFilter,
        handleCompanyChange,
        handlePageChange,
        handleSearch,
        deleteModal,
    } = useVoucher()
    const { canCreate, canUpdate, canDelete } = usePermission();

    const options = useMemo(
        () =>
            companies.map((item) => ({
                value: item.id,
                label: item.name ?? "",
            })),
        [companies],
    );

    const columns: Column<IVoucher>[] = useMemo(
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
                title: "Name",
                key: "name",
            },
            {
                title: "Discount Value",
                key: "discount_value",
                render: (val, record) => {
                    return record.discount_type === 'percent' ? `${val}%` : formatterIDR(val as number)
                }
            },
            {
                title: "Discount Type",
                key: "discount_type",
                render: (val) => val === 'percent' ? "Percentage" : "Fixed"
            },
            {
                title: "Status",
                key: "status",
                render: (val) => val === 'active' ? "Active" : "Inactive"
            },
            {
                title: "Scope",
                key: "scope",
                render: (val) => val === 'branch' ? "Branch" : "Company"
            },
            {
                title: "Used Quota",
                key: "used_quota",
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
        (_record: IVoucher, _index: number) => (
            <div className="flex gap-2">
                <Link href={`/sales/vouchers/${_record.id}/detail`}>
                    <button className="p-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white cursor-pointer">
                        <Eye className="h-4 w-4" />
                    </button>
                </Link>
                {canUpdate('voucher') && (
                    <Link href={`/sales/vouchers/${_record.id}/edit`}>
                        <button className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer">
                            <Pencil className="h-4 w-4" />
                        </button>
                    </Link>
                )}
                {canDelete('voucher') && (
                    <button
                        className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
                        onClick={() => deleteModal.openModal(vouchers[_index])}
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
            </div>
        ),
        [vouchers, deleteModal, canUpdate, canDelete],
    );
    return (
        <div className="p-4 sm:p-6">
            <div className="mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-bold">Vouchers</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                    Manage your vouchers here
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
                            key={`company-${filterKey}`}
                            isClearable
                            isLoading={isLoadingCompany}
                            placeholder="Filter by company..."
                            options={options}
                            onChange={(selected) => {
                                const option = selected as { value: number } | null;
                                handleCompanyChange(option?.value);
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
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="inactive">inactive</SelectItem>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-muted-foreground">
                                            Discount Type
                                        </span>
                                        <Select
                                            key={`discount-type-${filterKey}`}
                                            onValueChange={(val) =>
                                                setDiscountType(val === "all" ? undefined : val)
                                            }
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="All" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectItem value="all">All</SelectItem>
                                                    <SelectItem value="percent">Percentage</SelectItem>
                                                    <SelectItem value="fixed">Fixed</SelectItem>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-muted-foreground">
                                            Scope
                                        </span>
                                        <Select
                                            key={`scope-${filterKey}`}
                                            onValueChange={(val) =>
                                                setScope(val === "all" ? undefined : val)
                                            }
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="All" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectItem value="all">All</SelectItem>
                                                    <SelectItem value="company">Company</SelectItem>
                                                    <SelectItem value="branch">Branch</SelectItem>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-muted-foreground">
                                            Valid From Range
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="date"
                                                min={0}
                                                placeholder="Start"
                                                onChange={(e) =>
                                                    setValidFromGte(e.target.value || undefined)
                                                }
                                            />
                                            <span className="text-muted-foreground">–</span>
                                            <Input
                                                type="date"
                                                min={0}
                                                placeholder="End"
                                                onChange={(e) =>
                                                    setValidFromLte(e.target.value || undefined)
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-muted-foreground">
                                            Valid Until Range
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="date"
                                                min={0}
                                                placeholder="Start"
                                                onChange={(e) =>
                                                    setValidUntilGte(e.target.value || undefined)
                                                }
                                            />
                                            <span className="text-muted-foreground">–</span>
                                            <Input
                                                type="date"
                                                min={0}
                                                placeholder="End"
                                                onChange={(e) =>
                                                    setValidUntilLte(e.target.value || undefined)
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
                    {canCreate('voucher') && (
                        <Link href={"/sales/vouchers/create"}>
                            <Button type="button" className="w-full sm:w-auto cursor-pointer">
                                Create Voucher
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            {/* Data Table */}
            <DataTable
                columns={columns}
                data={vouchers}
                loading={isLoading}
                emptyText="No vouchers found"
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

export default Voucher
