import { IReceiptDTO } from "@/@types/receipts";
import useMediaMutation from "@/hooks/media/useMediaMutation";
import useReceiptsMutation from "@/hooks/receipts/useReceiptsMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useRouter } from "next/router";
import { useCallback } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const DetailSchema = z.object({
  client_ref: z.string().optional(),
  product_inventory_id: z
    .number()
    .min(1, "Choose at least 1 product inventory"),
  delivery_detail_id: z
    .number()
    .min(1, "Choose at least 1 delivery detail"),
  qty: z.number().min(1, "Quantity is required"),
  price: z.number().min(1, "Price is required"),
  status: z.string().min(1, 'Please choose status'),
  description: z.string(),
});

const Schema = z.object({
  code: z.string().min(1, "Code is required"),
  delivery_id: z.number().min(1, 'Please choose delivery'),
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
});

export type ReceiptsFormValues = z.output<typeof Schema>;

export const useCreateReceipts = () => {
  const router = useRouter()
  const createMutation = useReceiptsMutation();

  const mediaMutation = useMediaMutation();

  const form = useForm<ReceiptsFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      code: "",
      delivery_id: 0,
      date: "",
      total_price: 0,
      status: "pending",
      description: "",
      details: [],
      // Optional Media
      collection_name: "general",
      files: []
    },
  });

  const {
    fields: detailFields,
  } = useFieldArray({
    control: form.control,
    name: "details",
  });


  const handleSubmit = useCallback(
    async (values: ReceiptsFormValues) => {
      try {
        const payload: IReceiptDTO = {
          code: values.code,
          delivery_id: values.delivery_id,
          date: values.date,
          status: values.status,
          total_price: values.total_price,
          description: values.description,
          details: values.details.map((d, i) => ({
            ...d,
            client_ref: `receipts${i + 1}`
          })),
        };

        const result = await createMutation.mutateAsync(payload);
        const id = result.data.data.id;

        if (values.files && values.files.length > 0) {
          const formData = new FormData();
          formData.append('media_type', 'receipts')
          formData.append('media_id', String(id))
          formData.append('collection_name', values.collection_name ?? 'general')
          values.files.forEach((file) => {
            formData.append("files", file)
          })
          await mediaMutation.mutateAsync(formData);
        }

        toast.success("Receipt created successfully");
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
              form.setError(field as keyof ReceiptsFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to create receipt");
        }
      }
    },
    [createMutation, mediaMutation, form, router],
  );

  return {
    form,
    detailFields,
    handleSubmit,
    isSubmitting: createMutation.isPending,
  };
};
