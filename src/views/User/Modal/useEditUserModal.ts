import { IUser, IUserDTO } from "@/@types/user";
import useUserUpdateMutation from "@/hooks/user/useUserUpdateMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const userSchema = z.object({
  nik: z.string().min(1, "NIK is required"),
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  phone: z.string().min(1, "Phone is required"),
  birth: z.string().min(1, "Birth date is required"),
  gender: z.string().min(1, "Gender is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  branch_ids: z.array(z.number()).min(1, "Please select at least 1 branch"),
  role_ids: z.array(z.number()).min(1, "Please select at least 1 role"),
});

export type UserFormValues = z.infer<typeof userSchema>;

export const useEditUserModal = (onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<IUser | null>(null);

  const updateUserMutation = useUserUpdateMutation();

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      nik: "",
      name: "",
      type: "",
      phone: "",
      birth: "",
      gender: "",
      email: "",
      password: "",
      branch_ids: [],
      role_ids: [],
    },
  });

  const openModal = useCallback(
    (user: IUser) => {
      setSelectedUser(user);
      form.reset({
        name: user.name,
        email: user.email,
        type: user.type,
        nik: user.nik,
        phone: user.phone,
        birth: user.birth,
        gender: user.gender,
        branch_ids: user.branch_id,
        role_ids: user.role_ids,
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
    async (values: UserFormValues) => {
      if (!selectedUser?.id) return;

      try {
        const updateData: IUserDTO = {
          nik: values.nik,
          name: values.name,
          type: values.type,
          phone: values.phone,
          birth: values.birth,
          gender: values.gender,
          email: values.email,
          password: values.password,
          branch_ids: values.branch_ids,
          role_ids: values.role_ids,
        };

        await updateUserMutation.mutateAsync({
          id: selectedUser.id,
          data: updateData,
        });

        toast.success("User updated successfully");
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
              form.setError(field as keyof UserFormValues, {
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
    [updateUserMutation, selectedUser, closeModal, onSuccess, form],
  );

  return {
    isOpen,
    form,
    openModal,
    closeModal,
    handleSubmit,
    isSubmitting: updateUserMutation.isPending,
  };
};
