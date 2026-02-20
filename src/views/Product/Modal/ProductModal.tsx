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
import { ProductsFormValues } from "./useCreateProductModal";
import useGetProductCategoriesList from "@/hooks/product-categories/useGetProductCategoriesList";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { productType } from "@/constants/global";
import { X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  mode: "create" | "edit";
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: ProductsFormValues) => void;
  form: UseFormReturn<ProductsFormValues>;
  isSubmitting: boolean;
}

export const ProductModal = ({
  mode,
  isOpen,
  onClose,
  onSubmit,
  form,
  isSubmitting,
}: Props) => {
  const isEdit = mode === "edit";
  const { data: pcData, isLoading: isLoadingPC } = useGetProductCategoriesList({
    enabled: isOpen,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Product" : "Create Product"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Edit product information. Update the fields as needed."
              : "Add a new product to the system. Fill in all the required information."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col space-y-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel>Choose Product Category</FieldLabel>
              <Controller
                control={form.control}
                name="product_category_id"
                render={({ field, fieldState }) => (
                  <>
                    <SearchableSelect
                      isLoading={isLoadingPC}
                      placeholder="Select product category..."
                      options={
                        pcData?.data?.map((item) => ({
                          value: item.id,
                          label: item.name ?? "",
                        })) ?? []
                      }
                      value={
                        pcData?.data
                          ?.filter((item) => item.id === field.value)
                          .map((item) => ({
                            value: item.id,
                            label: item.name ?? "",
                          }))[0] ?? null
                      }
                      onChange={(selected) => {
                        field.onChange(
                          selected
                            ? (selected as { value: number }).value
                            : null,
                        );
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
              <FieldLabel>Code</FieldLabel>
              <Controller
                control={form.control}
                name="code"
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
                          {productType?.map((item) => (
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
              <FieldLabel>Description</FieldLabel>
              <Controller
                control={form.control}
                name="description"
                render={({ field, fieldState }) => (
                  <>
                    <Textarea
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
