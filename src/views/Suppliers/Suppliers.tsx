import { formatDate } from '@/utils/date';
import React, { useCallback, useMemo } from 'react'
import useSuppliers from './useSuppliers'
import usePermission from '@/hooks/usePermission'
import { Pencil, Trash2 } from 'lucide-react';
import { ISupplier } from '@/@types/supplier';
import { format } from 'date-fns';
import { Column, DataTable } from '@/components/ui/data-table';
import { SuppliersModal } from './Modal/SuppliersModal';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const Suppliers = () => {
  const { suppliers,
    pagination,
    isLoading,
    search,
    handlePageChange,
    handleSearch,
    editModal,
    createModal,
    deleteModal, } = useSuppliers()
  const {
    canCreate,
    canUpdate,
    canDelete,
    canRead
  } = usePermission()

  const columns: Column<ISupplier>[] = useMemo(
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
        title: "Created At",
        key: "created_at",
        render: (value) => formatDate(value as string),
      },
    ],
    [],
  );

  const renderActions = useCallback(
    (_record: ISupplier, _index: number) => (
      <div className="flex gap-2">
        {(<button
          className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer"
          onClick={() => editModal.openModal(suppliers[_index])}
          disabled={!canUpdate('supplier')}>
          <Pencil className="h-4 w-4" />
        </button>)}
        {(<button
          className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
          onClick={() => deleteModal.openModal(suppliers[_index])}
          disabled={!canDelete('supplier')}>
          <Trash2 className="h-4 w-4" />
        </button>)}
      </div>
    ),
    [suppliers, editModal, deleteModal, canUpdate, canDelete],
  );
  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Suppliers</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your suppliers here
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
          {(<Button
            onClick={() => createModal.openModal()}
            className="w-full sm:w-auto"
            disabled={!canCreate('supplier')}>Create Supplier
                        </Button>)}
        </div>
      </div>
      {/* Data Table */}
      <DataTable
        columns={columns}
        data={suppliers}
        loading={isLoading}
        emptyText="No suppliers found"
        pagination={pagination}
        actions={renderActions}
        canRead={canRead("supplier")} />
      {/* Modals */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.closeModal}
        onConfirm={deleteModal.handleConfirmDelete}
        label={deleteModal.selected?.name}
        isDeleting={deleteModal.isDeleting}
      />
      {editModal.isOpen && (
        <SuppliersModal
          mode="edit"
          isOpen={editModal.isOpen}
          onClose={editModal.closeModal}
          onSubmit={editModal.handleSubmit}
          form={editModal.form}
          isSubmitting={editModal.isSubmitting}
        />
      )}
      {createModal.isOpen && (
        <SuppliersModal
          mode="create"
          isOpen={createModal.isOpen}
          onClose={createModal.closeModal}
          onSubmit={createModal.handleSubmit}
          form={createModal.form}
          isSubmitting={createModal.isSubmitting}
        />
      )}
    </div>
  );
}

export default Suppliers
