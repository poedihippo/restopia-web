import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { statusProduction } from "@/constants/global";
import useGetProductInventoriesList from "@/hooks/product-inventories/useGetProductInventoriesList";
import { ArrowLeft, Trash, X } from "lucide-react";
import { useRouter } from "next/router";
import { Control, Controller, useFieldArray } from "react-hook-form";
import Image from "next/image";
import { toast } from "sonner";
import { PurchaseOrdersFormValues, useEditPurchaseOrders } from "./useEditPurchaseOrders";
import useGetSupplierList from "@/hooks/suppliers/useGetSupplierList";
import useGetBranchList from "@/hooks/branches/useGetBranchList";

interface DetailRowProps {
  index: number;
  control: Control<PurchaseOrdersFormValues>;
  onRemove: () => void;
}

const DetailRow = ({ control, index, onRemove }: DetailRowProps) => {
  const { data: productInventoryData, isLoading: isLoadingProductInventory } =
    useGetProductInventoriesList(
      {
        include: "branch,product_uom",
      },
      {
        enabled: true,
      },
    );

  return (
    <div className=" my-4 bg-white shadow-xl rounded-md border-2">
      <div className="flex justify-between items-center px-2 py-2">
        <p>Detail {index + 1}</p>
        <Button type="button" variant="destructive" onClick={onRemove}>
          <Trash />
        </Button>
      </div>
      <div className="flex flex-col gap-4 px-2">
        <div className="flex flex-col gap-2">
          <Label>Product Inventory</Label>
          <Controller
            control={control}
            name={`details.${index}.product_inventory_id`}
            render={({ field, fieldState }) => (
              <>
                <SearchableSelect
                  isClearable
                  isLoading={isLoadingProductInventory}
                  placeholder="Select product inventory..."
                  options={
                    productInventoryData?.data?.map((item) => ({
                      value: item.id,
                      label: `${item.branch?.name} - ${item.product_uom?.product?.name}`,
                    })) ?? []
                  }
                  value={
                    productInventoryData?.data
                      ?.filter((item) => item.id === field.value)
                      .map((item) => ({
                        value: item.id,
                        label: `${item.branch?.name} - ${item.product_uom?.product?.name}`,
                      }))[0] ?? null
                  }
                  onChange={(selected) => {
                    field.onChange(
                      selected ? (selected as { value: number }).value : null,
                    );
                  }}
                />
                {fieldState.error && (
                  <p className="text-destructive text-sm">
                    {fieldState.error.message}
                  </p>
                )}
              </>
            )}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Quantity</Label>
          <Controller
            control={control}
            name={`details.${index}.qty`}
            render={({ field, fieldState }) => (
              <>
                <Input
                  {...field}
                  min={0}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  type="number"
                  placeholder="0"
                  aria-invalid={!!fieldState.error}
                />
                {fieldState.error && (
                  <p className="text-destructive text-sm">
                    {fieldState.error.message}
                  </p>
                )}
              </>
            )}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Price</Label>
          <Controller
            control={control}
            name={`details.${index}.price`}
            render={({ field, fieldState }) => (
              <>
                <Input
                  {...field}
                  min={0}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  type="number"
                  placeholder="0"
                  aria-invalid={!!fieldState.error}
                />
                {fieldState.error && (
                  <p className="text-destructive text-sm">
                    {fieldState.error.message}
                  </p>
                )}
              </>
            )}
          />
        </div>
        <div className="flex flex-col gap-2 mb-4">
          <Label>Description</Label>
          <Controller
            control={control}
            name={`details.${index}.description`}
            render={({ field, fieldState }) => (
              <>
                <Textarea
                  {...field}
                  placeholder="John Doe"
                  aria-invalid={!!fieldState.error}
                />
                {fieldState.error && (
                  <p className="text-destructive text-sm">
                    {fieldState.error.message}
                  </p>
                )}
              </>
            )}
          />
        </div>
      </div>
    </div>
  );
};

