import { IProductUomDTO } from "@/@types/product-uoms";
import useProductUomsMutation from "@/hooks/product-uoms/useProductUomsMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const Schema = z.object({
  product_id: z.number().min(1, "Please choose product is required"),
  uom_id: z.number().min(1, "Please choose uom is required"),
  code: z.string().min(1, 'Code is required'),
  base_price: z.number().min(1, "Price is required"),
  online_price: z.number().min(1, "Price is required"),
  price_editable: z.string().optional(),
  is_default: z.string().optional(),
});

export type ProductUomsFormValues = z.infer<typeof Schema>;

export const useCreateProductUomsModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);

  const createMutation = useProductUomsMutation();

  const form = useForm<ProductUomsFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      product_id: 0,
      uom_id: 0,
      code: "",
      base_price: 0,
      online_price: 0,
      price_editable: "",
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
    async (values: ProductUomsFormValues) => {
      try {
        const payload: IProductUomDTO = {
          product_id: values.product_id,
          uom_id: values.uom_id,
          code: values.code,
          base_price: values.base_price,
          online_price: values.online_price,
          price_editable: values.price_editable === "1",
          is_default: values.is_default === "1",
        };

        await createMutation.mutateAsync(payload);

        toast.success("Product uoms created successfully");
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
              form.setError(field as keyof ProductUomsFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to create product uoms");
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
