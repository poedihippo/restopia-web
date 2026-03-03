import { ISuccessResponseMessage } from "@/@types/global";
import { IMediaDTO } from "@/@types/media";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useMediaMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IMediaDTO | FormData) =>
      api.post("media", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["medias"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useMediaMutation;
