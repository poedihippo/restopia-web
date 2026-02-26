import { IDetailParams } from "@/@types/global";
import { IRecipe } from "@/@types/recipes";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetRecipe = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["recipe", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: IRecipe }>(
        `recipes/${id}`,
        {
          params,
        },
      );
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetRecipe;
