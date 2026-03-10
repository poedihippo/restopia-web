import { ISalesOrder } from "@/@types/sales-orders";
import useSalesOrderDeleteMutation from "@/hooks/sales-orders/useSalesOrderDeleteMutation";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export const useDeleteSalesOrdersModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<ISalesOrder | null>(null);

  const deleteMutation = useSalesOrderDeleteMutation();

  const openModal = useCallback((item: ISalesOrder) => {
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
      toast.success("Sales order deleted successfully");
      closeModal();
      onSuccess?.();
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast.error(
        axiosError?.response?.data?.message ?? "Failed to delete sales order",
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
