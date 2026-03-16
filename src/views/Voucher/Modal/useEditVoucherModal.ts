import { IVoucher, IVoucherStatusDTO } from "@/@types/voucher";
import useVoucherUpdateStatusMutation from "@/hooks/voucher/useVoucherUpdateStatusMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const Schema = z.object({
  status: z.enum(['active', 'inactive']),
});

export type VoucherFormValues = z.infer<typeof Schema>;

export const useEditVoucherModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<IVoucher | null>(null);

  const updateMutation = useVoucherUpdateStatusMutation();

  const form = useForm<VoucherFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      status: 'active',
    },
  });

  const openModal = useCallback(
    (item: IVoucher) => {
      setSelected(item);
      form.reset({
        status: item.status,
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
    async (values: VoucherFormValues) => {
      if (!selected?.id) return;

      try {
        const updateData: IVoucherStatusDTO = {
          status: values.status,
        };

        await updateMutation.mutateAsync({
          id: selected.id,
          data: updateData,
        });

        toast.success("Voucher status updated successfully");
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
              form.setError(field as keyof VoucherFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to update status voucher");
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
