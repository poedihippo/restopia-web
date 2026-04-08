import { toast } from 'sonner';

export function parseApiError(err: any): string {
  const data = err?.response?.data;
  if (!data) return 'An unexpected error occurred';

  // Collect all field-level error messages
  if (data.errors && typeof data.errors === 'object') {
    const messages = Object.values(data.errors)
      .flat()
      .filter(Boolean);
    if (messages.length > 0) return messages.join('\n');
  }

  // Fallback to top-level message
  return data.message ?? 'An unexpected error occurred';
}

/** Shows field-level API errors as separate toasts; otherwise top-level message or fallback. */
export function toastMutationApiError(
  err: any,
  fallbackMessage = 'An unexpected error occurred',
): void {
  const data = err?.response?.data;
  if (data?.errors && typeof data.errors === 'object') {
    const messages = Object.values(data.errors).flat().filter(Boolean);
    if (messages.length > 0) {
      (messages as string[]).forEach((msg) => toast.error(String(msg)));
      return;
    }
  }
  toast.error(data?.message ?? fallbackMessage);
}