interface Props {
  id: number;
}

const PurchaseOrdersEditForm = ({ id }: Props) => {
  const router = useRouter();

  const {
    form,
    handleSubmit,
    appendDetail,
    detailFields,
    isSubmitting,
    removeDetail,
    existingMedia,
    newFiles,
    handleRemoveExisting,
    handleAddFiles,
    handleRemoveNewFile
  } = useEditPurchaseOrders({ id });
  const watchedSupplierId = form.watch('supplier_id');
  const watchedSupplierBranchId = form.watch('supplier_branch_id');

  const { data: suppliersData, isLoading: isLoadingSupplier } =
    useGetSupplierList(
      {
        enabled: true,
      },
    );
  const { data: branchData, isLoading: isLoadingBranch } =
    useGetBranchList(
      {
        enabled: true,
      },
    );
  return (
    <div className="w-full">
      <div className="flex gap-4 mb-4">
        <button onClick={() => router.back()}>
          <ArrowLeft />
        </button>
        <p className="font-semibold text-2xl">Back</p>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>Code</Label>
            <Controller
              control={form.control}
              name="code"
              render={({ field, fieldState }) => (
                <>
                  <Input
                    {...field}
                    placeholder="John Doe"
                    aria-invalid={!!fieldState.error}
                  />
                  {fieldState.error && (
                    <p className="text-destructive text-sm">
                      {fieldState.error.message}
                    </p>
                  )}
                </>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Choose Supplier</Label>
            <Controller
              control={form.control}
              name={`supplier_id`}
              render={({ field, fieldState }) => (
                <>
                  <SearchableSelect
                    isClearable
                    isDisabled={!!watchedSupplierBranchId}
                    isLoading={isLoadingSupplier}
                    placeholder="Select supplier..."
                    options={
                      suppliersData?.data?.map((item) => ({
                        value: item.id,
                        label: `${item?.name} - ${item.code}`,
                      })) ?? []
                    }
                    value={
                      suppliersData?.data
                        ?.filter((item) => item.id === field.value)
                        .map((item) => ({
                          value: item.id,
                          label: `${item?.name} - ${item?.code}`,
                        }))[0] ?? null
                    }
                    onChange={(selected) => {
                      field.onChange(
                        selected ? (selected as { value: number }).value : 0,
                      );
                    }}
                  />
                  {fieldState.error && (
                    <p className="text-destructive text-sm">
                      {fieldState.error.message}
                    </p>
                  )}
                </>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Choose Supplier Branch</Label>
            <Controller
              control={form.control}
              name={`supplier_branch_id`}
              render={({ field, fieldState }) => (
                <>
                  <SearchableSelect
                    isClearable
                    isDisabled={!!watchedSupplierId}
                    isLoading={isLoadingBranch}
                    placeholder="Select supplier branch..."
                    options={
                      branchData?.data?.map((item) => ({
                        value: item.id,
                        label: `${item?.name} - ${item.code}`,
                      })) ?? []
                    }
                    value={
                      suppliersData?.data
                        ?.filter((item) => item.id === field.value)
                        .map((item) => ({
                          value: item.id,
                          label: `${item?.name} - ${item?.code}`,
                        }))[0] ?? null
                    }
                    onChange={(selected) => {
                      field.onChange(
                        selected ? (selected as { value: number }).value : 0,
                      );
                    }}
                  />
                  {fieldState.error && (
                    <p className="text-destructive text-sm">
                      {fieldState.error.message}
                    </p>
                  )}
                </>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Date</Label>
            <Controller
              control={form.control}
              name="date"
              render={({ field, fieldState }) => (
                <>
                  <Input
                    {...field}
                    type="date"
                    placeholder="John Doe"
                    aria-invalid={!!fieldState.error}
                  />
                  {fieldState.error && (
                    <p className="text-destructive text-sm">
                      {fieldState.error.message}
                    </p>
                  )}
                </>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Total Price</Label>
            <Controller
              control={form.control}
              name={`total_price`}
              render={({ field, fieldState }) => (
                <>
                  <Input
                    {...field}
                    min={0}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    type="number"
                    placeholder="0"
                    aria-invalid={!!fieldState.error}
                  />
                  {fieldState.error && (
                    <p className="text-destructive text-sm">
                      {fieldState.error.message}
                    </p>
                  )}
                </>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Status</Label>
            <Controller
              control={form.control}
              name="status"
              render={({ field, fieldState }) => (
                <>
                  <div className="flex gap-2">
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                      }}
                      value={field.value}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusProduction?.map((item) => (
                          <SelectItem key={item.key} value={item.key}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {field.value && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => field.onChange("")}
                        className="shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {fieldState.error && (
                    <p className="text-destructive text-sm">
                      {fieldState.error.message}
                    </p>
                  )}
                </>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Description</Label>
            <Controller
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <>
                  <Textarea
                    {...field}
                    placeholder="John Doe"
                    aria-invalid={!!fieldState.error}
                  />
                  {fieldState.error && (
                    <p className="text-destructive text-sm">
                      {fieldState.error.message}
                    </p>
                  )}
                </>
              )}
            />
          </div>
        </div>

        <div>
          <p className="my-4 font-medium">Upload Media (Max 2MB Per Image)</p>
          {newFiles.length > 0 &&
            <Label className="text-xl text-black font-semibold">New Media</Label>
          }
          {existingMedia.length + newFiles.length < 5 && (
            <div className="my-4">
              <Label className="my-2">Add New Images ({5 - existingMedia.length - newFiles.length} slot remaining)</Label>
              <Input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  const selected = Array.from(e.target.files ?? [])

                  const oversized = selected.filter(f => f.size > 2_000_000)
                  const valid = selected.filter(f => f.size <= 2_000_000)

                  if (oversized.length > 0) {
                    toast.warning(`${oversized.length} file(s) skipped: exceeds 2MB limit`)
                  }
                  handleAddFiles(valid)
                  e.target.value = ''
                }}
              />
            </div>
          )}

          <div className="flex gap-2 flex-wrap mt-2">
            {newFiles.map((item, i) => (
              <div key={i} className="relative inline-block">
                <Image height={100} width={100} alt={`new-${i}`} src={URL.createObjectURL(item)} />
                <button
                  type="button"
                  onClick={() => handleRemoveNewFile(i)}
                  className="absolute top-3 right-3 bg-white p-2 rounded-full shadow-lg hover:bg-gray-100 transition cursor-pointer"
                >
                  <Trash className="text-red-500" size={12} />
                </button>
              </div>
            ))}
          </div>

          <p className="mt-4 text-black text-xl font-semibold">Original Image</p>
          {existingMedia.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-4">
              {existingMedia?.map((item) => (
                <div key={item.id} className="relative inline-block">
                  <Image height={100} width={100} alt={item.file_name ?? ''} src={item.url ?? ''} />
                  <button
                    type="button"
                    onClick={() => handleRemoveExisting(item.id!)}
                    className="absolute top-3 right-3 bg-white p-2 rounded-full shadow-lg hover:bg-gray-100 transition cursor-pointer"
                  >
                    <Trash className="text-red-500" size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="my-2">
          <Button
            type="button"
            onClick={() =>
              appendDetail({
                product_inventory_id: 0,
                qty: 0,
                price: 0,
                description: "",
              })
            }
          >
            Add Detail
          </Button>
        </div>
        {detailFields?.map((field, index) => (
          <DetailRow
            key={field.id}
            index={index}
            control={form.control}
            onRemove={() => removeDetail(index)}
          />
        ))}

        <div className="my-2">
          <Button
            className="bg-green-500 hover:bg-green-600 text-white"
            type="submit"
            disabled={isSubmitting}
          >
            Update
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PurchaseOrdersEditForm;
