import { IProductUom } from "@/@types/product-uoms";
import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { ProductUomsModal } from "./Modal/ProductUomsModal";
import useProductUoms from "./useProductUoms";
import usePermission from "@/hooks/usePermission";
import { formatterIDR } from "@/helper/convertCurrency";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
const ProductUoms = () => {
  const {
    productUom,
    products,
    uoms,
    pagination,
    search,
    isLoading,
    isLoadingProduct,
    isLoadingUom,
    handlePageChange,
    handleSearch,
    handleProductChange,
    handleUomChange,
    handleDefaultChange,
    setPriceGte,
    setPriceLte,
    editModal,
    createModal,
    deleteModal,
  } = useProductUoms();
  const { canCreate, canUpdate, canDelete } = usePermission();

  const productOptions = useMemo(
    () =>
      products.map((item) => ({
        value: item.id,
        label: item.name ?? "",
      })),
    [products],
  );

  const uomOptions = useMemo(
    () =>
      uoms.map((item) => ({
        value: item.id,
        label: item.name ?? "",
      })),
    [uoms],
  );

  const columns: Column<IProductUom>[] = useMemo(
    () => [
      {
        title: "ID",
        key: "id",
      },
      {
        title: "Product Name",
        key: "product.name",
      },
      {
        title: "Product Code",
        key: "product.code",
      },
      {
        title: "UOM",
        key: "uom.code",
      },
      {
        title: "Price",
        key: "price",
        render: (value) => formatterIDR(Number(value)),
      },
      {
        title: "Is Default?",
        key: "is_default",
        render: (value) => (value ? "True" : "False"),
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
    (_record: IProductUom, _index: number) => (
      <div className="flex gap-2">
        {canUpdate('product-uom') && (
          <button
            className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer"
            onClick={() => editModal.openModal(productUom[_index])}
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {canDelete('product-uom') && (
          <button
            className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
            onClick={() => deleteModal.openModal(productUom[_index])}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    ),
    [productUom, editModal, deleteModal, canUpdate, canDelete],
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Product Uoms</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your product uoms here
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
              isLoading={isLoadingProduct}
              placeholder="Filter by product..."
              options={productOptions}
              onChange={(selected) => {
                const option = selected as { value: number } | null;
                handleProductChange(option?.value);
              }}
              className="w-full sm:w-60"
            />
            <SearchableSelect
              isClearable
              isLoading={isLoadingUom}
              placeholder="Filter by uom..."
              options={uomOptions}
              onChange={(selected) => {
                const option = selected as { value: number } | null;
                handleUomChange(option?.value);
              }}
              className="w-full sm:w-60"
            />
            <Select
              onValueChange={(val) =>
                handleDefaultChange(val === "all" ? undefined : Number(val))
              }
            >
              <SelectTrigger className="w-full max-w-48">
                <SelectValue placeholder="Select a default" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="0">False</SelectItem>
                  <SelectItem value="1">True</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                placeholder="Min price"
                onChange={(e) =>
                  setPriceGte(
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                min={0}
                placeholder="Max price"
                onChange={(e) =>
                  setPriceLte(
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
              />
            </div>
          </div>
          {canCreate('product-uom') && (
            <Button
              onClick={() => createModal.openModal()}
              className="w-full sm:w-auto"
            >
              Create Product Uom
            </Button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={productUom}
        loading={isLoading}
        emptyText="No product uoms found"
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
        label={deleteModal.selected?.product?.name}
        isDeleting={deleteModal.isDeleting}
      />

      {editModal.isOpen && (
        <ProductUomsModal
          mode="edit"
          isOpen={editModal.isOpen}
          onClose={editModal.closeModal}
          onSubmit={editModal.handleSubmit}
          form={editModal.form}
          isSubmitting={editModal.isSubmitting}
        />
      )}

      {createModal.isOpen && (
        <ProductUomsModal
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

export default ProductUoms;
