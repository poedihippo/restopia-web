import { ISuccessResponseMessage } from "@/@types/global";
import { IProductionDTO } from "@/@types/productions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: IProductionDTO;
}

const useProductionUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`productions/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useProductionUpdateMutation;
