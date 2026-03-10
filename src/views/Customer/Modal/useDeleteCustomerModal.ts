import { ICustomer } from "@/@types/customer";
import useCustomerDeleteMutation from "@/hooks/customer/useCustomerDeleteMutation";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export const useDeleteCustomerModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<ICustomer | null>(null);

  const deleteMutation = useCustomerDeleteMutation();

  const openModal = useCallback((item: ICustomer) => {
    setSelected(item);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setSelected(null);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!selected) return;

    try {
      await deleteMutation.mutateAsync(selected.id);
      toast.success("Customer deleted successfully");
      closeModal();
      onSuccess?.();
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast.error(
        axiosError?.response?.data?.message ?? "Failed to delete customer",
      );
    }
  }, [selected, deleteMutation, closeModal, onSuccess]);

  return {
    isOpen,
    selected,
    openModal,
    closeModal,
    handleConfirmDelete,
    isDeleting: deleteMutation.isPending,
  };
};
