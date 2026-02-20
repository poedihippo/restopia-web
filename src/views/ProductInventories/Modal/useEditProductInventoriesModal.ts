import {
  IProductInventories,
  IProductInventoriesDTO,
} from "@/@types/product-inventories";
import useProductInventoriesUpdateMutation from "@/hooks/product-inventories/useProductInventoriesUpdateMutation";
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

export const useEditProductInventoriesModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<IProductInventories | null>(null);

  const updateMutation = useProductInventoriesUpdateMutation();

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

  const openModal = useCallback(
    (item: IProductInventories) => {
      setSelected(item);
      form.reset({
        product_uom_id: item.product_uom_id,
        sku: item.sku,
        price: item.price,
        expiry_date: item.expiry_date,
        status: item.status,
        is_default: item.is_default ? "1" : "0",
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
    async (values: ProductInventoriesFormValues) => {
      if (!selected?.id) return;

      try {
        const updateData: IProductInventoriesDTO = {
          product_uom_id: values.product_uom_id,
          sku: values.sku,
          price: values.price,
          expiry_date: format(values.expiry_date, "yyyy-MM-dd"),
          status: values.status,
          is_default: values.is_default === "0",
        };

        await updateMutation.mutateAsync({
          id: selected.id,
          data: updateData,
        });

        toast.success("Product inventories updated successfully");
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
          toast.error(responseData?.message ?? "Failed to update product inventories");
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
