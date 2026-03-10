import { ISalesOrderDTO } from "@/@types/sales-orders";
import useMediaMutation from "@/hooks/media/useMediaMutation";
import useSalesOrderMutation from "@/hooks/sales-orders/useSalesOrderMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useRouter } from "next/router";
import { useCallback } from "react";
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

  // optional media fields
  collection_name: z.string().optional(),
  files: z.array(z.instanceof(File)).refine((files) => files.every(f => f.size <= 2_000_000), {
    message: 'Max file size is 2MB'
  })
    .max(5, "Can input more then 5 images")
    .optional(),
});

export type SalesOrderFormValues = z.output<typeof Schema>;

export const useCreateSalesOrders = () => {
  const router = useRouter()
  const createMutation = useSalesOrderMutation();

  const mediaMutation = useMediaMutation();

  const form = useForm<SalesOrderFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      code: "",
      customer_id: 0,
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
      // Optional Media
      collection_name: "general",
      files: []
    },
  });

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
      try {
        const payload: ISalesOrderDTO = {
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

        const result = await createMutation.mutateAsync(payload);
        const id = result.data.data.id;

        if (values.files && values.files.length > 0) {
          const formData = new FormData();
          formData.append('media_type', 'sales_orders')
          formData.append('media_id', String(id))
          formData.append('collection_name', values.collection_name ?? 'general')
          values.files.forEach((file) => {
            formData.append("files", file)
          })
          await mediaMutation.mutateAsync(formData);
        }

        toast.success("Sales Order created successfully");
        router.back()
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
          toast.error(responseData?.message ?? "Failed to create sales order");
        }
      }
    },
    [createMutation, mediaMutation, form, router],
  );

  return {
    form,
    detailFields,
    appendDetail,
    removeDetail,
    handleSubmit,
    isSubmitting: createMutation.isPending,
  };
};
