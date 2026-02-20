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
import { ProductConversionsFormValues } from "./useCreateProductConversionsModal";
import useGetProductList from "@/hooks/product/useGetProductList";
import useGetUOMList from "@/hooks/uom/useGetUOMList";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface Props {
  mode: "create" | "edit";
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: ProductConversionsFormValues) => void;
  form: UseFormReturn<ProductConversionsFormValues>;
  isSubmitting: boolean;
}

export const ProductConversionsModal = ({
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

  const uom_id = form.watch("uom_id");

  const filteredTargetUoms = allUomData?.data.filter(
    (item) => item.id !== uom_id,
  );

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
              <FieldLabel>Choose Target UOM</FieldLabel>
              <Controller
                control={form.control}
                name="target_uom_id"
                render={({ field, fieldState }) => (
                  <>
                    <SearchableSelect
                      isLoading={isLoadingUom}
                      isDisabled={!uom_id}
                      isClearable
                      placeholder="Select target uom..."
                      options={
                        filteredTargetUoms?.map((item) => ({
                          value: item.id,
                          label: item.name ?? "",
                        })) ?? []
                      }
                      value={
                        !uom_id
                          ? null
                          : (filteredTargetUoms
                              ?.filter((item) => item.id === field.value)
                              .map((item) => ({
                                value: item.id,
                                label: item.name ?? "",
                              }))[0] ?? null)
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
              <FieldLabel>Amount</FieldLabel>
              <Controller
                control={form.control}
                name="amount"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      {...field}
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
