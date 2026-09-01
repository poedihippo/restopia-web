import { formatDate } from '@/utils/date';
import { IProductConversions } from "@/@types/product-conversions";
import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import {useEffect, useState,  useCallback, useMemo } from "react";
import { ProductConversionsModal } from "./Modal/ProductConversionsModal";
import useProductConversions from "./useProductConversions";
import usePermission from "@/hooks/usePermission";

const ProductConversions = () => {
  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const {
    productConversions,
    products,
    filterTargetData,
    uoms,
    pagination,
    isLoading,
    search,
    handlePageChange,
    handleSearch,
    handleProductChange,
    handleUomChange,
    handleTargetUomChange,
    isLoadingProduct,
    isLoadingUom,
    editModal,
    createModal,
    deleteModal,
  } = useProductConversions();
  const {
    canCreate,
    canUpdate,
    canDelete,
    canRead
  } = usePermission();

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

  const targetUomsOptions = useMemo(
    () =>
      filterTargetData.map((item) => ({
        value: item.id,
        label: item.name ?? "",
      })),
    [filterTargetData],
  );

  const columns: Column<IProductConversions>[] = useMemo(
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
        title: "Target UOM",
        key: "target_uom.code",
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
    (_record: IProductConversions, _index: number) => (
      <div className="flex gap-2">
        {(<button
          className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer"
          onClick={() => editModal.openModal(productConversions[_index])}
          disabled={!canUpdate('product-conversion')}>
          <Pencil className="h-4 w-4" />
        </button>)}
        {(<button
          className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
          onClick={() => deleteModal.openModal(productConversions[_index])}
          disabled={!canDelete('product-conversion')}>
          <Trash2 className="h-4 w-4" />
        </button>)}
      </div>
    ),
    [productConversions, editModal, deleteModal, canUpdate, canDelete],
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Product Conversions</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your product conversions here
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
              onSearchChange={setDropdownSearch}
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
              onSearchChange={setDropdownSearch}
/>
            <SearchableSelect
              isClearable
              isLoading={isLoadingUom}
              placeholder="Filter by target uom..."
              options={targetUomsOptions}
              onChange={(selected) => {
                const option = selected as { value: number } | null;
                handleTargetUomChange(option?.value);
              }}
              className="w-full sm:w-60"
              onSearchChange={setDropdownSearch}
/>
          </div>
          {(<Button
            onClick={() => createModal.openModal()}
            className="w-full sm:w-auto"
            disabled={!canCreate('product-conversion')}>Create Product Conversion
                        </Button>)}
        </div>
      </div>
      {/* Data Table */}
      <DataTable
        columns={columns}
        data={productConversions}
        loading={isLoading}
        emptyText="No product conversions found"
        pagination={pagination}
        actions={renderActions}
        canRead={canRead("product-conversion")} />
      {/* Modals */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.closeModal}
        onConfirm={deleteModal.handleConfirmDelete}
        label={deleteModal.selected?.product?.name}
        isDeleting={deleteModal.isDeleting}
      />
      {editModal.isOpen && (
        <ProductConversionsModal
          mode="edit"
          isOpen={editModal.isOpen}
          onClose={editModal.closeModal}
          onSubmit={editModal.handleSubmit}
          form={editModal.form}
          isSubmitting={editModal.isSubmitting}
        />
      )}
      {createModal.isOpen && (
        <ProductConversionsModal
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

export default ProductConversions;
