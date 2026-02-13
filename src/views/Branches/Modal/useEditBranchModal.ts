import { IBranch, IBranchDTO } from "@/@types/branch";
import useBranchUpdateMutation from "@/hooks/branches/useBranchUpdateMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const branchesSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  is_default: z.string().optional(),
});

export type BranchFormValues = z.infer<typeof branchesSchema>;

export const useEditBranchModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<IBranch | null>(null);

  const updateMutation = useBranchUpdateMutation();

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchesSchema),
    defaultValues: {
      name: "",
      code: "",
      is_default: "",
    },
  });

  const openModal = useCallback(
    (item: IBranch) => {
      setSelected(item);
      form.reset({
        code: item.code ?? "",
        name: item.name ?? "",
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
    async (values: BranchFormValues) => {
      if (!selected?.id) return;

      try {
        const updateData: IBranchDTO = {
          name: values.name,
          code: values.code,
          is_default: values.is_default === "1",
        };

        await updateMutation.mutateAsync({
          id: selected.id,
          data: updateData,
        });

        toast.success("Branch updated successfully");
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
              form.setError(field as keyof BranchFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to update branch");
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
