import { formatDateTime } from '@/utils/date';
import { IStockMovement } from "@/@types/stock-movements";
import { Column, DataTable } from "@/components/ui/data-table";
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
import { format } from "date-fns";
import { useMemo } from "react";
import useStockMovement from "./useStockMovement";

const StockMovement = () => {
  const {
    stockMovements,
    products,
    branches,
    pagination,
    search,
    isLoading,
    isLoadingProduct,
    isLoadingBranch,
    setDirection,
    setReferenceType,
    handlePageChange,
    handleSearch,
    handleBranchChange,
    handleProductInventoriesChange,
  } = useStockMovement();

  const productOptions = useMemo(
    () =>
      products.map((item) => ({
        value: item.id,
        label: `${item?.product_uom?.product?.name ?? ""} - ${item.branch?.name ?? ""} - ${item.product_uom?.uom?.code}`,
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

  const columns: Column<IStockMovement>[] = useMemo(
    () => [
      {
        title: "ID",
        key: "id",
      },
      {
        title: "Product Inventory",
        key: "product_inventory.product_uom.product.name",
      },
      {
        title: "Product UOM Code",
        key: "product_inventory.product_uom.uom.code",
      },
      {
        title: "Branch Name",
        key: "branch.name",
      },
      {
        title: "Branch Code",
        key: "branch.code",
      },
      {
        title: "Quantity",
        key: "qty",
      },
      {
        title: "Stock Before",
        key: "stock_before",
      },
      {
        title: "Stock After",
        key: "stock_after",
      },
      {
        title: "Created By",
        key: "created_by.name",
      },
      {
        title: "Created At",
        key: "created_at",
        render: (value) => formatDateTime(value as string),
      },
    ],
    [],
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Stock Movements</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your stock movements here
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
              placeholder="Filter by product inventories..."
              options={productOptions}
              onChange={(selected) => {
                const option = selected as { value: number } | null;
                handleProductInventoriesChange(option?.value);
              }}
              className="w-full sm:w-80"
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
            <Select onValueChange={(val) => setDirection(val)}>
              <SelectTrigger className="w-full sm:w-60">
                <SelectValue placeholder="Select Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="in">Increase</SelectItem>
                  <SelectItem value="out">Decrease</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select onValueChange={(val) => setReferenceType(val)}>
              <SelectTrigger className="w-full sm:w-60">
                <SelectValue placeholder="Select Reference Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="receipts">Receipts</SelectItem>
                  <SelectItem value="sales_orders">Sales Orders</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={stockMovements}
        loading={isLoading}
        emptyText="No stock movements found"
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: handlePageChange,
        }}
      />
    </div>
  );
};

export default StockMovement;
