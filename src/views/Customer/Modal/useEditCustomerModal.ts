import { ICustomer, ICustomerDTO } from "@/@types/customer";
import useCustomerUpdateMutation from "@/hooks/customer/useCustomerUpdateMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const Schema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
});

export type CustomerFormValues = z.infer<typeof Schema>;

export const useEditCustomerModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<ICustomer | null>(null);

  const updateMutation = useCustomerUpdateMutation();

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      name: "",
      phone: "",
    },
  });

  const openModal = useCallback(
    (item: ICustomer) => {
      setSelected(item);
      form.reset({
        name: item.name,
        phone: item.phone,
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
    async (values: CustomerFormValues) => {
      if (!selected?.id) return;

      try {
        const updateData: ICustomerDTO = {
          name: values.name,
          phone: values.phone,
        };

        await updateMutation.mutateAsync({
          id: selected.id,
          data: updateData,
        });

        toast.success("Customer updated successfully");
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
              form.setError(field as keyof CustomerFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to update customer");
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
