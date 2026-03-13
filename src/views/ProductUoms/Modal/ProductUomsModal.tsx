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
import useGetProductList from "@/hooks/product/useGetProductList";
import useGetUOMList from "@/hooks/uom/useGetUOMList";
import { Controller, UseFormReturn } from "react-hook-form";
import { ProductUomsFormValues } from "./useCreateProductUomsModal";
import { Switch } from "@/components/ui/switch";

interface Props {
  mode: "create" | "edit";
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: ProductUomsFormValues) => void;
  form: UseFormReturn<ProductUomsFormValues>;
  isSubmitting: boolean;
}

export const ProductUomsModal = ({
  mode,
  isOpen,
  onClose,
  onSubmit,
  form,
  isSubmitting,
}: Props) => {
  const isEdit = mode === "edit";

  const { data: productData, isLoading: isLoadingProduct } = useGetProductList({
    enabled: isOpen,
  });

  const { data: allUomData, isLoading: isLoadingUom } = useGetUOMList({
    enabled: isOpen,
  });
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Product Uoms" : "Create Product Uoms"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Edit product uoms information. Update the fields as needed."
              : "Add a new product uoms to the system. Fill in all the required information."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col space-y-2"
        >
          <FieldGroup>
            <Field>
              <FieldLabel>Code</FieldLabel>
              <Controller
                control={form.control}
                name="code"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      {...field}
                      placeholder="Code here..."
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
              <FieldLabel>Choose Product</FieldLabel>
              <Controller
                control={form.control}
                name="product_id"
                render={({ field, fieldState }) => (
                  <>
                    <SearchableSelect
                      isLoading={isLoadingProduct}
                      placeholder="Select product..."
                      options={
                        productData?.data?.map((item) => ({
                          value: item.id,
                          label: item.name ?? "",
                        })) ?? []
                      }
                      value={
                        productData?.data
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
              <FieldLabel>Choose UOM</FieldLabel>
              <Controller
                control={form.control}
                name="uom_id"
                render={({ field, fieldState }) => (
                  <>
                    <SearchableSelect
                      isLoading={isLoadingUom}
                      placeholder="Select uom..."
                      isClearable
                      options={
                        allUomData?.data?.map((item) => ({
                          value: item.id,
                          label: item.name ?? "",
                        })) ?? []
                      }
                      value={
                        allUomData?.data
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
              <FieldLabel>Base Price</FieldLabel>
              <Controller
                control={form.control}
                name="base_price"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      {...field}
                      min={0}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      type="number"
                      placeholder="0"
                      prefix="Rp."
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
              <FieldLabel>Online Price</FieldLabel>
              <Controller
                control={form.control}
                name="online_price"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      {...field}
                      min={0}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      type="number"
                      placeholder="0"
                      prefix="Rp."
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

            <div className="flex justify-between">
              <Field>
                <FieldLabel>Price Editable?</FieldLabel>
                <Controller
                  control={form.control}
                  name="price_editable"
                  render={({ field, fieldState }) => (
                    <>
                      <Switch
                        checked={field.value === "1"}
                        onCheckedChange={(checked) =>
                          field.onChange(checked ? "1" : "0")
                        }
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
                <FieldLabel>Is Default?</FieldLabel>
                <Controller
                  control={form.control}
                  name="is_default"
                  render={({ field, fieldState }) => (
                    <>
                      <Switch
                        checked={field.value === "1"}
                        onCheckedChange={(checked) =>
                          field.onChange(checked ? "1" : "0")
                        }
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
            </div>
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
