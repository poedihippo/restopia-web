import { ISuccessResponseMessage } from "@/@types/global";
import { IMediaDTO } from "@/@types/media";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: IMediaDTO | FormData;
}

const useMediaUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`media/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["medias"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useMediaUpdateMutation;
