import { useMutation } from "@tanstack/react-query";
import { authService } from "@/services/auth.service";
import { cookies } from "@/lib/cookies";

const useLoginMutation = () => {
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      authService.login({
        email: data.email,
        password: data.password,
      }),

    onSuccess: (res) => {
      if (res.data.data.access_token) {
        cookies.set("token", res.data.data.access_token, { path: "/" });
      }
    },
  });
};

export default useLoginMutation;
