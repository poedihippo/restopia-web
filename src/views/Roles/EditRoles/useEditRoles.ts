import { IRoleDTO } from "@/@types/role";
import useGetPermissionList from "@/hooks/permissions/useGetPermissionList";
import useGetRole from "@/hooks/roles/useGetRole";
import useRoleUpdateMutation from "@/hooks/roles/useRoleUpdateMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

const editRolesSchema = z.object({
  name: z.string().min(1, "Name is required"),
  permission_ids: z.array(z.number()).min(1, "Add at least 1 permission"),
});

export type EditRolesFormValues = z.infer<typeof editRolesSchema>;

const useEditRoles = () => {
  const router = useRouter();
  const { id } = router.query;

  const { data: roleData, isLoading: isLoadingRole } = useGetRole(
    id as string,
    { include: "permissions" },
    !!id,
  );

  const { data: permissionData, isLoading: isLoadingPermission } =
    useGetPermissionList();

  const permission = useMemo(
    () => permissionData?.data ?? [],
    [permissionData?.data],
  );

  const updateMutation = useRoleUpdateMutation();

  const form = useForm<EditRolesFormValues>({
    resolver: zodResolver(editRolesSchema),
    defaultValues: {
      name: "",
      permission_ids: [],
    },
  });

  useEffect(() => {
    if (roleData) {
      form.reset({
        name: roleData.name,
        permission_ids:
          roleData.permissions?.map((p) => p.id!).filter(Boolean) ?? [],
      });
    }
  }, [roleData, form]);

  const handleSubmit = useCallback(
    async (values: EditRolesFormValues) => {
      try {
        const payload: IRoleDTO = {
          name: values.name,
          permission_ids: values.permission_ids,
        };

        await updateMutation.mutateAsync({ id: id as string, data: payload });

        toast.success("Role updated successfully");

        window.location.href = "/users/roles";
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
              form.setError(field as keyof EditRolesFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to update role");
        }
      }
    },
    [updateMutation, form, id],
  );

  return {
    permission,
    isLoading: isLoadingPermission || isLoadingRole,
    handleSubmit,
    form,
    isSubmitting: updateMutation.isPending,
  };
};

export default useEditRoles;
