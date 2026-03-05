import useMediaMutation from "@/hooks/media/useMediaMutation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const mediaSchema = z.object({
  media_type: z.string().min(1, "Media type is required"),
  media_id: z.string().min(1, "Media id is required"),
  collection_name: z.string().min(1, "Collection name is required"),
  files: z.array(z.instanceof(File)).refine((files) => files.every(f => f.size <= 2_000_000), {
    message: 'Max file size is 2MB'
  }).min(1, "Please select at least 1 file").max(5, "Can input more then 5 images"),
});

export type MediaFormValues = z.infer<typeof mediaSchema>;

export const useCreateMediaModal = (media_type?: string, media_id?: string | number, onSuccess?: () => void) => {
  const [isOpen, setIsOpen] = useState(false);

  const createMutation = useMediaMutation();

  const form = useForm<MediaFormValues>({
    resolver: zodResolver(mediaSchema),
    defaultValues: {
      media_type: "",
      media_id: "",
      collection_name: "",
      files: [],
    },
  });

  const openModal = useCallback(() => {
    form.reset();
    setIsOpen(true);
  }, [form]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    form.reset();
  }, [form]);

  const handleSubmit = useCallback(
    async (values: MediaFormValues) => {
      try {

        const formData = new FormData()

        formData.append('media_type', values.media_type || media_type || '')
        formData.append('media_id', String(values.media_id || media_id || ''))
        formData.append('collection_name', values.collection_name)
        values.files.forEach((file) => {
          formData.append("files[]", file)
        })

        await createMutation.mutateAsync(formData);

        toast.success("User created successfully");
        closeModal();
        onSuccess?.();
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
              form.setError(field as keyof MediaFormValues, {
                type: "server",
                message: fieldErrors[0],
              });
            }
          });
          toast.error("Please fix the validation errors");
        } else {
          toast.error(responseData?.message ?? "Failed to create user");
        }
      }
    },
    [createMutation, closeModal, onSuccess, form, media_id, media_type],
  );

  return {
    isOpen,
    form,
    openModal,
    closeModal,
    handleSubmit,
    isSubmitting: createMutation.isPending,
  };
};
