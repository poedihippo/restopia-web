import useGetProduction from '@/hooks/productions/useGetProduction';

interface Props {
    id: number
}

const useProductionDetail = ({ id }: Props) => {
    const { data, isLoading } = useGetProduction(id, {
        include: "created_by,updated_by,branch,media,production_details",
    });

    return {
        data,
        isLoading,
    }
}

export default useProductionDetail
