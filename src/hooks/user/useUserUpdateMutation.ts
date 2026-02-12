import { ISuccessResponseMessage } from "@/@types/global";
import { IUserDTO } from "@/@types/user";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: IUserDTO;
}

const useUserUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`users/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useUserUpdateMutation;
