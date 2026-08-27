import { formatDate } from '@/utils/date';
import { IProductCategories } from "@/@types/product-categories";
import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { ProductCategoriesModal } from "./Modal/ProductCategoriesModal";
import useProductCategories from "./useProductCategories";
import usePermission from "@/hooks/usePermission";

const ProductCategories = () => {
  const {
    productCategories,
    pagination,
    isLoading,
    search,
    handlePageChange,
    handleSearch,
    createModal,
    deleteModal,
    editModal,
  } = useProductCategories();
  const {
    canCreate,
    canUpdate,
    canDelete,
    canRead
  } = usePermission();

  const columns: Column<IProductCategories>[] = useMemo(
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
        render: (value) => formatDate(value as string),
      },
    ],
    [],
  );

  const renderActions = useCallback(
    (_record: IProductCategories, _index: number) => (
      <div className="flex gap-2">
        {(<button
          className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer"
          onClick={() => editModal.openModal(productCategories[_index])}
          disabled={!canUpdate('product-category')}>
          <Pencil className="h-4 w-4" />
        </button>)}
        {(<button
          className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
          onClick={() => deleteModal.openModal(productCategories[_index])}
          disabled={!canDelete('product-category')}>
          <Trash2 className="h-4 w-4" />
        </button>)}
      </div>
    ),
    [productCategories, editModal, deleteModal, canUpdate, canDelete],
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Product Categories</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your product categories here
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
            disabled={!canCreate('product-category')}>Create Product Categories
                        </Button>)}
        </div>
      </div>
      {/* Data Table */}
      <DataTable
        columns={columns}
        data={productCategories}
        loading={isLoading}
        emptyText="No product categories found"
        pagination={pagination}
        actions={renderActions}
        canRead={canRead("product-category")} />
      {/* Modals */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.closeModal}
        onConfirm={deleteModal.handleConfirmDelete}
        label={deleteModal.selected?.name}
        isDeleting={deleteModal.isDeleting}
      />
      {editModal.isOpen && (
        <ProductCategoriesModal
          mode="edit"
          isOpen={editModal.isOpen}
          onClose={editModal.closeModal}
          onSubmit={editModal.handleSubmit}
          form={editModal.form}
          isSubmitting={editModal.isSubmitting}
        />
      )}
      {createModal.isOpen && (
        <ProductCategoriesModal
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

export default ProductCategories;
