import { ISuccessResponseMessage } from "@/@types/global";
import { IRoleDTO } from "@/@types/role";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useRoleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IRoleDTO) => api.post("roles", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useRoleMutation;
