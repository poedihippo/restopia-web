import { ISuccessResponseMessage } from "@/@types/global";
import { IRoleDTO } from "@/@types/role";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: IRoleDTO;
}

const useRoleUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`roles/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useRoleUpdateMutation;
