import { IBranch } from "@/@types/branch";
import { ICompanies } from "@/@types/companies";
import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { CompaniesModal } from "./Modal/CompaniesModal";
import useCompanies from "./useCompanies";

const Companies = () => {
  const {
    companies,
    pagination,
    isLoading,
    search,
    handlePageChange,
    handleSearch,
    createModal,
    deleteModal,
    editModal,
  } = useCompanies();

  const columns: Column<ICompanies>[] = useMemo(
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
        title: "Created At",
        key: "created_at",
        render: (value) => format(new Date(value as string), "dd MMM yyyy"),
      },
    ],
    [],
  );

  const renderActions = useCallback(
    (_record: IBranch, _index: number) => (
      <div className="flex gap-2">
        <button
          className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer"
          onClick={() => editModal.openModal(companies[_index])}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
          onClick={() => deleteModal.openModal(companies[_index])}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ),
    [companies, editModal, deleteModal],
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Companies</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your companies here
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
            Create Company
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={companies}
        loading={isLoading}
        emptyText="No companies found"
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
        <CompaniesModal
          mode="edit"
          isOpen={editModal.isOpen}
          onClose={editModal.closeModal}
          onSubmit={editModal.handleSubmit}
          form={editModal.form}
          isSubmitting={editModal.isSubmitting}
        />
      )}

      {createModal.isOpen && (
        <CompaniesModal
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

export default Companies;
