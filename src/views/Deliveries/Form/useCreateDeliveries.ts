import { IDeliveriesDTO } from "@/@types/deliveries";
import useDeliveriesMutation from "@/hooks/deliveries/useDeliveriesMutation";
import useMediaMutation from "@/hooks/media/useMediaMutation";
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
  purchase_order_detail_id: z
    .number()
    .optional(),
  qty: z.number().min(1, "Quantity is required"),
  price: z.number().min(1, "Price is required"),
  status: z.string().min(1, "Please choose status"),
  description: z.string(),
});

const Schema = z.object({
  code: z.string().min(1, "Code is required"),
  target_branch_id: z.number().optional(),
  purchase_order_id: z.number().optional(),
  date: z.string().min(1, "Date is required"),
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
}).superRefine((val, ctx) => {
  if (!val.target_branch_id && !val.purchase_order_id) {
    ctx.addIssue({
      code: 'custom',
      path: ['target_branch_id',],
      message: "Please choose branch or purchase order"
    });
    ctx.addIssue({
      code: 'custom',
      path: ['purchase_order_id',],
      message: "Please choose branch or purchase order"
    });
  }
});

export type DeliveriesFormValues = z.output<typeof Schema>;

export const useCreateDeliveries = () => {
  const router = useRouter()
  const createMutation = useDeliveriesMutation();

  const mediaMutation = useMediaMutation();

  const form = useForm<DeliveriesFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      code: "",
      target_branch_id: 0,
      purchase_order_id: 0,
      date: "",
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
    async (values: DeliveriesFormValues) => {
      try {
        const payload: IDeliveriesDTO = {
          code: values.code,
          ...(values.target_branch_id ? { target_branch_id: values.target_branch_id } : {}),
          ...(values.purchase_order_id ? { purchase_order_id: values.purchase_order_id } : {}),
          date: values.date,
          status: values.status,
          total_price: values.total_price,
          description: values.description,
          details: values.details,
        };

        const result = await createMutation.mutateAsync(payload);
        const id = result.data.data.id;

        if (values.files && values.files.length > 0) {
          const formData = new FormData();
          formData.append('media_type', 'deliveries')
          formData.append('media_id', String(id))
          formData.append('collection_name', values.collection_name ?? 'general')
          values.files.forEach((file) => {
            formData.append("files", file)
          })
          await mediaMutation.mutateAsync(formData);
        }

        toast.success("Delivery created successfully");
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
              form.setError(field as keyof DeliveriesFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to create delivery");
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
