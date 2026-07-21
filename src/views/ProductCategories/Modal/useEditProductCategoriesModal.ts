import { IProductCategories, IProductCategoriesDTO } from "@/@types/product-categories";
import useProductCategoriesUpdateMutation from "@/hooks/product-categories/useProductCategoriesUpdateMutation";
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

export const useEditProductCategoriesModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<IProductCategories | null>(null);

  const updateMutation = useProductCategoriesUpdateMutation();

  const form = useForm<ProductCategoriesFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      name: "",
    },
  });

  const openModal = useCallback(
    (item: IProductCategories) => {
      setSelected(item);
      form.reset({
        name: item.name,
      });
      setIsOpen(true);
    },
    [form],
  );

  const closeModal = useCallback(() => {
    setIsOpen(false);
    form.reset({ name: "" });
    setSelected(null);
  }, [form]);

  const handleSubmit = useCallback(
    async (values: ProductCategoriesFormValues) => {
      if (!selected?.id) return;

      try {
        const updateData: IProductCategoriesDTO = {
          name: values.name,
        };

        await updateMutation.mutateAsync({
          id: selected.id,
          data: updateData,
        });

        toast.success("Product categories updated successfully");
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
          toast.error(responseData?.message ?? "Failed to update product categories");
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
