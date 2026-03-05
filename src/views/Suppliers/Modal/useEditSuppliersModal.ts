import { ISupplier, ISupplierDTO } from "@/@types/supplier";
import useSupplierUpdateMutation from "@/hooks/suppliers/useSupplierUpdateMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const Schema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
});

export type SupplierFormValues = z.infer<typeof Schema>;

export const useEditSuppliersModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<ISupplier | null>(null);

  const updateMutation = useSupplierUpdateMutation();

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      code: "",
      name: "",
    },
  });

  const openModal = useCallback(
    (item: ISupplier) => {
      setSelected(item);
      form.reset({
        code: item.code,
        name: item.name,
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
    async (values: SupplierFormValues) => {
      if (!selected?.id) return;

      try {
        const updateData: ISupplierDTO = {
          code: values.code,
          name: values.name,
        };

        await updateMutation.mutateAsync({
          id: selected.id,
          data: updateData,
        });

        toast.success("Supplier updated successfully");
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
              form.setError(field as keyof SupplierFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to update supplier");
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
