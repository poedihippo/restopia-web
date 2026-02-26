import { IRecipe } from "@/@types/recipes";
import useRecipeDeleteMutation from "@/hooks/recipes/useRecipeDeleteMutation";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export const useDeleteRecipesModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<IRecipe | null>(null);

  const deleteMutation = useRecipeDeleteMutation();

  const openModal = useCallback((item: IRecipe) => {
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
      toast.success("Recipe deleted successfully");
      closeModal();
      onSuccess?.();
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast.error(
        axiosError?.response?.data?.message ?? "Failed to delete recipe",
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
