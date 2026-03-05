import { IPurchaseOrder } from "@/@types/purchase-orders";
import usePurchaseOrderDeleteMutation from "@/hooks/purchase-order/usePurchaseOrderDeleteMutation";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export const useDeletePurchaseOrdersModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<IPurchaseOrder | null>(null);

  const deleteMutation = usePurchaseOrderDeleteMutation();

  const openModal = useCallback((item: IPurchaseOrder) => {
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
      toast.success("Purchase Order deleted successfully");
      closeModal();
      onSuccess?.();
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast.error(
        axiosError?.response?.data?.message ?? "Failed to delete purchase order",
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
