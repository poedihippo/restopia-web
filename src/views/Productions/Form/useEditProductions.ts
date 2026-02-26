import { IProductionDTO } from "@/@types/productions";
import useGetProduction from "@/hooks/productions/useGetProduction";
import useProductionUpdateMutation from "@/hooks/productions/useProductionUpdateMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { format } from "date-fns";
import { useRouter } from "next/router";
import { useCallback, useEffect } from "react";
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
export type ProductionFormValues = z.infer<typeof Schema>;

interface Props {
  id: number;
}

export const useEditProductions = ({ id }: Props) => {
  const router = useRouter();
  const { data } = useGetProduction(id, {
    include: "branch,media,production_details",
  });
  const updateMutation = useProductionUpdateMutation();

  const form = useForm<ProductionFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      code: "",
      date: "",
      status: "",
      description: "",
      details: [],
    },
  });

  useEffect(() => {
    form.reset({
      code: data?.code,
      date: data?.date ? format(new Date(data.date), "yyyy-MM-dd") : "",
      status: data?.status,
      description: data?.description,
      details:
        data?.production_details?.map((detail) => ({
          product_inventory_id: detail.product_inventory_id,
          qty: detail.qty,
          status: detail.status,
          description: data?.description,
          materials:
            detail.product_detail_materials?.map((material) => ({
              product_inventory_id: material.product_inventory_id,
              qty: material.qty,
            })) ?? [],
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
    async (values: ProductionFormValues) => {
      if (!id) return;

      try {
        const updateData: IProductionDTO = {
          code: values.code,
          date: values.date,
          status: values.status,
          description: values.description,
          details: values.details,
        };

        await updateMutation.mutateAsync({
          id,
          data: updateData,
        });

        toast.success("Production updated successfully");
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
              form.setError(field as keyof ProductionFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to update production");
        }
      }
    },
    [updateMutation, id, form, router],
  );

  return {
    form,
    handleSubmit,
    isSubmitting: updateMutation.isPending,
    detailFields,
    appendDetail,
    removeDetail,
  };
};
