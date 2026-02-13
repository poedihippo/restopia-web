import React, { useCallback, useMemo } from "react";
import useBranches from "./useBranches";
import { Column, DataTable } from "@/components/ui/data-table";
import { IBranch } from "@/@types/branch";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { BranchModal } from "./Modal/BranchModal";
import { SearchableSelect } from "@/components/ui/searchable-select";

const Branches = () => {
  const {
    branches,
    pagination,
    isLoading,
    search,
    handlePageChange,
    handleSearch,
    createModal,
    deleteModal,
    editModal,
    company,
    handleCompanyChange,
    isLoadingCompany,
  } = useBranches();

  const companyOptions = useMemo(
    () =>
      company.map((item) => ({
        value: item.id,
        label: item.name ?? "",
      })),
    [company],
  );

  const columns: Column<IBranch>[] = useMemo(
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
          onClick={() => editModal.openModal(branches[_index])}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
          onClick={() => deleteModal.openModal(branches[_index])}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ),
    [branches, editModal, deleteModal],
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Branches</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your branches here
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
              isClearable
              isLoading={isLoadingCompany}
              placeholder="Filter by company..."
              options={companyOptions}
              onChange={(selected) => {
                const option = selected as { value: number } | null;
                handleCompanyChange(option?.value);
              }}
              className="w-full sm:w-60"
            />
          </div>
          <Button
            onClick={() => createModal.openModal()}
            className="w-full sm:w-auto"
          >
            Create Branch
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={branches}
        loading={isLoading}
        emptyText="No branches found"
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
        <BranchModal
          mode="edit"
          isOpen={editModal.isOpen}
          onClose={editModal.closeModal}
          onSubmit={editModal.handleSubmit}
          form={editModal.form}
          isSubmitting={editModal.isSubmitting}
        />
      )}

      {createModal.isOpen && (
        <BranchModal
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

export default Branches;
