import { ICompaniesDTO } from "@/@types/companies";
import useCompaniesMutation from "@/hooks/companies/useCompaniesMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const companiesSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export type CompaniesFormValues = z.infer<typeof companiesSchema>;

export const useCreateCompaniesModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);

  const createUserMutation = useCompaniesMutation();

  const form = useForm<CompaniesFormValues>({
    resolver: zodResolver(companiesSchema),
    defaultValues: {
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
    async (values: CompaniesFormValues) => {
      try {
        const payload: ICompaniesDTO = {
          name: values.name,
        };

        await createUserMutation.mutateAsync(payload);

        toast.success("User created successfully");
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
              form.setError(field as keyof CompaniesFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to create user");
        }
      }
    },
    [createUserMutation, closeModal, onSuccess, form],
  );

  return {
    isOpen,
    form,
    openModal,
    closeModal,
    handleSubmit,
    isSubmitting: createUserMutation.isPending,
  };
};
