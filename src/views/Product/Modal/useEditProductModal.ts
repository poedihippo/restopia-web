import { IProduct, IProductDTO } from "@/@types/product";
import useProductUpdateMutation from "@/hooks/product/useProductUpdateMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const Schema = z.object({
  product_category_id: z.number().min(1, "Pick at least 1 product category"),
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  description: z.string().min(1, "Description is required"),
});

export type ProductFormValues = z.infer<typeof Schema>;

export const useEditProductModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<IProduct | null>(null);

  const updateMutation = useProductUpdateMutation();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      product_category_id: 0,
      code: "",
      name: "",
      type: "",
      description: "",
    },
  });

  const openModal = useCallback(
    (item: IProduct) => {
      setSelected(item);
      form.reset({
        product_category_id: item.product_category_id,
        code: item.code,
        name: item.name,
        type: item.type,
        description: item.description,
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
    async (values: ProductFormValues) => {
      if (!selected?.id) return;

      try {
        const updateData: IProductDTO = {
          product_category_id: values.product_category_id,
          code: values.code,
          name: values.name,
          type: values.type,
          description: values.description,
        };

        await updateMutation.mutateAsync({
          id: selected.id,
          data: updateData,
        });

        toast.success("Product updated successfully");
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
              form.setError(field as keyof ProductFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to update product");
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
