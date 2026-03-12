import { IRecipeDTO } from "@/@types/recipes";
import useRecipeMutation from "@/hooks/recipes/useRecipeMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const MaterialSchema = z.object({
  product_id: z
    .number()
    .min(1, "Choose at least 1 product"),
  uom_id: z
    .number()
    .min(1, "Choose at least 1 uom"),
  qty: z.number().min(1, "Quantity is required"),
});


const Schema = z.object({
  product_id: z.number().min(1, "Please choose product is required"),
  qty: z.number().min(1, "Price is required"),
  is_default: z.string().min(1, "Default is required"),
  materials: z.array(MaterialSchema).min(1, "At least 1 material")
});

export type RecipesFormValues = z.infer<typeof Schema>;

export const useCreateRecipesModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);

  const createMutation = useRecipeMutation();

  const form = useForm<RecipesFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      product_id: 0,
      qty: 0,
      is_default: "",
      materials: []
    },
  });

  const {
    fields,
    append,
    remove
  } = useFieldArray({
    control: form.control,
    name: 'materials'
  })

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
          qty: values.qty,
          is_default: values.is_default === "1",
          materials: values.materials
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
    append,
    fields,
    remove,
  };
};
