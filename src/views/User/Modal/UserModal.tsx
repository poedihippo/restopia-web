import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Genders, Types } from "@/constants/global";
import useGetBranchList from "@/hooks/branches/useGetBranchList";
import useGetRoleList from "@/hooks/roles/useGetRoleList";
import { Eye, EyeOff, X } from "lucide-react";
import { Controller, UseFormReturn } from "react-hook-form";
import { UserFormValues } from "./useCreateUserModal";
import { useState } from "react";

interface UserModalProps {
  mode: "create" | "edit";
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => void;
  form: UseFormReturn<UserFormValues>;
  isSubmitting: boolean;
}

export const UserModal = ({
  mode,
  isOpen,
  onClose,
  onSubmit,
  form,
  isSubmitting,
}: UserModalProps) => {
  const isEdit = mode === "edit";
  const [showPassword, setShowPassword] = useState(false);

  const { data: branchData, isLoading: isLoadingBranch } = useGetBranchList({
    enabled: isOpen,
  });

  const { data: roleData, isLoading: isLoadingRole } = useGetRoleList({
    enabled: isOpen,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User" : "Create User"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Edit user information. Update the fields as needed."
              : "Add a new user to the system. Fill in all the required information."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col space-y-4"
        >
          <FieldGroup className="grid grid-cols-1 lg:grid-cols-2">
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Controller
                control={form.control}
                name="name"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      {...field}
                      placeholder="John Doe"
                      aria-invalid={!!fieldState.error}
                    />
                    {fieldState.error && (
                      <p className="text-destructive text-sm">
                        {fieldState.error.message}
                      </p>
                    )}
                  </>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Email</FieldLabel>
              <Controller
                control={form.control}
                name="email"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      {...field}
                      placeholder="m@john.com"
                      type="email"
                      aria-invalid={!!fieldState.error}
                    />
                    {fieldState.error && (
                      <p className="text-destructive text-sm">
                        {fieldState.error.message}
                      </p>
                    )}
                  </>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Password</FieldLabel>
              <Controller
                control={form.control}
                name="password"
                render={({ field, fieldState }) => (
                  <>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        aria-invalid={!!fieldState.error}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                    {fieldState.error && (
                      <p className="text-destructive text-sm">
                        {fieldState.error.message}
                      </p>
                    )}
                  </>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>NIK</FieldLabel>
              <Controller
                control={form.control}
                name="nik"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      {...field}
                      placeholder="1523124124"
                      aria-invalid={!!fieldState.error}
                    />
                    {fieldState.error && (
                      <p className="text-destructive text-sm">
                        {fieldState.error.message}
                      </p>
                    )}
                  </>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Phone</FieldLabel>
              <Controller
                control={form.control}
                name="phone"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      {...field}
                      placeholder="1523124124"
                      type="number"
                      aria-invalid={!!fieldState.error}
                    />
                    {fieldState.error && (
                      <p className="text-destructive text-sm">
                        {fieldState.error.message}
                      </p>
                    )}
                  </>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Date Of Birth</FieldLabel>
              <Controller
                control={form.control}
                name="birth"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      {...field}
                      placeholder="1523124124"
                      type="date"
                      aria-invalid={!!fieldState.error}
                    />
                    {fieldState.error && (
                      <p className="text-destructive text-sm">
                        {fieldState.error.message}
                      </p>
                    )}
                  </>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Type</FieldLabel>
              <Controller
                control={form.control}
                name="type"
                render={({ field, fieldState }) => (
                  <>
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                        value={field.value}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                        <SelectContent>
                          {Types?.map((item) => (
                            <SelectItem key={item.key} value={item.key}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {field.value && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => field.onChange("")}
                          className="shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {fieldState.error && (
                      <p className="text-destructive text-sm">
                        {fieldState.error.message}
                      </p>
                    )}
                  </>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Gender</FieldLabel>
              <Controller
                control={form.control}
                name="gender"
                render={({ field, fieldState }) => (
                  <>
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                        value={field.value}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a gender" />
                        </SelectTrigger>
                        <SelectContent>
                          {Genders?.map((item) => (
                            <SelectItem key={item.key} value={item.key}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {field.value && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => field.onChange("")}
                          className="shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {fieldState.error && (
                      <p className="text-destructive text-sm">
                        {fieldState.error.message}
                      </p>
                    )}
                  </>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Choose Branches</FieldLabel>
              <Controller
                control={form.control}
                name="branch_ids"
                render={({ field, fieldState }) => (
                  <>
                    <SearchableSelect
                      isMulti
                      isLoading={isLoadingBranch}
                      placeholder="Select branches..."
                      options={
                        branchData?.data?.map((branch) => ({
                          value: branch.id,
                          label: branch.name ?? "",
                        })) ?? []
                      }
                      value={
                        branchData?.data
                          ?.filter((branch) => field.value?.includes(branch.id))
                          .map((branch) => ({
                            value: branch.id,
                            label: branch.name ?? "",
                          })) ?? []
                      }
                      onChange={(selected) => {
                        const values = selected
                          ? (selected as readonly { value: number }[]).map(
                              (s) => s.value,
                            )
                          : [];
                        field.onChange(values);
                      }}
                    />
                    {fieldState.error && (
                      <p className="text-destructive text-sm">
                        {fieldState.error.message}
                      </p>
                    )}
                  </>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Choose Roles</FieldLabel>
              <Controller
                control={form.control}
                name="role_ids"
                render={({ field, fieldState }) => (
                  <>
                    <SearchableSelect
                      isMulti
                      isLoading={isLoadingRole}
                      placeholder="Select role..."
                      options={
                        roleData?.data?.map((role) => ({
                          value: role.id,
                          label: role.name ?? "",
                        })) ?? []
                      }
                      value={
                        roleData?.data
                          ?.filter((role) => field.value?.includes(role.id))
                          .map((role) => ({
                            value: role.id,
                            label: role.name ?? "",
                          })) ?? []
                      }
                      onChange={(selected) => {
                        const values = selected
                          ? (selected as readonly { value: number }[]).map(
                              (s) => s.value,
                            )
                          : [];
                        field.onChange(values);
                      }}
                    />
                    {fieldState.error && (
                      <p className="text-destructive text-sm">
                        {fieldState.error.message}
                      </p>
                    )}
                  </>
                )}
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEdit
                  ? "Updating..."
                  : "Creating..."
                : isEdit
                  ? "Update"
                  : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
