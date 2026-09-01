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
import { Switch } from "@/components/ui/switch";
import { status } from "@/constants/global";
import useGetProductUomsList from "@/hooks/product-uoms/useGetProductUomsList";
import { X } from "lucide-react";
import {useState,  useEffect } from "react";
import { Controller, UseFormReturn } from "react-hook-form";
import { ProductInventoriesFormValues } from "./useCreateProductInventoriesModal";

interface Props {
  mode: "create" | "edit";
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: ProductInventoriesFormValues) => void;
  form: UseFormReturn<ProductInventoriesFormValues>;
  isSubmitting: boolean;
}

export const ProductInventoriesModal = ({
  mode,
  isOpen,
  onClose,
  onSubmit,
  form,
  isSubmitting,
}: Props) => {
  const isEdit = mode === "edit";

  const [dropdownSearch, setDropdownSearch] = useState('')

  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')

  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])

  const { data: productData, isLoading: isLoadingProduct } =
    useGetProductUomsList(
      {
        include: "created_by,updated_by,product,uom",
      },
      {
        enabled: isOpen,
      },
    );

  const productId = form.watch("product_uom_id");
  const filterDataProduct = productData?.data.find(
    (item) => item.id === productId,
  );

  useEffect(() => {
    if (filterDataProduct?.base_price) {
      form.setValue("base_price", filterDataProduct.base_price);
    }
  }, [filterDataProduct, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Product Inventories" : "Create Product Inventories"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Edit product inventories information. Update the fields as needed."
              : "Add a new product inventories to the system. Fill in all the required information."}
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
                name="product_uom_id"
                render={({ field, fieldState }) => (
                  <>
                    <SearchableSelect
                      isLoading={isLoadingProduct}
                      placeholder="Select product..."
                      options={
                        productData?.data?.map((item) => ({
                          value: item.id,
                          label: `${item.product?.name ?? ""} - ${item.uom?.name ?? ""}`,
                        })) ?? []
                      }
                      value={
                        productData?.data
                          ?.filter((item) => item.id === field.value)
                          .map((item) => ({
                            value: item.id,
                            label: `${item.product?.name ?? ""} - ${item.uom?.name ?? ""}`,
                          }))[0] ?? null
                      }
                      onChange={(selected) => {
                        field.onChange(
                          selected
                            ? (selected as { value: number }).value
                            : null,
                        );
                      }}
                      onSearchChange={setDropdownSearch}
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
                      placeholder="e.g., SK00000000001"
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
            <Field>
              <FieldLabel>Expiry Date</FieldLabel>
              <Controller
                control={form.control}
                name="expiry_date"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      {...field}
                      type="date"
                      placeholder="e.g., SK00000000001"
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
              <FieldLabel>Status</FieldLabel>
              <Controller
                control={form.control}
                name="status"
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
                          {status?.map((item) => (
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
