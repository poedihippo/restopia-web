import { IProductUom } from "@/@types/product-uoms";
import useProductUomsDeleteMutation from "@/hooks/product-uoms/useProductUomsDeleteMutation";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export const useDeleteProductUomsModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<IProductUom | null>(null);

  const deleteMutation = useProductUomsDeleteMutation();

  const openModal = useCallback((item: IProductUom) => {
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
      toast.success("Product uoms deleted successfully");
      closeModal();
      onSuccess?.();
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast.error(
        axiosError?.response?.data?.message ?? "Failed to delete product uoms",
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
