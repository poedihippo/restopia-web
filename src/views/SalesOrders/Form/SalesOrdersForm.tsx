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
import { statusProduction, statusSalesOrders } from "@/constants/global";
import useGetCustomerList from "@/hooks/customer/useGetCustomerList";
import useGetProductInventoriesList from "@/hooks/product-inventories/useGetProductInventoriesList";
import useGetVoucherList from "@/hooks/voucher/useGetVoucherList";
import { ArrowLeft, Trash, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useMemo } from "react";
import { Control, Controller } from "react-hook-form";
import { toast } from "sonner";
import { SalesOrderFormValues, useCreateSalesOrders } from "./useCreateSalesOrders";

interface DetailRowProps {
  index: number;
  control: Control<SalesOrderFormValues>;
  onRemove: () => void;
}

const DetailRow = ({ control, index, onRemove, }: DetailRowProps) => {
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
        <div className="flex flex-col gap-2">
          <Label>Status</Label>
          <Controller
            control={control}
            name={`details.${index}.status`}
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
                      {statusSalesOrders?.map((item) => (
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

const SalesOrdersForm = () => {
  const router = useRouter();
  const {
    form,
    handleSubmit,
    appendDetail,
    detailFields,
    isSubmitting,
    removeDetail,
  } = useCreateSalesOrders();
  const watchedFiles = form.watch('files');
  const previews = useMemo(() => (watchedFiles ?? []).map((file) => URL.createObjectURL(file)), [watchedFiles])
  const { data: customerData, isLoading: isLoadingCustomer } =
    useGetCustomerList(
      {
        enabled: true,
      },
    );
  const watcherCustomerId = form.watch('customer_id')

  useEffect(() => {
    const selected = customerData?.data?.find((data) => data.id === watcherCustomerId)
    if (selected) {
      form.setValue('customer_name', selected?.name ?? '-')
      form.setValue('customer_phone', selected?.phone ?? '-')
    } else {
      form.setValue('customer_name', '')
      form.setValue('customer_phone', '')
    }
  }, [customerData, watcherCustomerId, form])

  const { data: voucherData, isLoading: isLoadingVoucher } =
    useGetVoucherList(
      {
        enabled: true,
      },
    );
  return (
    <div className="w-full">
      <div className="flex gap-4 mb-4">
        <button onClick={() => router.back()} className="cursor-pointer">
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
            <Label>Choose Customer</Label>
            <Controller
              control={form.control}
              name={`customer_id`}
              render={({ field, fieldState }) => (
                <>
                  <SearchableSelect
                    isClearable
                    isLoading={isLoadingCustomer}
                    placeholder="Select customer..."
                    options={
                      customerData?.data?.map((item) => ({
                        value: item.id,
                        label: `${item?.name}`,
                      })) ?? []
                    }
                    value={
                      customerData?.data
                        ?.filter((item) => item.id === field.value)
                        .map((item) => ({
                          value: item.id,
                          label: `${item?.name}`,
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
            <Label>Customer Name</Label>
            <Controller
              control={form.control}
              name="customer_name"
              render={({ field, fieldState }) => (
                <>
                  <Input
                    {...field}
                    disabled={!!watcherCustomerId}
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
            <Label>Customer Phone</Label>
            <Controller
              control={form.control}
              name="customer_phone"
              render={({ field, fieldState }) => (
                <>
                  <Input
                    {...field}
                    disabled={!!watcherCustomerId}
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
            <Label>Fulfillment Date</Label>
            <Controller
              control={form.control}
              name="fulfillment_date"
              render={({ field, fieldState }) => (
                <>
                  <Input
                    {...field}
                    type="datetime-local"
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
            <Label>Choose Voucher</Label>
            <Controller
              control={form.control}
              name={`voucher_id`}
              render={({ field, fieldState }) => (
                <>
                  <SearchableSelect
                    isClearable
                    isLoading={isLoadingVoucher}
                    placeholder="Select voucher..."
                    options={
                      voucherData?.data?.map((item) => ({
                        value: item.id,
                        label: `${item?.name}`,
                      })) ?? []
                    }
                    value={
                      voucherData?.data
                        ?.filter((item) => item.id === field.value)
                        .map((item) => ({
                          value: item.id,
                          label: `${item?.name}`,
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
            <Label>Subtotal Price</Label>
            <Controller
              control={form.control}
              name={`subtotal_price`}
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
            <Label>Discount Price</Label>
            <Controller
              control={form.control}
              name={`discount_price`}
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

          <div className="flex flex-col gap-2">
            <Label>Collection Name</Label>
            <Controller
              control={form.control}
              name="collection_name"
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
        </div>
        <div>
          <p className="my-4">Upload Media (Max 2MB Per Image)</p>
          <Label>Media</Label>
          <Controller
            control={form.control}
            name="files"
            render={({ field, fieldState }) => (
              <>
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

                    const current = field.value ?? []
                    const merged = [...current, ...valid].slice(0, 5);

                    if (current.length + valid.length > 5) {
                      toast.warning('Max 5 files allowed')
                    }
                    field.onChange(merged)
                  }}
                  aria-invalid={!!fieldState.error}
                />
                {fieldState.error && (
                  <p className="text-destructive text-sm">
                    {fieldState.error.message}
                  </p>
                )}
                {previews.map((url, i) => (
                  <div key={i} className="relative inline-block">
                    <Image height={100} width={100} alt={`previews-${i}`} src={url} />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = field.value?.filter((_, idx) => idx !== i)
                        field.onChange(updated)
                      }}
                      className="absolute top-3 right-3 bg-white p-2 rounded-full shadow-lg hover:bg-gray-100 transition cursor-pointer">
                      <Trash className='text-red-500' size={12} />
                    </button>
                  </div>
                ))}
              </>
            )}
          />
        </div>
        <div className="my-2">
          <Button
            type="button"
            onClick={() =>
              appendDetail({
                product_inventory_id: 0,
                qty: 0,
                price: 0,
                status: "",
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
            Submit
          </Button>
        </div>
      </form>
    </div>
  );
};



export default SalesOrdersForm;
