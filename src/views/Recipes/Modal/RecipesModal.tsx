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
import { Switch } from "@/components/ui/switch";
import useGetProductList from "@/hooks/product/useGetProductList";
import useGetUOMList from "@/hooks/uom/useGetUOMList";
import { Controller, UseFormReturn } from "react-hook-form";
import { RecipesFormValues } from "./useCreateRecipesModal";

interface Props {
  mode: "create" | "edit";
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: RecipesFormValues) => void;
  form: UseFormReturn<RecipesFormValues>;
  isSubmitting: boolean;
}

export const RecipesModal = ({
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
  const productId = form.watch("product_id");
  const filterDataMaterialProduct = productData?.data.filter(
    (item) => item.id !== productId,
  );

  const { data: allUomData, isLoading: isLoadingUom } = useGetUOMList({
    enabled: isOpen,
  });
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Product Conversions" : "Create Product Conversions"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Edit product conversions information. Update the fields as needed."
              : "Add a new product conversions to the system. Fill in all the required information."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col space-y-2"
        >
          <FieldGroup>
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
              <FieldLabel>Choose Material Product</FieldLabel>
              <Controller
                control={form.control}
                name="material_product_id"
                render={({ field, fieldState }) => (
                  <>
                    <SearchableSelect
                      isLoading={isLoadingProduct}
                      placeholder="Select material product..."
                      options={
                        filterDataMaterialProduct?.map((item) => ({
                          value: item.id,
                          label: item.name ?? "",
                        })) ?? []
                      }
                      value={
                        filterDataMaterialProduct
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
              <FieldLabel>Choose Material Uom</FieldLabel>
              <Controller
                control={form.control}
                name="material_uom_id"
                render={({ field, fieldState }) => (
                  <>
                    <SearchableSelect
                      isLoading={isLoadingUom}
                      placeholder="Select material uom..."
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
              <FieldLabel>Quantity</FieldLabel>
              <Controller
                control={form.control}
                name="qty"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      {...field}
                      min={0}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      type="number"
                      placeholder="0"
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
