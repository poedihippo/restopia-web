import { ICustomerDTO } from "@/@types/customer";
import useCustomerMutation from "@/hooks/customer/useCustomerMutation";
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

export const useCreateCustomerModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);

  const createMutation = useCustomerMutation();

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      name: "",
      phone: "",
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
    async (values: CustomerFormValues) => {
      try {
        const payload: ICustomerDTO = {
          name: values.name,
          phone: values.phone,
        };

        await createMutation.mutateAsync(payload);

        toast.success("Customer created successfully");
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
          toast.error(responseData?.message ?? "Failed to create customer");
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
