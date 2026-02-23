import { IStockMovementDTO } from "@/@types/stock-movements";
import useStockMovementMutation from "@/hooks/stock-movements/useStockMovementMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

const Schema = z.object({
  qty: z.number().min(1, "Quantity is required"),
  direction: z.string().min(1, "Please choose direction is required"),
  description: z.string().min(1, "description is required"),
});

export type StockMovementFormValues = z.infer<typeof Schema>;

export const useCreateStockMovement = (
  id: number | null,
  onSuccess?: () => void,
) => {
  const [isOpen, setIsOpen] = useState(false);

  const createMutation = useStockMovementMutation();

  const form = useForm<StockMovementFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      qty: 0,
      direction: "",
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
    async (values: StockMovementFormValues) => {
      try {
        const payload: IStockMovementDTO = {
          product_inventory_id: id ?? 0,
          qty: values.qty,
          direction: values.direction,
          description: values.description,
        };

        await createMutation.mutateAsync(payload);

        toast.success("Stock movement created successfully");
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
              form.setError(field as keyof StockMovementFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(
            responseData?.message ?? "Failed to create stock movement",
          );
        }
      }
    },
    [createMutation, closeModal, onSuccess, form, id],
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
