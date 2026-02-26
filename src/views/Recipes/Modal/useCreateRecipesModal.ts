import { IRecipeDTO } from "@/@types/recipes";
import useRecipeMutation from "@/hooks/recipes/useRecipeMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const Schema = z.object({
  product_id: z.number().min(1, "Please choose product is required"),
  material_product_id: z.number().min(1, "Please choose material product is required"),
  material_uom_id: z.number().min(1, "Please choose material uom is required"),
  qty: z.number().min(1, "Price is required"),
});

export type RecipesFormValues = z.infer<typeof Schema>;

export const useCreateRecipesModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);

  const createMutation = useRecipeMutation();

  const form = useForm<RecipesFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      product_id: 0,
      material_product_id: 0,
      material_uom_id: 0,
      qty: 0,
    },
  });

  const openModal = useCallback(() => {
    form.reset();
    setIsOpen(true);
  }, [form]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    form.reset();
  }, [form]);

  const handleSubmit = useCallback(
    async (values: RecipesFormValues) => {
      try {
        const payload: IRecipeDTO = {
          product_id: values.product_id,
          material_product_id: values.material_product_id,
          material_uom_id: values.material_uom_id,
          qty: values.qty,
        };

        await createMutation.mutateAsync(payload);

        toast.success("Recipe created successfully");
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
              form.setError(field as keyof RecipesFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to create recipe");
        }
      }
    },
    [createMutation, closeModal, onSuccess, form],
  );

  return {
    isOpen,
    form,
    openModal,
    closeModal,
    handleSubmit,
    isSubmitting: createMutation.isPending,
  };
};
