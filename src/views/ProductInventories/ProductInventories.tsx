import { formatDate } from '@/utils/date';
import { IProductInventories } from "@/@types/product-inventories";
import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatterIDR } from "@/helper/convertCurrency";
import { format } from "date-fns";
import { useCallback, useMemo } from "react";
import { ProductInventoriesModal } from "./Modal/ProductInventoriesModal";
import useProductInventories from "./useProductInventories";
import usePermission from "@/hooks/usePermission";
import { PackagePlus, Pencil, Trash2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StockMovementModal } from "../StockMovement/Modal/StockMovementModal";
import Link from "next/link";

const ProductInventories = () => {
  const {
    productInventories,
    products,
    branches,
    pagination,
    search,
    isLoading,
    isLoadingProduct,
    isLoadingBranch,
    handlePageChange,
    handleSearch,
    filterKey,
    handleProductChange,
    handleBranchChange,
    handleDefaultChange,
    handleClearFilter,
    handlePriceEditableChange,
    setBasePriceGte,
    setBasePriceLte,
    setOnlinePriceGte,
    setOnlinePriceLte,
    setExpiryDateGte,
    setExpiryDateLte,
    setStatus,
    setStockGte,
    setStockLte,
    setSelectedId,

    //Modal
    editModal,
    createModal,
    deleteModal,
    createStockMovementModal,
  } = useProductInventories();
  const { canCreate, canUpdate, canDelete } = usePermission();
  const productOptions = useMemo(
    () =>
      products.map((item) => ({
        value: item.id,
        label: `${item.product?.name ?? ""} - ${item.uom?.name ?? ""} - ${item.uom?.code ?? ""}`,
      })),
    [products],
  );

  const branchOptions = useMemo(
    () =>
      branches.map((item) => ({
        value: item.id,
        label: item.name ?? "",
      })),
    [branches],
  );

  const columns: Column<IProductInventories>[] = useMemo(
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
        title: "Product Name",
        key: "product_uom.product.name",
      },
      {
        title: "Product Code",
        key: "product_uom.product.code",
      },
      {
        title: "Branch Name",
        key: "branch.name",
      },
      {
        title: "Stock",
        key: "stock",
      },
      {
        title: "Status",
        key: "status",
        render: (value) => {
          const v = value as string;
          return (
            <p className={v === "active" ? "text-green-500" : "text-red-500"}>
              {v}
            </p>
          );
        },
      },
      {
        title: "Base Price",
        key: "base_price",
        render: (value) => formatterIDR(Number(value)),
      },
      {
        title: "Online Price",
        key: "online_price",
        render: (value) => formatterIDR(Number(value)),
      },
      {
        title: "UOM Code",
        key: "product_uom.uom.code",
      },
      {
        title: "Expiry Date",
        key: "expiry_date",
        render: (value) =>
          value ? formatDate(value as string) : "-",
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
    (_record: IProductInventories, _index: number) => (
      <div className="flex gap-2">
        <button
          className="p-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white cursor-pointer"
          onClick={() => {
            setSelectedId(_record.id);
            createStockMovementModal.openModal();
          }}
        >
          <PackagePlus className="h-4 w-4" />
        </button>
        {canUpdate('product-inventory') && (
          <button
            className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer"
            onClick={() => editModal.openModal(productInventories[_index])}
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {canDelete('product-inventory') && (
          <button
            className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer"
            onClick={() => deleteModal.openModal(productInventories[_index])}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    ),
    [
      productInventories,
      editModal,
      deleteModal,
      createStockMovementModal,
      setSelectedId,
      canUpdate,
      canDelete,
    ],
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Product Inventories</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your product inventories here
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
              key={`product-${filterKey}`}
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
              key={`branch-${filterKey}`}
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

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">More Filters</Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <PopoverHeader>
                  <PopoverTitle>More Filters</PopoverTitle>
                </PopoverHeader>
                <div className="mt-3 flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      Is Default
                    </span>
                    <Select
                      onValueChange={(val) =>
                        handleDefaultChange(
                          val === "all" ? undefined : Number(val),
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="0">False</SelectItem>
                          <SelectItem value="1">True</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      Price Editable?
                    </span>
                    <Select
                      onValueChange={(val) =>
                        handlePriceEditableChange(
                          val === "all" ? undefined : Number(val),
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="1">True</SelectItem>
                          <SelectItem value="0">False</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      Base Price Range
                    </span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Min"
                        onChange={(e) =>
                          setBasePriceGte(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Max"
                        onChange={(e) =>
                          setBasePriceLte(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      Online Price Range
                    </span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Min"
                        onChange={(e) =>
                          setOnlinePriceGte(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Max"
                        onChange={(e) =>
                          setOnlinePriceLte(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      Stock Range
                    </span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Min"
                        onChange={(e) =>
                          setStockGte(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Max"
                        onChange={(e) =>
                          setStockLte(
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      Expiry Range
                    </span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        min={0}
                        placeholder="Start"
                        onChange={(e) =>
                          setExpiryDateGte(e.target.value || undefined)
                        }
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="date"
                        min={0}
                        placeholder="End"
                        onChange={(e) =>
                          setExpiryDateLte(e.target.value || undefined)
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      Status
                    </span>
                    <Select
                      onValueChange={(val) =>
                        setStatus(val === "all" ? undefined : val)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              className="bg-yellow-500 hover:bg-yellow-600"
              onClick={() => handleClearFilter()}
            >
              Clear Filter
            </Button>
          </div>
          <Link href={"/products/product-inventory/stock-movements"}>
            <Button className="bg-blue-500 hover:bg-blue-600">
              Stock Movements
            </Button>
          </Link>
          {canCreate('product-inventory') && (
            <Button
              onClick={() => createModal.openModal()}
              className="w-full sm:w-auto"
            >
              Create Product Inventory
            </Button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={productInventories}
        loading={isLoading}
        emptyText="No product inventories found"
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
        label={deleteModal.selected?.product_uom?.product?.name}
        isDeleting={deleteModal.isDeleting}
      />

      <StockMovementModal
        mode="create"
        isOpen={createStockMovementModal.isOpen}
        onClose={createStockMovementModal.closeModal}
        onSubmit={createStockMovementModal.handleSubmit}
        form={createStockMovementModal.form}
        isSubmitting={createStockMovementModal.isSubmitting}
      />

      {editModal.isOpen && (
        <ProductInventoriesModal
          mode="edit"
          isOpen={editModal.isOpen}
          onClose={editModal.closeModal}
          onSubmit={editModal.handleSubmit}
          form={editModal.form}
          isSubmitting={editModal.isSubmitting}
        />
      )}

      {createModal.isOpen && (
        <ProductInventoriesModal
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

export default ProductInventories;
