import {
  IProductConversions,
  IProductConversionsDTO,
} from "@/@types/product-conversions";
import useProductConversionsUpdateMutation from "@/hooks/product-conversions/useProductConversionsUpdateMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const Schema = z.object({
  product_id: z.number().min(1, "Please choose product is required"),
  uom_id: z.number().min(1, "Please choose uom is required"),
  target_uom_id: z.number().min(1, "Please choose targeted uom is required"),
  amount: z.number().min(1, "Amount is required"),
});

export type ProductConversionsFormValues = z.infer<typeof Schema>;

export const useEditProductConversionsModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<IProductConversions | null>(null);

  const updateMutation = useProductConversionsUpdateMutation();

  const form = useForm<ProductConversionsFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      product_id: 0,
      uom_id: 0,
      target_uom_id: 0,
      amount: 0,
    },
  });

  const openModal = useCallback(
    (item: IProductConversions) => {
      setSelected(item);
      form.reset({
        product_id: item.product_id,
        uom_id: item.uom_id,
        target_uom_id: item.target_uom_id,
        amount: item.amount,
      });
      setIsOpen(true);
    },
    [form],
  );

  const closeModal = useCallback(() => {
    setIsOpen(false);
    form.reset();
  }, [form]);

  const handleSubmit = useCallback(
    async (values: ProductConversionsFormValues) => {
      if (!selected?.id) return;

      try {
        const updateData: IProductConversionsDTO = {
          product_id: values.product_id,
          uom_id: values.uom_id,
          target_uom_id: values.target_uom_id,
          amount: values.amount,
        };

        await updateMutation.mutateAsync({
          id: selected.id,
          data: updateData,
        });

        toast.success("Product conversions updated successfully");
        closeModal();
        onSuccess?.();
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
              form.setError(field as keyof ProductConversionsFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(
            responseData?.message ?? "Failed to update product conversions",
          );
        }
      }
    },
    [updateMutation, selected, closeModal, onSuccess, form],
  );

  return {
    isOpen,
    form,
    openModal,
    closeModal,
    handleSubmit,
    isSubmitting: updateMutation.isPending,
  };
};
