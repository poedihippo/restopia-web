import { ICompanies, ICompaniesDTO } from "@/@types/companies";
import useCompaniesUpdateMutation from "@/hooks/companies/useCompaniesUpdateMutation";
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

export const useEditCompaniesModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<ICompanies | null>(null);

  const updateMutation = useCompaniesUpdateMutation();

  const form = useForm<CompaniesFormValues>({
    resolver: zodResolver(companiesSchema),
    defaultValues: {
      name: "",
    },
  });

  const openModal = useCallback(
    (item: ICompanies) => {
      setSelected(item);
      form.reset({
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
    async (values: CompaniesFormValues) => {
      if (!selected?.id) return;

      try {
        const updateData: ICompaniesDTO = {
          name: values.name,
        };

        await updateMutation.mutateAsync({
          id: selected.id,
          data: updateData,
        });

        toast.success("Companies updated successfully");
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
          toast.error(responseData?.message ?? "Failed to update user");
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
