import { IUOMDTO } from "@/@types/uom";
import useUOMMutation from "@/hooks/uom/useUOMMutation";
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

export type UomsFormValues = z.infer<typeof Schema>;

export const useCreateUomsModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);

  const createMutation = useUOMMutation();

  const form = useForm<UomsFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      code: "",
      name: "",
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
    async (values: UomsFormValues) => {
      try {
        const payload: IUOMDTO = {
          code: values.code,
          name: values.name,
        };

        await createMutation.mutateAsync(payload);

        toast.success("Uom created successfully");
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
              form.setError(field as keyof UomsFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to create uom");
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
