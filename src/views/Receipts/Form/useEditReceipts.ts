import { IReceiptDTO } from "@/@types/receipts";
import useMediaDeleteMutation from "@/hooks/media/useMediaDeleteMutation";
import useMediaMutation from "@/hooks/media/useMediaMutation";
import useGetReceipts from "@/hooks/receipts/useGetReceipts";
import useReceiptsUpdateMutation from "@/hooks/receipts/useReceiptsUpdateMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { format } from "date-fns";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const DetailSchema = z.object({
  client_ref: z.string().optional(),
  product_inventory_id: z
    .number()
    .min(1, "Choose at least 1 product inventory"),
  delivery_detail_id: z
    .number()
    .min(1, "Choose at least 1 delivery detail"),
  qty: z.number().min(1, "Quantity is required"),
  price: z.number().min(1, "Price is required"),
  status: z.string().min(1, 'Please choose status'),
  description: z.string(),
});

const Schema = z.object({
  code: z.string().min(1, "Code is required"),
  delivery_id: z.number().min(1, 'Please choose delivery'),
  date: z.string().min(1, "Date is required"),
  total_price: z.number().min(1, "Total price is required"),
  status: z.string().min(1, "Please choose status"),
  description: z.string().min(1, "Description is required"),
  details: z.array(DetailSchema).min(1, "At least 1 detail"),
});
export type ReceiptsFormValues = z.infer<typeof Schema>;

interface Props {
  id: number;
}

export const useEditReceipts = ({ id }: Props) => {
  const router = useRouter();
  const [mediaToDelete, setMediaToDelete] = useState<number[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])

  const { data } = useGetReceipts(id, {
    include: "created_by,updated_by,branch,delivery,media,receipt_details",
  });
  const allMedia = useMemo(
    () => data?.media ?? []
    , [data])

  const updateMutation = useReceiptsUpdateMutation();
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

  const form = useForm<ReceiptsFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      code: "",
      delivery_id: undefined,
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
      delivery_id: data?.delivery_id ?? undefined,
      date: data?.date ? format(new Date(data.date), "yyyy-MM-dd") : "",
      total_price: data?.total_price,
      status: data?.status,
      description: data?.description,
      details:
        data?.receipt_details?.map((detail) => ({
          product_inventory_id: detail.product_inventory_id,
          delivery_detail_id: detail.delivery_detail_id,
          qty: detail.qty,
          status: detail.status,
          price: detail.price,
          description: detail?.description ?? '',
        })) ?? [],
    });
  }, [data]);

  const {
    fields: detailFields,
  } = useFieldArray({
    control: form.control,
    name: "details",
  });

  const handleSubmit = useCallback(
    async (values: ReceiptsFormValues) => {
      if (!id) return;

      try {
        const updateData: IReceiptDTO = {
          code: values.code,
          total_price: values.total_price,
          delivery_id: values.delivery_id,
          date: values.date,
          status: values.status,
          description: values.description,
          details: values.details.map((d, i) => ({
            ...d,
            client_ref: `receipts${i + 1}`
          })),
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
          formData.append('media_type', 'receipts')
          formData.append('media_id', String(id))
          formData.append('collection_name', 'general')
          newFiles.forEach((file) => {
            formData.append('files', file)
          })
          await updateMediaMutation.mutateAsync(formData)
        }

        toast.success("Receipt updated successfully");
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
              form.setError(field as keyof ReceiptsFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to update receipt");
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
    existingMedia,
    newFiles,
    handleRemoveExisting,
    handleAddFiles,
    handleRemoveNewFile,
    receiptData: data,
  };
};
