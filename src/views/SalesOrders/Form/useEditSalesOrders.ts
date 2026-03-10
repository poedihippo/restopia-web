import { ISalesOrderDTO } from "@/@types/sales-orders";
import useMediaDeleteMutation from "@/hooks/media/useMediaDeleteMutation";
import useMediaMutation from "@/hooks/media/useMediaMutation";
import useGetSalesOrder from "@/hooks/sales-orders/useGetSalesOrder";
import useSalesOrderUpdateMutation from "@/hooks/sales-orders/useSalesOrderUpdateMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { format } from "date-fns";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const DetailSchema = z.object({
  product_inventory_id: z
    .number()
    .min(1, "Choose at least 1 product inventory"),
  qty: z.number().min(1, "Quantity is required"),
  price: z.number().min(1, "Price is required"),
  status: z.string().min(1, "Please choose status"),
  description: z.string(),
});

const Schema = z.object({
  code: z.string().min(1, "Code is required"),
  customer_id: z.number().min(1, 'Choose at least 1 customer'),
  customer_name: z.string().min(1, "Customer is required"),
  customer_phone: z.string().min(1, "Customer phone is required"),
  date: z.string().min(1, "Date is required"),
  fulfillment_date: z.string().min(1, "Fulfillment date is required"),
  voucher_id: z.number().optional(),
  subtotal_price: z.number().min(1, "Subtotal price is required"),
  discount_price: z.number().min(1, "Discount price is required"),
  total_price: z.number().min(1, "Total price is required"),
  status: z.string().min(1, "Please choose status"),
  description: z.string().min(1, "Description is required"),
  details: z.array(DetailSchema).min(1, "At least 1 detail"),
});
export type SalesOrderFormValues = z.infer<typeof Schema>;

interface Props {
  id: number;
}

export const useEditSalesOrders = ({ id }: Props) => {
  const router = useRouter();
  const [mediaToDelete, setMediaToDelete] = useState<number[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])

  const { data } = useGetSalesOrder(id, {
    include: "created_by,updated_by,branch,customer,media,sales_order_details",
  });

  const allMedia = useMemo(
    () => data?.media ?? []
    , [data])

  const updateMutation = useSalesOrderUpdateMutation();
  const updateMediaMutation = useMediaMutation();
  const deleteMediaMutation = useMediaDeleteMutation();

  const existingMedia = useMemo(
    () => allMedia.filter(m => !mediaToDelete.includes(m.id!))
    , [allMedia, mediaToDelete])

  const handleRemoveExisting = (mediaId: number) => {
    setMediaToDelete(prev => [...prev, mediaId])
  }

  const handleRemoveNewFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddFiles = (newF: File[]) => {
    const totalSlot = 5 - existingMedia.length;
    const merged = [...newFiles, ...newF].slice(0, totalSlot)
    setNewFiles(merged)
  }

  const form = useForm<SalesOrderFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      code: "",
      customer_id: undefined,
      customer_name: "",
      customer_phone: "",
      date: "",
      fulfillment_date: "",
      voucher_id: undefined,
      subtotal_price: 0,
      discount_price: 0,
      total_price: 0,
      status: "",
      description: "",
      details: [],
    },
  });

  useEffect(() => {
    form.reset({
      code: data?.code,
      customer_id: data?.customer_id ?? undefined,
      customer_name: data?.customer_name ?? undefined,
      customer_phone: data?.customer_phone ?? undefined,
      date: data?.date ? format(new Date(data.date), "yyyy-MM-dd") : "",
      fulfillment_date: data?.fulfillment_date ? format(new Date(data.fulfillment_date), "yyyy-MM-dd") : "",
      voucher_id: data?.voucher_id ?? undefined,
      subtotal_price: data?.subtotal_price,
      discount_price: data?.discount_price,
      total_price: data?.total_price,
      status: data?.status,
      description: data?.description,
      details:
        data?.sales_order_details?.map((detail) => ({
          product_inventory_id: detail.product_inventory_id,
          qty: detail.qty,
          status: detail.status,
          price: detail.price,
          description: detail?.description,
        })) ?? [],
    });
  }, [data]);

  const {
    fields: detailFields,
    append: appendDetail,
    remove: removeDetail,
  } = useFieldArray({
    control: form.control,
    name: "details",
  });

  const handleSubmit = useCallback(
    async (values: SalesOrderFormValues) => {
      if (!id) return;

      try {
        const updateData: ISalesOrderDTO = {
          code: values.code,
          customer_id: values.customer_id,
          customer_name: values.customer_name,
          customer_phone: values.customer_phone,
          date: values.date,
          fulfillment_date: values.fulfillment_date,
          voucher_id: values.voucher_id,
          subtotal_price: values.subtotal_price,
          discount_price: values.discount_price,
          total_price: values.total_price,
          status: values.status,
          description: values.description,
          details: values.details,
        };

        await updateMutation.mutateAsync({
          id,
          data: updateData,
        });

        for (const mediaId of mediaToDelete) {
          await deleteMediaMutation.mutateAsync(mediaId)
        }

        if (newFiles.length > 0) {
          const formData = new FormData();
          formData.append('media_type', 'sales_orders')
          formData.append('media_id', String(id))
          formData.append('collection_name', 'general')
          newFiles.forEach((file) => {
            formData.append('files', file)
          })
          await updateMediaMutation.mutateAsync(formData)
        }

        toast.success("Sales Order updated successfully");
        router.back();
      } catch (error: unknown) {
        const axiosError = error as AxiosError<{
          message?: string;
          errors?: Record<string, string[]>;
        }>;
        const responseData = axiosError?.response?.data;

        if (responseData?.errors) {
          const errors = responseData.errors;
          Object.keys(errors).forEach((field) => {
            const fieldErrors = errors[field];
            if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
              form.setError(field as keyof SalesOrderFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to update sales order");
        }
      }
    },
    [updateMutation, updateMediaMutation, deleteMediaMutation, id, form, router, mediaToDelete, newFiles],
  );

  return {
    form,
    handleSubmit,
    isSubmitting: updateMutation.isPending,
    detailFields,
    appendDetail,
    removeDetail,
    existingMedia,
    newFiles,
    handleRemoveExisting,
    handleAddFiles,
    handleRemoveNewFile,
  };
};
