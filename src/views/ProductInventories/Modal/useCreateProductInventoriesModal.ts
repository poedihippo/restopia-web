import { IProductInventoriesDTO } from "@/@types/product-inventories";
import useProductInventoriesMutation from "@/hooks/product-inventories/useProductInventoriesMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { format } from "date-fns";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const Schema = z.object({
  product_uom_id: z.number().min(1, "Please choose product is required"),
  sku: z.string().min(1, "SKU is required"),
  price: z.number().min(1, "Price is required"),
  expiry_date: z.string().min(1, "Expiry date is required"),
  status: z.string().min(1, "status is required"),
  is_default: z.string().optional(),
});

export type ProductInventoriesFormValues = z.infer<typeof Schema>;

export const useCreateProductInventoriesModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);

  const createMutation = useProductInventoriesMutation();

  const form = useForm<ProductInventoriesFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      product_uom_id: 0,
      sku: "",
      price: 0,
      expiry_date: "",
      status: "",
      is_default: "",
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
    async (values: ProductInventoriesFormValues) => {
      try {
        const payload: IProductInventoriesDTO = {
          product_uom_id: values.product_uom_id,
          sku: values.sku,
          price: values.price,
          expiry_date: format(values.expiry_date, "yyyy-MM-dd"),
          status: values.status,
          is_default: values.is_default === "1",
        };

        await createMutation.mutateAsync(payload);

        toast.success("Product inventories created successfully");
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
              form.setError(field as keyof ProductInventoriesFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(
            responseData?.message ?? "Failed to create product inventories",
          );
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
