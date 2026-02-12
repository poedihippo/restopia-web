import useLoginMutation from "@/hooks/auth/useLoginMutation";
import { useAuth } from "@/hooks/useAuth";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

const loginFormSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

const useLogin = () => {
  const { login } = useAuth();
  const loginMutation = useLoginMutation();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      const response = await loginMutation.mutateAsync(values);
      const token = response.data.data.access_token;
      const refreshToken = response.data.data.refresh_token;

      if (token && refreshToken) {
        toast.success("Login successful", {
          description: "Redirecting to dashboard...",
        });
        await login(token, refreshToken);
      }
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message
        : undefined;
      toast.error("Login failed", {
        description: message || "Invalid email or password",
      });
    }
  }

  return {
    form,
    onSubmit,
    isLoading: loginMutation.isPending,
    showPassword,
    setShowPassword,
  };
};

export default useLogin;
