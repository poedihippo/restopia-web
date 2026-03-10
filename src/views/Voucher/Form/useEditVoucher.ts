import { IVoucherDTO } from "@/@types/voucher";
import useGetVoucher from "@/hooks/voucher/useGetVoucher";
import useVoucherMutation from "@/hooks/voucher/useVoucherMutation";
import useVoucherUpdateMutation from "@/hooks/voucher/useVoucherUpdateMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { format } from "date-fns";
import { useRouter } from "next/router";
import { useCallback, useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const BranchSchema = z.object({
  branch_id: z.number().min(1, 'Choose at least 1 branch'),
  quota: z.number().optional()
})

const ProductUomsSchema = z.object({
  product_uom_id: z.number().min(1, 'Choose at least 1 product uoms'),
  quota: z.number().optional()
})

const Schema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, 'Name is required'),
  discount_type: z.enum(['percent', 'fixed']),
  discount_value: z.number().min(1, 'Discount value is required'),
  min_subtotal_price: z.number().min(1, 'Min Subtotal Price is required'),
  max_discount_price: z.number().min(1, 'Max Discount Price is required'),
  scope: z.enum(['branch', 'company']),
  valid_from: z.string().min(1, 'Valid from is required'),
  valid_until: z.string().min(1, 'Valid until is required'),
  quota: z.number().min(1, "Quota is required"),
  status: z.string().min(1, "Please choose status"),
  description: z.string().min(1, "Description is required"),
  branches: z.array(BranchSchema).min(1, "At least 1 Branch"),
  product_uoms: z.array(ProductUomsSchema).min(1, "At least 1 Product uoms"),
}).superRefine((data, ctx) => {
  if (data.discount_type === 'percent' && data.discount_value > 100) {
    ctx.addIssue({
      path: ['discount_value'],
      code: z.ZodIssueCode.custom,
      message: 'Percent discount cannot be more then 100'
    })
  }
});

export type VoucherFormValues = z.output<typeof Schema>;

interface Props {
  id: number;
}

export const useEditVoucher = ({ id }: Props) => {
  const router = useRouter()

  const { data } = useGetVoucher(id, {
    include: "created_by,updated_by,voucher_branches,voucher_product_uoms",
  });

  const updateMutation = useVoucherUpdateMutation();

  const form = useForm<VoucherFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      code: "",
      name: "",
      discount_type: 'percent',
      discount_value: 0,
      min_subtotal_price: 0,
      max_discount_price: 0,
      scope: 'company',
      valid_from: "",
      valid_until: "",
      quota: 0,
      status: '',
      description: "",
      branches: [],
      product_uoms: []
    },
  });

  useEffect(() => {
    form.reset({
      code: data?.code,
      name: data?.name,
      discount_type: data?.discount_type,
      discount_value: data?.discount_value,
      min_subtotal_price: data?.min_subtotal_price,
      max_discount_price: data?.max_discount_price ?? undefined,
      scope: data?.scope,
      valid_from: data?.valid_from ? format(data?.valid_from, 'yyyy-MM-dd') : undefined,
      valid_until: data?.valid_until ? format(data?.valid_until, 'yyyy-MM-dd') : undefined,
      quota: data?.quota ?? undefined,
      status: data?.status,
      description: data?.description,
      branches: data?.voucher_branches?.map((item) => ({
        branch_id: item.branch_id,
        quota: item.quota ?? undefined
      })),
      product_uoms: data?.voucher_product_uoms?.map((item) => ({
        product_uom_id: item.product_uom_id,
        quota: item.quota ?? undefined
      }))
    })
  }, [data])

  const {
    fields: branchFields,
    append: appendBranch,
    remove: removeBranch,
  } = useFieldArray({
    control: form.control,
    name: "branches",
  });

  const {
    fields: productFields,
    append: appendProduct,
    remove: removeProduct,
  } = useFieldArray({
    control: form.control,
    name: "product_uoms",
  });

  const handleSubmit = useCallback(
    async (values: VoucherFormValues) => {
      try {
        const payload: IVoucherDTO = {
          code: values.code,
          name: values.name,
          discount_type: values.discount_type,
          discount_value: values.discount_value,
          min_subtotal_price: values.min_subtotal_price,
          max_discount_price: values.max_discount_price,
          scope: values.scope,
          valid_from: values.valid_from,
          valid_until: values.valid_until,
          quota: values.quota,
          status: values.status,
          description: values.description,
          branches: values.branches.map((d) => ({
            branch_id: d.branch_id,
            ...(d.quota ? { quota: d.quota } : {})
          })),
          product_uoms: values.product_uoms.map((d) => ({
            product_uom_id: d.product_uom_id,
            ...(d.quota ? { quota: d.quota } : {})
          })),
        };

        await updateMutation.mutateAsync({
          id,
          data: payload
        });

        toast.success("Voucher updated successfully");
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
              form.setError(field as keyof VoucherFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to update voucher");
        }
      }
    },
    [updateMutation, form, router, id],
  );

  return {
    form,
    branchFields,
    productFields,
    appendBranch,
    appendProduct,
    removeBranch,
    removeProduct,
    handleSubmit,
    isSubmitting: updateMutation.isPending,
  };
};
