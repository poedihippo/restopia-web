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
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import useGetProductList from "@/hooks/product/useGetProductList";
import useGetUOMList from "@/hooks/uom/useGetUOMList";
import { Trash } from "lucide-react";
import { Control, Controller, FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormReturn } from "react-hook-form";
import { RecipesFormValues } from "./useCreateRecipesModal";
import { boolean } from "zod";
import { Switch } from "@/components/ui/switch";

interface DetailRowProps {
  index: number;
  control: Control<RecipesFormValues>;
  onRemove: () => void;
  excludeProductsIds: number[]
}

const DetailRow = ({ control, index, onRemove, excludeProductsIds }: DetailRowProps) => {
  const { data: productData, isLoading: isLoadingProduct } =
    useGetProductList(
      {
        include: "created_by,updated_by,product_category",
      },
      {
        enabled: true,
      },
    );
  const { data: uomData, isLoading: isLoadingUOM } =
    useGetUOMList(
      {
        include: "created_by,updated_by",
      },
      {
        enabled: true,
      },
    );

  return (
    <div className=" my-4 bg-white shadow-xl rounded-md border-2">
      <div className="flex justify-between items-center px-2 py-2">
        <p>Detail {index + 1}</p>
        <Button type="button" variant="destructive" onClick={onRemove}>
          <Trash />
        </Button>
      </div>
      <div className="flex flex-col gap-4 px-2">
        <div className="flex flex-col gap-2">
          <Label>Product</Label>
          <Controller
            control={control}
            name={`materials.${index}.product_id`}
            render={({ field, fieldState }) => (
              <>
                <SearchableSelect
                  isClearable
                  isLoading={isLoadingProduct}
                  placeholder="Select product..."
                  options={
                    productData?.data?.
                      filter((item) => !excludeProductsIds.includes(item.id))?.
                      map((item) => ({
                        value: item.id,
                        label: `${item.name} - ${item.code}`,
                      })) ?? []
                  }
                  value={
                    productData?.data
                      ?.filter((item) => item.id === field.value)
                      .map((item) => ({
                        value: item.id,
                        label: `${item.name} - ${item.code}`,
                      }))[0] ?? null
                  }
                  onChange={(selected) => {
                    field.onChange(
                      selected ? (selected as { value: number }).value : null,
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
        </div>
        <div className="flex flex-col gap-2">
          <Label>UOM</Label>
          <Controller
            control={control}
            name={`materials.${index}.uom_id`}
            render={({ field, fieldState }) => (
              <>
                <SearchableSelect
                  isClearable
                  isLoading={isLoadingUOM}
                  placeholder="Select uom..."
                  options={
                    uomData?.data?.map((item) => ({
                      value: item.id,
                      label: `${item.name} - ${item.code}`,
                    })) ?? []
                  }
                  value={
                    uomData?.data
                      ?.filter((item) => item.id === field.value)
                      .map((item) => ({
                        value: item.id,
                        label: `${item.name} - ${item.code}`,
                      }))[0] ?? null
                  }
                  onChange={(selected) => {
                    field.onChange(
                      selected ? (selected as { value: number }).value : null,
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
        </div>
        <div className="flex flex-col gap-2 mb-4">
          <Label>Quantity</Label>
          <Controller
            control={control}
            name={`materials.${index}.qty`}
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
        </div>
      </div>
    </div>
  );
};



interface Props {
  mode: "create" | "edit";
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: RecipesFormValues) => void;
  form: UseFormReturn<RecipesFormValues>;
  isSubmitting: boolean;
  fields: FieldArrayWithId<RecipesFormValues, 'materials'>[]
  append: UseFieldArrayAppend<RecipesFormValues, 'materials'>
  remove: UseFieldArrayRemove
}

export const RecipesModal = ({
  mode,
  isOpen,
  onClose,
  onSubmit,
  form,
  isSubmitting,
  append,
  fields,
  remove
}: Props) => {
  const isEdit = mode === "edit";

  const { data: productData, isLoading: isLoadingProduct } = useGetProductList({
    enabled: isOpen,
  });

  const materials = form.watch('materials')

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Recipes" : "Create Recipes"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Edit recipes information. Update the fields as needed."
              : "Add a new recipes to the system. Fill in all the required information."}
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
          </FieldGroup>



          <div className="my-2">
            <Button
              type="button"
              onClick={() =>
                append({
                  product_id: 0,
                  uom_id: 0,
                  qty: 0,
                })
              }
            >
              Add Detail
            </Button>
          </div>
          {fields?.map((field, index) => {
            const excludeProductsIds = [
              form.getValues('product_id'),
              ...materials.filter((_, i) => i !== index).map((m) => m.product_id)
            ].filter(Boolean)
            return (
              <DetailRow
                key={field.id}
                index={index}
                control={form.control}
                onRemove={() => remove(index)}
                excludeProductsIds={excludeProductsIds}
              />
            )
          })}

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
