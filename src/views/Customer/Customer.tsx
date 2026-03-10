import { ICustomer } from '@/@types/customer';
import { Button } from '@/components/ui/button';
import { Column, DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import useCustomer from './useCustomer';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { CustomerModal } from './Modal/CustomerModal';

const Customer = () => {
    const {
        customers,
        pagination,
        isLoading,
        search,
        handlePageChange,
        handleSearch,

        //Modal
        editModal,
        createModal,
        deleteModal,
    } = useCustomer()

    const columns: Column<ICustomer>[] = useMemo(
        () => [
            {
                title: "ID",
                key: "id",
            },
            {
                title: "Name",
                key: "name",
            },
            {
                title: "Phone",
                key: "phone",
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
        (_record: ICustomer, _index: number) => (
            <div className="flex gap-2">
                <button
                    className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer"
                    onClick={() => editModal.openModal(customers[_index])}
                >
                    <Pencil className="h-4 w-4" />
                </button>
                <button
                    className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
                    onClick={() => deleteModal.openModal(customers[_index])}
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        ),
        [customers, editModal, deleteModal],
    );
    return (
        <div className="p-4 sm:p-6">
            <div className="mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-bold">Customers</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                    Manage your customers here
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
                    </div>
                    <Button
                        onClick={() => createModal.openModal()}
                        className="w-full sm:w-auto"
                    >
                        Create Customer
                    </Button>
                </div>
            </div>

            {/* Data Table */}
            <DataTable
                columns={columns}
                data={customers}
                loading={isLoading}
                emptyText="No customers found"
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
                label={deleteModal.selected?.name}
                isDeleting={deleteModal.isDeleting}
            />

            {editModal.isOpen && (
                <CustomerModal
                    mode="edit"
                    isOpen={editModal.isOpen}
                    onClose={editModal.closeModal}
                    onSubmit={editModal.handleSubmit}
                    form={editModal.form}
                    isSubmitting={editModal.isSubmitting}
                />
            )}

            {createModal.isOpen && (
                <CustomerModal
                    mode="create"
                    isOpen={createModal.isOpen}
                    onClose={createModal.closeModal}
                    onSubmit={createModal.handleSubmit}
                    form={createModal.form}
                    isSubmitting={createModal.isSubmitting}
                />
            )}
        </div>
    )
}

export default Customer
