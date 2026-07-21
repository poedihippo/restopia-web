import { IProductCategoriesDTO } from "@/@types/product-categories";
import useProductCategoriesMutation from "@/hooks/product-categories/useProductCategoriesMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const Schema = z.object({
  name: z.string().min(1, "Name is required"),
});

export type ProductCategoriesFormValues = z.infer<typeof Schema>;

export const useCreateProductCategoriesModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);

  const createMutation = useProductCategoriesMutation();

  const form = useForm<ProductCategoriesFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      name: "",
    },
  });

  const openModal = useCallback(() => {
    form.reset({ name: "" });
    setIsOpen(true);
  }, [form]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    form.reset({ name: "" });
  }, [form]);

  const handleSubmit = useCallback(
    async (values: ProductCategoriesFormValues) => {
      try {
        const payload: IProductCategoriesDTO = {
          name: values.name,
        };

        await createMutation.mutateAsync(payload);

        toast.success("Product categories created successfully");
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
              form.setError(field as keyof ProductCategoriesFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to create product categories");
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
