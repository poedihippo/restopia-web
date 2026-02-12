import { IUser } from "@/@types/user";
import useUserDeleteMutation from "@/hooks/user/useUserDeleteMutation";
import { AxiosError } from "axios";
import { useState, useCallback } from "react";
import { toast } from "sonner";

export const useDeleteUserModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<IUser | null>(null);

  const deleteUserMutation = useUserDeleteMutation();

  const openModal = useCallback((user: IUser) => {
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
      toast.success("User deleted successfully");
      closeModal();
      onSuccess?.();
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ message?: string }>;
      toast.error(
        axiosError?.response?.data?.message ?? "Failed to delete user",
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
