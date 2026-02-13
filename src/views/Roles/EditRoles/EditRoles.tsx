import useEditRoles from "./useEditRoles";
import { FieldGroup, FieldLabel } from "@/components/ui/field";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const EditRoles = () => {
  const { handleSubmit, isLoading, permission, form, isSubmitting } =
    useEditRoles();
  return (
    <div className="w-full max-w-7xl mx-auto">
      <Link href={"/users/roles"}>
        <div className="flex gap-2 items-center">
          <ArrowLeft size={16} />
          Back
        </div>
      </Link>
      <form className="my-4" onSubmit={form.handleSubmit(handleSubmit)}>
        <FieldGroup>
          <div className="space-y-2">
            <FieldLabel className="text-xl font-semibold">Name</FieldLabel>
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <>
                  <Input
                    {...field}
                    placeholder="Kitchen"
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
          </div>

          <div className="space-y-2">
            <FieldLabel className="text-xl font-semibold">
              Permission List
            </FieldLabel>
            {isLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-6 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {permission.map((group) => (
                  <div key={group.group}>
                    <p className="font-medium mb-2">{group.group}</p>
                    <div className="space-y-2">
                      {group.data?.map((item) => (
                        <Controller
                          key={item.id}
                          control={form.control}
                          name="permission_ids"
                          render={({ field, fieldState }) => {
                            const isChecked = field.value.includes(item.id!);
                            return (
                              <div>
                                <div className="flex gap-2 items-center">
                                  <Checkbox
                                    className="cursor-pointer"
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        field.onChange([
                                          ...field.value,
                                          item.id!,
                                        ]);
                                      } else {
                                        field.onChange(
                                          field.value.filter(
                                            (id) => id !== item.id,
                                          ),
                                        );
                                      }
                                    }}
                                    aria-invalid={!!fieldState.error}
                                  />
                                  <p>{item.name}</p>
                                </div>
                                {fieldState.error && (
                                  <p className="text-destructive text-sm">
                                    {fieldState.error.message}
                                  </p>
                                )}
                              </div>
                            );
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FieldGroup>
        <div className="w-full">
          <Button
            className="my-4 w-full cursor-pointer"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Updating..." : "Update"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditRoles;
