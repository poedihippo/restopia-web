import { ISuccessResponseMessage } from "@/@types/global";
import { IUserBranchChange } from "@/@types/user";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useUserBranchPatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IUserBranchChange) => api.patch("auth/change-active-branch", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useUserBranchPatch;
