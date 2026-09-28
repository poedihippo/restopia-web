import { useState, useEffect } from 'react';
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
import { statusProduction, SalesOrderType } from "@/constants/global";
import useGetProductInventoriesList from "@/hooks/product-inventories/useGetProductInventoriesList";
import { ArrowLeft, Trash, X } from "lucide-react";
import { useRouter } from "next/router";
import { Control, Controller, FormProvider, useFormContext, useWatch } from "react-hook-form";
import Image from "next/image";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getProductUomName } from "@/utils/productUomName";
import { PurchaseOrdersFormValues, useEditPurchaseOrders } from "./useEditPurchaseOrders";
import useGetSupplierList from "@/hooks/suppliers/useGetSupplierList";
import useGetBranchList from "@/hooks/branches/useGetBranchList";

interface DetailRowProps {
  index: number;
  control: Control<PurchaseOrdersFormValues>;
  watchedType: string;
  onRemove: () => void;
}

const DetailRow = ({ control, index, watchedType, onRemove }: DetailRowProps) => {
  const { setValue } = useFormContext<PurchaseOrdersFormValues>();
  const { data: productInventoryData, isLoading: isLoadingProductInventory } =
    useGetProductInventoriesList(
      {
        include: "branch,product_uom",
      },
      {
        enabled: true,
      },
    );
  const { hasPermission } = useAuth()
  const canReadFranchisePrice = hasPermission('common.franchise-price.read')

  const qty = useWatch({ control, name: `details.${index}.qty` }) || 0
  const price = useWatch({ control, name: `details.${index}.price` }) || 0
  const totalPrice = qty * price

  const selectedProductId = useWatch({ control, name: `details.${index}.product_inventory_id` });
  const selectedProduct = productInventoryData?.data?.find(item => item.id === selectedProductId);

  return (
    <tr className="border-b align-middle">
      <td className="py-2 px-3 text-sm text-muted-foreground text-center">{index + 1}</td>
      <td className="py-2 px-3">
        <Controller
          control={control}
          name={`details.${index}.product_inventory_id`}
          render={({ field, fieldState }) => (
            <>
              <SearchableSelect
                isClearable
                isLoading={isLoadingProductInventory}
                placeholder="Select product inventory..."
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                menuPosition="fixed"
                options={
                  productInventoryData?.data?.map((item) => ({
                    value: item.id,
                    label: `${item.branch?.name} - ${getProductUomName(item.product_uom, item.product_uom?.product?.name)} - ${item.product_uom?.uom?.code}`,
                  })) ?? []
                }
                value={
                  productInventoryData?.data
                    ?.filter((item) => item.id === field.value)
                    .map((item) => ({
                      value: item.id,
                      label: `${item.branch?.name} - ${getProductUomName(item.product_uom, item.product_uom?.product?.name)} - ${item.product_uom?.uom?.code}`,
                    }))[0] ?? null
                }
                onChange={(selected) => {
                  const id = selected ? (selected as { value: number }).value : null;
                  field.onChange(id)
                  const product = productInventoryData?.data?.find(item => item.id === id);
                  const price = watchedType === 'offline' ? (product?.product_uom?.base_price ?? 0) : watchedType === 'online' ? (product?.product_uom?.online_price ?? 0) : (product?.product_uom?.franchise_price ?? 0);
                  setValue(`details.${index}.price`, price);
                }}
              />
              {fieldState.error && (
                <p className="text-destructive text-xs mt-1">
                  {fieldState.error.message}
                </p>
              )}
            </>
          )}
        />
      </td>
      <td className="py-2 px-3">
        <Controller
          control={control}
          name={`details.${index}.qty`}
          render={({ field, fieldState }) => (
            <>
              <Input
                {...field}
                min={0}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
                max={selectedProduct?.stock ?? undefined}
                type="number"
                placeholder="0"
                aria-invalid={!!fieldState.error}
              />
              {fieldState.error && (
                <p className="text-destructive text-xs mt-1">
                  {fieldState.error.message}
                </p>
              )}
            </>
          )}
        />
      </td>
      <td className="py-2 px-3">
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
                <p className="text-destructive text-xs mt-1">
                  {fieldState.error.message}
                </p>
              )}
            </>
          )}
        />
      </td>
      <td className="py-2 px-3 align-top">
        <div className="flex flex-col">
          <Input
            value={totalPrice}
            readOnly
            className="w-full bg-muted"
            type="number"
          />
        </div>
      </td>
      <td className="py-2 px-3">
        <Controller
          control={control}
          name={`details.${index}.description`}
          render={({ field, fieldState }) => (
            <>
              <Textarea
                {...field}
                placeholder="Description..."
                aria-invalid={!!fieldState.error}
                className="min-h-9.5 resize-none"
              />
              {fieldState.error && (
                <p className="text-destructive text-xs mt-1">
                  {fieldState.error.message}
                </p>
              )}
            </>
          )}
        />
      </td>
      <td className="py-2 px-3 text-center">
        <button
          type="button"
          onClick={onRemove}
          className="text-destructive hover:text-destructive/70 transition-colors p-1 rounded"
        >
          <Trash size={16} />
        </button>
      </td>
    </tr>
  );
};

interface Props {
  id: number;
}

const PurchaseOrdersEditForm = ({ id }: Props) => {
  const router = useRouter();
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch]);

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
  const watchedType = form.watch('type');

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

      <FormProvider {...form}>
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
                        branchData?.data
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
                      readOnly
                      type="number"
                      placeholder="0"
                      aria-invalid={!!fieldState.error}
                      className="bg-muted cursor-not-allowed"
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
              <Label>Type</Label>
              <Controller
                control={form.control}
                name="type"
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
                          {SalesOrderType?.map((item) => (
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

          <div className="w-full mt-6">
            <div className="border rounded-md">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="py-2 px-3 text-left font-medium text-muted-foreground w-10">#</th>
                    <th className="py-2 px-3 text-left font-medium text-muted-foreground">Product</th>
                    <th className="py-2 px-3 text-left font-medium text-muted-foreground w-32">Qty</th>
                    <th className="py-2 px-3 text-left font-medium text-muted-foreground w-36">Price</th>
                    <th className="py-2 px-3 text-left font-medium text-muted-foreground w-36">Total Price</th>
                    <th className="py-2 px-3 text-left font-medium text-muted-foreground">Description</th>
                    <th className="py-2 px-3 text-left font-medium text-muted-foreground w-16">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {detailFields?.map((field, index) => (
                    <DetailRow key={field.id} index={index} control={form.control} watchedType={watchedType} onRemove={() => removeDetail(index)} />
                  ))}
                  {detailFields.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground text-sm">
                        No details added. Click &quot;+ Add Detail&quot; to start.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() =>
                appendDetail({
                  product_inventory_id: 0,
                  qty: 1,
                  price: 0,
                  description: "",
                })
              }
            >+ Add Detail</Button>
          </div>

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
      </FormProvider>
    </div>
  );
};

export default PurchaseOrdersEditForm;
