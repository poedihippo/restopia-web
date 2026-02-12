import { useMutation } from "@tanstack/react-query";
import { authApi } from "../useApi";
import { cookies } from "@/lib/cookies";
import { ILogin, ILoginResponse } from "@/@types/user";
import type { AxiosResponse } from "axios";

const useLoginMutation = () => {
  return useMutation({
    mutationFn: (data: ILogin) =>
      authApi.post<ILoginResponse>("auth/token", {
        email: data.email,
        password: data.password,
      }),

    onSuccess: (res: AxiosResponse<ILoginResponse>) => {
      cookies.set("token", res.data.data.access_token, { path: "/" });
    },
  });
};

export default useLoginMutation;
