import { IPurchaseOrderDTO } from "@/@types/purchase-orders";
import useMediaMutation from "@/hooks/media/useMediaMutation";
import usePurchaseOrderMutation from "@/hooks/purchase-order/usePurchaseOrderMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useRouter } from "next/router";
import { useCallback, useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const DetailSchema = z.object({
  product_inventory_id: z
    .number()
    .min(1, "Choose at least 1 product inventory"),
  qty: z.number().min(1, "Quantity is required"),
  price: z.number().min(1, "Price is required"),
  description: z.string(),
});

const Schema = z.object({
  code: z.string().min(1, "Code is required"),
  supplier_id: z.number().optional(),
  supplier_branch_id: z.number().optional(),
  date: z.string().min(1, "Date is required"),
  total_price: z.number().min(1, "Total price is required"),
  type: z.string().min(1, "Please choose type"),
  status: z.string().min(1, "Please choose status"),
  description: z.string().min(1, "Description is required"),
  details: z.array(DetailSchema).min(1, "At least 1 detail"),

  // optional media fields
  collection_name: z.string().optional(),
  files: z.array(z.instanceof(File)).refine((files) => files.every(f => f.size <= 2_000_000), {
    message: 'Max file size is 2MB'
  })
    .max(5, "Can input more then 5 images")
    .optional(),
}).superRefine((val, ctx) => {
  if (!val.supplier_id && !val.supplier_branch_id) {
    ctx.addIssue({
      code: 'custom',
      path: ['supplier_id',],
      message: "Please choose supplier or supplier branch"
    });
    ctx.addIssue({
      code: 'custom',
      path: ['supplier_branch_id',],
      message: "Please choose supplier or supplier branch"
    });


  }

  const uniqueProductUom = new Set<number>();
  val.details.forEach((detail, index) => {
    if (uniqueProductUom.has(detail.product_inventory_id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['details', index, 'product_inventory_id'],
        message: "Produk dengan UOM ini sudah ada",
      });
    } else {
      uniqueProductUom.add(detail.product_inventory_id);
    }
  })
  console.log('heheha:', uniqueProductUom)

});

export type PurchaseOrdersFormValues = z.output<typeof Schema>;

export const useCreatePurchaseOrders = () => {
  const router = useRouter()
  const createMutation = usePurchaseOrderMutation();

  const mediaMutation = useMediaMutation();

  const form = useForm<PurchaseOrdersFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      code: "",
      supplier_id: 0,
      supplier_branch_id: 0,
      date: "",
      total_price: 0,
      type: "",
      status: "",
      description: "",
      details: [],
      // Optional Media
      collection_name: "general",
      files: []
    },
  });

  const {
    fields: detailFields,
    append: appendDetail,
    remove: removeDetail,
  } = useFieldArray({
    control: form.control,
    name: "details",
  });

  const details = form.watch('details')
  const total = details.reduce((acc, row) => acc + (row.qty * row.price), 0)

  useEffect(() => {
    form.setValue('total_price', total)
  }, [total, details])

  const handleSubmit = useCallback(
    async (values: PurchaseOrdersFormValues) => {
      try {
        const payload: IPurchaseOrderDTO = {
          code: values.code,
          ...(values.supplier_id ? { supplier_id: values.supplier_id } : {}),
          ...(values.supplier_branch_id ? { supplier_branch_id: values.supplier_branch_id } : {}),
          date: values.date,
          type: values.type as "offline" | "online" | "franchise",
          status: values.status,
          total_price: values.total_price,
          description: values.description,
          details: values.details,
        };

        const result = await createMutation.mutateAsync(payload);
        const id = result.data.data.id;

        if (values.files && values.files.length > 0) {
          const formData = new FormData();
          formData.append('media_type', 'purchase_orders')
          formData.append('media_id', String(id))
          formData.append('collection_name', values.collection_name ?? 'general')
          values.files.forEach((file) => {
            formData.append("files", file)
          })
          await mediaMutation.mutateAsync(formData);
        }

        toast.success("Purchase order created successfully");
        router.back()
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
              form.setError(field as keyof PurchaseOrdersFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to create purchase order");
        }
      }
    },
    [createMutation, mediaMutation, form, router],
  );

  return {
    form,
    detailFields,
    appendDetail,
    removeDetail,
    handleSubmit,
    isSubmitting: createMutation.isPending,
  };
};
