import { IProductionDTO } from "@/@types/productions";
import useProductionMutation from "@/hooks/productions/useProductionMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useRouter } from "next/router";
import { useCallback } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const MaterialSchema = z.object({
  product_inventory_id: z
    .number()
    .min(1, "Choose at least 1 product inventory"),
  qty: z.number().min(1, "Quantity is required"),
});

const DetailSchema = z.object({
  product_inventory_id: z
    .number()
    .min(1, "Choose at least 1 product inventory"),
  qty: z.number().min(1, "Quantity is required"),
  status: z.string().min(1, "Please choose status"),
  description: z.string(),
  materials: z.array(MaterialSchema).min(1, "At least 1 material"),
});

const Schema = z.object({
  code: z.string().min(1, "Code is required"),
  date: z.string().min(1, "Date is required"),
  status: z.string().min(1, "Please choose status"),
  description: z.string().min(1, "Description is required"),
  details: z.array(DetailSchema).min(1, "At least 1 detail"),
});

export type ProductionsFormValues = z.infer<typeof Schema>;

export const useCreateProductions = () => {
  const router = useRouter()
  const createMutation = useProductionMutation();

  const form = useForm<ProductionsFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      code: "",
      date: "",
      status: "",
      description: "",
      details: [],
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
    async (values: ProductionsFormValues) => {
      try {
        const payload: IProductionDTO = {
          code: values.code,
          date: values.date,
          status: values.status,
          description: values.description,
          details: values.details,
        };

        await createMutation.mutateAsync(payload);

        toast.success("Production created successfully");
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
              form.setError(field as keyof ProductionsFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to create production");
        }
      }
    },
    [createMutation, form, router],
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
