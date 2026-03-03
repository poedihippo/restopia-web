import { IMedia } from "@/@types/media";
import useMediaDeleteMutation from "@/hooks/media/useMediaDeleteMutation";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export const useDeleteMediaModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<IMedia | null>(null);

  const deleteUserMutation = useMediaDeleteMutation();

  const openModal = useCallback((user: IMedia) => {
    setSelectedUser(user);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setSelectedUser(null);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedUser) return;

    try {
      await deleteUserMutation.mutateAsync(selectedUser.id);
      toast.success("Media deleted successfully");
      closeModal();
      onSuccess?.();
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast.error(
        axiosError?.response?.data?.message ?? "Failed to delete media",
      );
    }
  }, [selectedUser, deleteUserMutation, closeModal, onSuccess]);

  return {
    isOpen,
    selectedUser,
    openModal,
    closeModal,
    handleConfirmDelete,
    isDeleting: deleteUserMutation.isPending,
  };
};
