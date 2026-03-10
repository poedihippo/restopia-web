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
import { Controller, UseFormReturn } from "react-hook-form";
import { CustomerFormValues } from "./useCreateCustomerModal";

interface Props {
  mode: "create" | "edit";
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: CustomerFormValues) => void;
  form: UseFormReturn<CustomerFormValues>;
  isSubmitting: boolean;
}

export const CustomerModal = ({
  mode,
  isOpen,
  onClose,
  onSubmit,
  form,
  isSubmitting,
}: Props) => {
  const isEdit = mode === "edit";
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Customer" : "Create Customer"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Edit customer information. Update the fields as needed."
              : "Add a new customer to the system. Fill in all the required information."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col space-y-4"
        >
          <FieldGroup>
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
              <FieldLabel>Phone</FieldLabel>
              <Controller
                control={form.control}
                name="phone"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      {...field}
                      type="number"
                      onChange={(e) => field.onChange(e.target.value)}
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
