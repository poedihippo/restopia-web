import useGetBranchList from '@/hooks/branches/useGetBranchList';
import useGetDeliveriesList from '@/hooks/deliveries/useGetDeliveriesList';
import useGetReceiptsList from '@/hooks/receipts/useGetReceiptsList';
import useDataTable from '@/hooks/useDataTable';
import { useCallback, useMemo, useState } from 'react';
import { useDeleteReceiptsModal } from './Form/useDeleteReceiptsModal';

const useReceipts = () => {
    const [branchId, setBranchId] = useState<number | null>();
    const [deliveryId, setDeliveryId] = useState<number | null>();
    const [status, setStatus] = useState<string | null>();
    const [startDate, setStartDate] = useState<string | null>();
    const [endDate, setEndDate] = useState<string | null>();
    const [filterKey, setFilterKey] = useState(0);

    const extraParams = useMemo(() => {
        const filter: Record<string, unknown> = {
            branch_id: branchId,
            delivery_id: deliveryId,
            status: status,
            date_gte: startDate,
            date_lte: endDate,
        };
        const activeFilter = Object.fromEntries(
            Object.entries(filter).filter(([, v]) => v != null),
        );

        return {
            include: "created_by,updated_by,branch,delivery,media,receipt_details",
            ...(Object.keys(activeFilter).length > 0 ? { filter: activeFilter } : {}),
        };
    }, [branchId, startDate, status, endDate, deliveryId]);

    const {
        queryParams,
        search,
        buildPagination,
        handlePageChange,
        handleSearch,
    } = useDataTable({ defaultSort: "-id", extraParams });

    const { data, isLoading, refetch } = useGetReceiptsList(queryParams);
    const { data: branchData, isLoading: isLoadingBranch } = useGetBranchList();
    const { data: deliveryData, isLoading: isLoadingDelivery } = useGetDeliveriesList();

    const receipts = useMemo(() => data?.data ?? [], [data?.data]);
    const branches = useMemo(() => branchData?.data ?? [], [branchData?.data]);
    const deliveries = useMemo(() => deliveryData?.data ?? [], [deliveryData?.data]);

    const pagination = useMemo(
        () => buildPagination(data?.meta),
        [buildPagination, data?.meta],
    );

    const deleteModal = useDeleteReceiptsModal(refetch);

    const handleBranchChange = useCallback((id?: number) => {
        setBranchId(id);
    }, []);

    const handleDeliveryChange = useCallback((id?: number) => {
        setDeliveryId(id);
    }, []);


    const handleClearFilter = useCallback(() => {
        setBranchId(null);
        setDeliveryId(null);
        setStatus(null);
        setStartDate(null);
        setEndDate(null);
        setFilterKey((k) => k + 1);
    }, []);

    return {
        receipts,
        branches,
        deliveries,
        pagination,
        isLoading,
        search,
        isLoadingBranch,
        isLoadingDelivery,
        filterKey,
        setStartDate,
        setEndDate,
        setStatus,
        handleClearFilter,
        handleDeliveryChange,
        handleBranchChange,
        handlePageChange,
        handleSearch,
        deleteModal,
    }
}

export default useReceipts
