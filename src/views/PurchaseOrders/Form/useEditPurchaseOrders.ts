import { IPurchaseOrderDTO } from "@/@types/purchase-orders";
import useMediaDeleteMutation from "@/hooks/media/useMediaDeleteMutation";
import useMediaMutation from "@/hooks/media/useMediaMutation";
import useGetPurchaseOrder from "@/hooks/purchase-order/useGetPurchaseOrder";
import usePurchaseOrderUpdateMutation from "@/hooks/purchase-order/usePurchaseOrderUpdateMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { format } from "date-fns";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  status: z.string().min(1, "Please choose status"),
  description: z.string().min(1, "Description is required"),
  details: z.array(DetailSchema).min(1, "At least 1 detail"),
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
});

export type PurchaseOrdersFormValues = z.infer<typeof Schema>;

interface Props {
  id: number;
}

export const useEditPurchaseOrders = ({ id }: Props) => {
  const router = useRouter();
  const [mediaToDelete, setMediaToDelete] = useState<number[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])

  const { data } = useGetPurchaseOrder(id, {
    include: "created_by,updated_by,branch,supplier,supplier_branch,media,purchase_order_details",
  });

  const allMedia = useMemo(
    () => data?.media ?? []
    , [data])

  const updateMutation = usePurchaseOrderUpdateMutation();
  const updateMediaMutation = useMediaMutation();
  const deleteMediaMutation = useMediaDeleteMutation();

  const existingMedia = useMemo(
    () => allMedia.filter(m => !mediaToDelete.includes(m.id!))
    , [allMedia, mediaToDelete])

  const handleRemoveExisting = (mediaId: number) => {
    setMediaToDelete(prev => [...prev, mediaId])
  }

  const handleRemoveNewFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddFiles = (newF: File[]) => {
    const totalSlot = 5 - existingMedia.length;
    const merged = [...newFiles, ...newF].slice(0, totalSlot)
    setNewFiles(merged)
  }

  const form = useForm<PurchaseOrdersFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      code: "",
      supplier_id: undefined,
      supplier_branch_id: undefined,
      date: "",
      total_price: 0,
      status: "",
      description: "",
      details: [],
    },
  });

  useEffect(() => {
    form.reset({
      code: data?.code,
      date: data?.date ? format(new Date(data.date), "yyyy-MM-dd") : "",
      status: data?.status,
      supplier_id: data?.supplier_id ?? undefined,
      supplier_branch_id: data?.supplier_branch_id ?? undefined,
      total_price: data?.total_price,
      description: data?.description,
      details:
        data?.purchase_order_details?.map((detail) => ({
          product_inventory_id: detail.product_inventory_id,
          qty: detail.qty,
          price: detail.price,
          description: detail?.description,
        })) ?? [],
    });
  }, [data]);

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
  }, [total])

  const handleSubmit = useCallback(
    async (values: PurchaseOrdersFormValues) => {
      if (!id) return;

      try {
        const updateData: IPurchaseOrderDTO = {
          code: values.code,
          total_price: values.total_price,
          date: values.date,
          status: values.status,
          description: values.description,
          details: values.details,
          ...(values.supplier_id ? { supplier_id: values.supplier_id } : {}),
          ...(values.supplier_branch_id ? { supplier_branch_id: values.supplier_branch_id } : {}),
        };

        await updateMutation.mutateAsync({
          id,
          data: updateData,
        });

        for (const mediaId of mediaToDelete) {
          await deleteMediaMutation.mutateAsync(mediaId)
        }

        if (newFiles.length > 0) {
          const formData = new FormData();
          formData.append('media_type', 'purchase_orders')
          formData.append('media_id', String(id))
          formData.append('collection_name', 'general')
          newFiles.forEach((file) => {
            formData.append('files', file)
          })
          await updateMediaMutation.mutateAsync(formData)
        }

        toast.success("Purchase order updated successfully");
        router.back();
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
          toast.error(responseData?.message ?? "Failed to update purchase order");
        }
      }
    },
    [updateMutation, updateMediaMutation, deleteMediaMutation, id, form, router, mediaToDelete, newFiles],
  );

  return {
    form,
    handleSubmit,
    isSubmitting: updateMutation.isPending,
    detailFields,
    appendDetail,
    removeDetail,
    existingMedia,
    newFiles,
    handleRemoveExisting,
    handleAddFiles,
    handleRemoveNewFile,
  };
};
