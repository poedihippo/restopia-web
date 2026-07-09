import { formatDate } from '@/utils/date';
import { IUOM } from "@/@types/uom";
import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { UomsModal } from "./Modal/UomsModal";
import useUoms from "./useUoms";
import usePermission from "@/hooks/usePermission";

const Uoms = () => {
  const {
    uoms,
    pagination,
    isLoading,
    search,
    handlePageChange,
    handleSearch,
    createModal,
    deleteModal,
    editModal,
  } = useUoms();
  const { canCreate, canUpdate, canDelete } = usePermission();

  const columns: Column<IUOM>[] = useMemo(
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
    (_record: IUOM, _index: number) => (
      <div className="flex gap-2">
        {canUpdate('uom') && (
          <button
            className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer"
            onClick={() => editModal.openModal(uoms[_index])}
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {canDelete('uom') && (
          <button
            className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
            onClick={() => deleteModal.openModal(uoms[_index])}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    ),
    [uoms, editModal, deleteModal, canUpdate, canDelete],
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">UOMS</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your uoms here
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
          {canCreate('uom') && (
            <Button
              onClick={() => createModal.openModal()}
              className="w-full sm:w-auto"
            >
              Create Uoms
            </Button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={uoms}
        loading={isLoading}
        emptyText="No uoms found"
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
        <UomsModal
          mode="edit"
          isOpen={editModal.isOpen}
          onClose={editModal.closeModal}
          onSubmit={editModal.handleSubmit}
          form={editModal.form}
          isSubmitting={editModal.isSubmitting}
        />
      )}

      {createModal.isOpen && (
        <UomsModal
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
};

export default Uoms;
