import { ISuccessResponseMessage } from "@/@types/global";
import { IRecipeDTO } from "@/@types/recipes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: IRecipeDTO;
}

const useRecipeUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`recipes/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useRecipeUpdateMutation;
