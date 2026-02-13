import { IRoleDTO } from "@/@types/role";
import useGetPermissionList from "@/hooks/permissions/useGetPermissionList";
import useRoleMutation from "@/hooks/roles/useRoleMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

const createRolesSchema = z.object({
  name: z.string().min(1, "Name is required"),
  permission_ids: z.array(z.number()).min(1, "Add at least 1 permission"),
});

export type CreateRolesFormValues = z.infer<typeof createRolesSchema>;

const useCreateRoles = () => {
  const { data, isLoading } = useGetPermissionList();

  const permission = useMemo(() => data?.data ?? [], [data?.data]);

  const createMutation = useRoleMutation();

  const form = useForm<CreateRolesFormValues>({
    resolver: zodResolver(createRolesSchema),
    defaultValues: {
      name: "",
      permission_ids: [],
    },
  });

  const handleSubmit = useCallback(
    async (values: CreateRolesFormValues) => {
      try {
        const payload: IRoleDTO = {
          name: values.name,
          permission_ids: values.permission_ids,
        };

        await createMutation.mutateAsync(payload);

        toast.success("Roles created successfully");

        window.location.href = '/users/roles'
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
              form.setError(field as keyof CreateRolesFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to create roles ");
        }
      }
    },
    [createMutation, form],
  );

  return {
    permission,
    isLoading,
    handleSubmit,
    form,
    isSubmitting: createMutation.isPending,
  };
};

export default useCreateRoles;
