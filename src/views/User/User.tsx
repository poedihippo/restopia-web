import { IUser } from "@/@types/user";
import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { UserModal } from "./Modal/UserModal";
import useUser from "./useUser";

const User = () => {
  const {
    isLoading,
    pagination,
    search,
    users,
    handlePageChange,
    handleSearch,
    createModal,
    editModal,
    deleteModal,
  } = useUser();

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
        title: "Client",
        key: "client.name",
        render: (value: unknown) => (value as string) ?? "-",
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
        <button
          className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer"
          onClick={() => editModal.openModal(users[_index])}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
          onClick={() => deleteModal.openModal(users[_index])}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ),
    [users, editModal, deleteModal],
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Users</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your users here
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-4">
        {/* Search and Create Button */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full sm:max-w-sm"
            />
          </div>
          <Button
            onClick={() => createModal.openModal()}
            className="w-full sm:w-auto"
          >
            Create User
          </Button>
        </div>

        {/* Filter Row */}
        {/* <div className="grid grid-cols-2 gap-2">
          <Combobox
            options={[
              { value: "all", label: "All Clients" },
              ...clients.map((client) => ({
                value: String(client.id),
                label: client.name || "",
              })),
            ]}
            value={selectedClientId || "all"}
            onValueChange={handleClientFilter}
            onOpenChange={handleClientFilterOpenChange}
            placeholder="All Clients"
            searchPlaceholder="Search clients..."
            emptyText="No clients found."
            className="w-full"
          />
          <Select value={selectedType} onValueChange={handleTypeFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="technician">Technician</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
        </div> */}
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
