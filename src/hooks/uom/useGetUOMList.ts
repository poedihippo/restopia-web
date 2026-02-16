import { IListParams } from "@/@types/global";
import { IUOMList } from "@/@types/uom";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetUOMList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["uoms", "list", params],
    queryFn: async () => {
      const response = await api.get<IUOMList>(
        "uoms",
        { params },
      );
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetUOMList;
