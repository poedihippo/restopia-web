import { IProductDTO } from "@/@types/product";
import useProductMutation from "@/hooks/product/useProductMutation";
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
  price: z.number().min(1, "Price is required"),
  description: z.string().min(1, "Description is required"),
});

export type ProductsFormValues = z.infer<typeof Schema>;

export const useCreateProductModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);

  const createMutation = useProductMutation();

  const form = useForm<ProductsFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      product_category_id: 0,
      code: "",
      name: "",
      type: "",
      price: 0,
      description: "",
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
    async (values: ProductsFormValues) => {
      try {
        const payload: IProductDTO = {
          product_category_id: values.product_category_id,
          code: values.code,
          name: values.name,
          type: values.type,
          price: values.price,
          description: values.description,
        };

        await createMutation.mutateAsync(payload);

        toast.success("Product created successfully");
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
              form.setError(field as keyof ProductsFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to create product");
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
