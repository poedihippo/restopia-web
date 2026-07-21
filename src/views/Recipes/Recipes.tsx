import { formatDate } from '@/utils/date';
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { RecipesModal } from "./Modal/RecipesModal";
import useRecipes from "./useRecipes";
import usePermission from "@/hooks/usePermission";
import { Column, DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Input } from "@/components/ui/input";
import { IRecipe } from "@/@types/recipes";
import { useCallback, useMemo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

const Recipes = () => {
  const {
    recipes,
    products,
    pagination,
    isLoading,
    search,
    isLoadingProduct,
    handleProductChange,
    handlePageChange,
    handleSearch,
    editModal,
    createModal,
    deleteModal,
  } = useRecipes();
  const {
    canCreate,
    canUpdate,
    canDelete,
    canRead
  } = usePermission();

  const options = useMemo(
    () =>
      products.map((item) => ({
        value: item.id,
        label: item.name ?? "",
      })),
    [products],
  );

  const columns: Column<IRecipe>[] = useMemo(
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
        title: "Material Product",
        key: "material_product.name",
      },
      {
        title: "Material Uom",
        key: "material_uom.name",
      },
      {
        title: "Quantity",
        key: "qty",
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
    (_record: IRecipe, _index: number) => (
      <div className="flex gap-2">
        {(<button
          className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer"
          onClick={() => editModal.openModal(recipes[_index])}
          disabled={!canUpdate('recipe')}>
          <Pencil className="h-4 w-4" />
        </button>)}
        {(<button
          className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
          onClick={() => deleteModal.openModal(recipes[_index])}
          disabled={!canDelete('recipe')}>
          <Trash2 className="h-4 w-4" />
        </button>)}
      </div>
    ),
    [recipes, editModal, deleteModal, canUpdate, canDelete],
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Recipes</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your recipes here
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
              options={options}
              onChange={(selected) => {
                const option = selected as { value: number } | null;
                handleProductChange(option?.value);
              }}
              className="w-full sm:w-60"
            />
          </div>
          {(<Button
            onClick={() => createModal.openModal()}
            className="w-full sm:w-auto"
            disabled={!canCreate('recipe')}>Create Recipe
                        </Button>)}
        </div>
      </div>
      {/* Data Table */}
      <DataTable
        columns={columns}
        data={recipes}
        loading={isLoading}
        emptyText="No recipes found"
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: handlePageChange,
        }}
        actions={renderActions}
        canRead={canRead("recipe")} />
      {/* Modals */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.closeModal}
        onConfirm={deleteModal.handleConfirmDelete}
        label={deleteModal.selected?.product?.name}
        isDeleting={deleteModal.isDeleting}
      />
      {editModal.isOpen && (
        <RecipesModal
          mode="edit"
          isOpen={editModal.isOpen}
          onClose={editModal.closeModal}
          onSubmit={editModal.handleSubmit}
          form={editModal.form}
          isSubmitting={editModal.isSubmitting}
          fields={editModal.fields}
          append={editModal.append}
          remove={editModal.remove}
        />
      )}
      {createModal.isOpen && (
        <RecipesModal
          mode="create"
          isOpen={createModal.isOpen}
          onClose={createModal.closeModal}
          onSubmit={createModal.handleSubmit}
          form={createModal.form}
          isSubmitting={createModal.isSubmitting}
          fields={createModal.fields}
          append={createModal.append}
          remove={createModal.remove}
        />
      )}
    </div>
  );
};

export default Recipes;
