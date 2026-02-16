import { ISuccessResponseMessage } from "@/@types/global";
import { IUOMDTO } from "@/@types/uom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: IUOMDTO;
}

const useUOMUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`uoms/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["uoms"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useUOMUpdateMutation;
