import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import useRoles from "./useRoles";
import { format } from "date-fns";
import { IRole } from "@/@types/role";
import { useCallback, useMemo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import PermissionDetailModal from "./Modal/PermissionDetailModal";
import Link from "next/link";
import usePermission from "@/hooks/usePermission";

const Roles = () => {
  const {
    roles,
    company,
    search,
    isLoadingCompany,
    pagination,
    isLoading,
    handlePageChange,
    handleSearch,
    handleCompanyChange,
    deleteModal,
    detailPermissionModal,
  } = useRoles();
  const { canCreate, canUpdate, canDelete } = usePermission();
  const companyOptions = useMemo(
    () =>
      company.map((item) => ({
        value: item.id,
        label: item.name ?? "",
      })),
    [company],
  );

  const columns: Column<IRole>[] = useMemo(
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
        title: "Permissions",
        key: "permissions",
        render: (_value, record) => (
          <button
            className="text-blue-500 hover:text-blue-700 hover:underline cursor-pointer text-sm"
            onClick={() => detailPermissionModal.openModal(record)}
          >
            {record.permissions?.length ?? 0} permissions
          </button>
        ),
      },
      {
        title: "Created At",
        key: "created_at",
        render: (value) => format(new Date(value as string), "dd MMM yyyy"),
      },
    ],
    [detailPermissionModal],
  );

  const renderActions = useCallback(
    (_record: IRole, _index: number) => (
      <div className="flex gap-2">
        {canUpdate('role') && (
          <Link href={`/users/roles/edit/${_record.id}`}>
            <button className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer">
              <Pencil className="h-4 w-4" />
            </button>
          </Link>
        )}
        {canDelete('role') && (
          <button
            className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
            onClick={() => deleteModal.openModal(roles[_index])}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    ),
    [roles, deleteModal, canUpdate, canDelete],
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Roles</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your roles here
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
          {canCreate('role') && (
            <Link className="cursor-pointer" href={"/users/roles/create"}>
              <Button className="w-full sm:w-auto">Create Role</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={roles}
        loading={isLoading}
        emptyText="No roles found"
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: handlePageChange,
        }}
        actions={renderActions}
      />

      {/* Modals */}
      <PermissionDetailModal
        isOpen={detailPermissionModal.isOpen}
        onClose={detailPermissionModal.closeModal}
        role={detailPermissionModal.selected}
      />
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.closeModal}
        onConfirm={deleteModal.handleConfirmDelete}
        label={deleteModal.selected?.name}
        isDeleting={deleteModal.isDeleting}
      />
    </div>
  );
};

export default Roles;
