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
import { statusReceipts } from "@/constants/global";
import useGetDeliveries from "@/hooks/deliveries/useGetDeliveries";
import useGetDeliveriesList from "@/hooks/deliveries/useGetDeliveriesList";
import { ArrowLeft, Trash, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { Control, Controller } from "react-hook-form";
import { toast } from "sonner";
import { ReceiptsFormValues, useEditReceipts } from "./useEditReceipts";

interface DetailRowProps {
  index: number;
  control: Control<ReceiptsFormValues>;
  productName: string

}

const DetailRow = ({ control, index, productName }: DetailRowProps) => {

  return (
    <div className=" my-4 bg-white shadow-xl rounded-md border-2">
      <div className="flex justify-between items-center px-2 py-2">
        <p>Detail {index + 1} - {productName}</p>

      </div>
      <div className="flex flex-col gap-4 px-2">

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
                      {statusReceipts?.map((item) => (
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

interface Props {
  id: number;
}

const ReceiptsFormEdit = ({ id }: Props) => {
  const router = useRouter();

  const {
    form,
    handleSubmit,
    detailFields,
    isSubmitting,
    existingMedia,
    newFiles,
    handleRemoveExisting,
    handleAddFiles,
    handleRemoveNewFile,
    receiptData
  } = useEditReceipts({ id });
  const selectedDeliveryId = form.watch('delivery_id');

  const { data: deliveryData, isLoading: isLoadingDelivery } =
    useGetDeliveriesList(
      {
        include: 'created_by,updated_by,branch,target_branch,purchase_order,media,delivery_details'
      },
      {
        enabled: true,
      },
    );

  const { data: selectedDelivery } = useGetDeliveries(
    selectedDeliveryId,
    { include: 'created_by,updated_by,branch,target_branch,purchase_order,media,delivery_details' },
    !!selectedDeliveryId && selectedDeliveryId > 0
  );

  useEffect(() => {
    if (!selectedDelivery?.delivery_details) return;
    if (selectedDelivery.id === receiptData?.delivery_id) return;
    form.setValue('details', selectedDelivery?.delivery_details?.map((d) => ({
      delivery_detail_id: d.id,
      product_inventory_id: d.product_inventory_id ?? 0,
      qty: d.qty ?? 0,
      price: d.price ?? 0,
      status: d.status ?? 'pending',
      description: d.description ?? ''
    })))
  }, [selectedDelivery])
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
            <Label>Choose Delivery</Label>
            <Controller
              control={form.control}
              name={`delivery_id`}
              render={({ field, fieldState }) => (
                <>
                  <SearchableSelect
                    isClearable
                    isLoading={isLoadingDelivery}
                    placeholder="Select delivery..."
                    options={
                      deliveryData?.data?.map((item) => ({
                        value: item.id,
                        label: `${item?.branch?.name} - ${item.code}`,
                      })) ?? []
                    }
                    value={
                      deliveryData?.data
                        ?.filter((item) => item.id === field.value)
                        .map((item) => ({
                          value: item.id,
                          label: `${item?.branch?.name} - ${item?.code}`,
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
                        {statusReceipts?.map((item) => (
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

        {detailFields?.map((field, index) => {
          const isDeliveryChange = selectedDelivery && selectedDelivery.id !== receiptData?.delivery_id
          const productName = isDeliveryChange ?
            selectedDelivery.delivery_details?.[index]?.product_inventory?.product_uom?.product?.name ?? '-'
            : receiptData?.receipt_details?.[index]?.product_inventory?.product_uom?.product?.name ?? '-'
          return (
            <DetailRow
              key={field.id}
              index={index}
              control={form.control}
              productName={productName}
            />
          )
        })}

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

export default ReceiptsFormEdit;
