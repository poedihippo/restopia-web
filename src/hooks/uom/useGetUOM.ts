import { IDetailParams } from "@/@types/global";
import { IUOM } from "@/@types/uom";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetUOM = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["uom", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: IUOM }>(
        `uoms/${id}`,
        {
          params,
        },
      );
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetUOM;
