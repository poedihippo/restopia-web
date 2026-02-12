import { ISuccessResponseMessage } from "@/@types/global";
import { IUserDTO } from "@/@types/user";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useUserMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IUserDTO) => api.post("users", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useUserMutation;
