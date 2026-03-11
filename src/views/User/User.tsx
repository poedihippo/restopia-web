import { IUser } from "@/@types/user";
import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { UserModal } from "./Modal/UserModal";
import useUser from "./useUser";
import usePermission from "@/hooks/usePermission";

const User = () => {
  const {
    isLoading,
    isLoadingBranch,
    branches,
    pagination,
    search,
    users,
    handlePageChange,
    handleSearch,
    handleBranchChange,
    createModal,
    editModal,
    deleteModal,
  } = useUser();
  const { canCreate, canUpdate, canDelete } = usePermission();

  const branchOptions = useMemo(
    () =>
      branches.map((branch) => ({
        value: branch.id,
        label: branch.name ?? "",
      })),
    [branches],
  );

  const columns: Column<IUser>[] = useMemo(
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
        title: "Email",
        key: "email",
      },
      {
        title: "Type",
        key: "type",
      },
    ],
    [],
  );

  const renderActions = useCallback(
    (_record: IUser, _index: number) => (
      <div className="flex gap-2">
        {canUpdate('user') && (
          <button
            className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer"
            onClick={() => editModal.openModal(users[_index])}
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {canDelete('user') && (
          <button
            className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
            onClick={() => deleteModal.openModal(users[_index])}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    ),
    [users, editModal, deleteModal, canUpdate, canDelete],
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Users</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your users here
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
              isLoading={isLoadingBranch}
              placeholder="Filter by branch..."
              options={branchOptions}
              onChange={(selected) => {
                const option = selected as { value: number } | null;
                handleBranchChange(option?.value);
              }}
              className="w-full sm:w-60"
            />
          </div>
          {canCreate('user') && (
            <Button
              onClick={() => createModal.openModal()}
              className="w-full sm:w-auto"
            >
              Create User
            </Button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={users}
        loading={isLoading}
        emptyText="No users found"
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
        label={deleteModal.selectedUser?.name}
        isDeleting={deleteModal.isDeleting}
      />

      {editModal.isOpen && (
        <UserModal
          mode="edit"
          isOpen={editModal.isOpen}
          onClose={editModal.closeModal}
          onSubmit={editModal.handleSubmit}
          form={editModal.form}
          isSubmitting={editModal.isSubmitting}
        />
      )}

      {createModal.isOpen && (
        <UserModal
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

export default User;
