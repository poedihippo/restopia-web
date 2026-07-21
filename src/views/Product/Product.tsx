import { formatDate } from '@/utils/date';
import { IProduct } from "@/@types/product";
import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { ProductModal } from "./Modal/ProductModal";
import useProduct from "./useProduct";
import usePermission from "@/hooks/usePermission";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Product = () => {
  const {
    products,
    pagination,
    isLoading,
    search,
    productCategory,
    isLoadingPC,
    handleProductCategoryChange,
    handlePageChange,
    handleSearch,
    createModal,
    deleteModal,
    editModal,
    setType,
  } = useProduct();
  const {
    canCreate,
    canUpdate,
    canDelete,
    canRead
  } = usePermission();

  const options = useMemo(
    () =>
      productCategory.map((item) => ({
        value: item.id,
        label: item.name ?? "",
      })),
    [productCategory],
  );

  const columns: Column<IProduct>[] = useMemo(
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
        title: "Type",
        key: "type",
      },
      {
        title: "Category Name",
        key: "product_category.name",
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
    (_record: IProduct, _index: number) => (
      <div className="flex gap-2">
        {(<button
          className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer"
          onClick={() => editModal.openModal(products[_index])}
          disabled={!canUpdate('product')}>
          <Pencil className="h-4 w-4" />
        </button>)}
        {(<button
          className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
          onClick={() => deleteModal.openModal(products[_index])}
          disabled={!canDelete('product')}>
          <Trash2 className="h-4 w-4" />
        </button>)}
      </div>
    ),
    [products, editModal, deleteModal, canUpdate, canDelete],
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Products</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your products here
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
              isLoading={isLoadingPC}
              placeholder="Filter by product categories..."
              options={options}
              onChange={(selected) => {
                const option = selected as { value: number } | null;
                handleProductCategoryChange(option?.value);
              }}
              className="w-full sm:w-60"
            />
            <Select
              onValueChange={(val) =>
                setType(val === "all" ? undefined : val)
              }
            >
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="raw">Raw</SelectItem>
                  <SelectItem value="wip">Wip</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {(<Button
            onClick={() => createModal.openModal()}
            className="w-full sm:w-auto"
            disabled={!canCreate('product')}>Create Product
                        </Button>)}
        </div>
      </div>
      {/* Data Table */}
      <DataTable
        columns={columns}
        data={products}
        loading={isLoading}
        emptyText="No products found"
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: handlePageChange,
        }}
        actions={renderActions}
        canRead={canRead("product")} />
      {/* Modals */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.closeModal}
        onConfirm={deleteModal.handleConfirmDelete}
        label={deleteModal.selected?.name}
        isDeleting={deleteModal.isDeleting}
      />
      {editModal.isOpen && (
        <ProductModal
          mode="edit"
          isOpen={editModal.isOpen}
          onClose={editModal.closeModal}
          onSubmit={editModal.handleSubmit}
          form={editModal.form}
          isSubmitting={editModal.isSubmitting}
        />
      )}
      {createModal.isOpen && (
        <ProductModal
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

export default Product;
