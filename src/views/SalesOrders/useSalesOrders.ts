import useGetBranchList from '@/hooks/branches/useGetBranchList';
import useGetSalesOrderList from '@/hooks/sales-orders/useGetSalesOrderList';
import useDataTable from '@/hooks/useDataTable';
import useGetVoucherList from '@/hooks/voucher/useGetVoucherList';
import { useCallback, useMemo, useState } from 'react';
import { useDeleteSalesOrdersModal } from './Form/useDeleteSalesOrdersModal';
import useGetCustomerList from '@/hooks/customer/useGetCustomerList';

const useSalesOrders = () => {
    const [branchId, setBranchId] = useState<number | null>();
    const [customerId, setCustomerId] = useState<number | null>();
    const [voucherId, setVoucherId] = useState<number | null>();
    const [status, setStatus] = useState<string | null>();
    const [dateGte, setDateGte] = useState<string | null>();
    const [dateLte, setDateLte] = useState<string | null>();
    const [fulfillmentDateGte, setFulfillmentDateGte] = useState<string | null>();
    const [fulfillmentDateLte, setFulfillmentDateLte] = useState<string | null>();
    const [filterKey, setFilterKey] = useState(0);

    const extraParams = useMemo(() => {
        const filter: Record<string, unknown> = {
            branch_id: branchId,
            customer_id: customerId,
            voucher_id: voucherId,
            status: status,
            date_gte: dateGte,
            date_lte: dateLte,
            fulfillment_date_gte: fulfillmentDateGte,
            fulfillment_date_lte: fulfillmentDateLte,
        };
        const activeFilter = Object.fromEntries(
            Object.entries(filter).filter(([, v]) => v != null),
        );

        return {
            include: "created_by,updated_by,branch,customer,media,sales_order_details",
            ...(Object.keys(activeFilter).length > 0 ? { filter: activeFilter } : {}),
        };
    }, [branchId, customerId, voucherId, status, dateGte, dateLte, fulfillmentDateGte, fulfillmentDateLte]);

    const {
        queryParams,
        search,
        buildPagination,
        handlePageChange,
        handleSearch,
    } = useDataTable({ defaultSort: "-id", extraParams });

    const { data, isLoading, refetch } = useGetSalesOrderList(queryParams);
    const { data: branchData, isLoading: isLoadingBranch } = useGetBranchList();
    const { data: voucherData, isLoading: isLoadingVoucher } = useGetVoucherList();
    const { data: customerData, isLoading: isLoadingCustomer } = useGetCustomerList();

    const salesOrders = useMemo(() => data?.data ?? [], [data?.data]);
    const vouchers = useMemo(() => voucherData?.data ?? [], [voucherData?.data]);
    const branches = useMemo(() => branchData?.data ?? [], [branchData?.data]);
    const customers = useMemo(() => customerData?.data ?? [], [customerData?.data]);

    const pagination = useMemo(
        () => buildPagination(data?.meta),
        [buildPagination, data?.meta],
    );

    const deleteModal = useDeleteSalesOrdersModal(refetch);

    const handleBranchChange = useCallback((id?: number) => {
        setBranchId(id);
    }, []);

    const handleVoucherChange = useCallback((id?: number) => {
        setVoucherId(id);
    }, []);

    const handleCustomerChange = useCallback((id?: number) => {
        setCustomerId(id);
    }, []);

    const handleClearFilter = useCallback(() => {
        setBranchId(null);
        setVoucherId(null);
        setCustomerId(null);
        setStatus(null);
        setDateGte(null);
        setDateLte(null);
        setFulfillmentDateGte(null);
        setFulfillmentDateLte(null);
        setFilterKey((k) => k + 1);
    }, []);

    return {
        salesOrders,
        vouchers,
        branches,
        customers,
        pagination,
        isLoading,
        search,
        isLoadingCustomer,
        isLoadingBranch,
        isLoadingVoucher,
        filterKey,
        setDateGte,
        setDateLte,
        setFulfillmentDateGte,
        setFulfillmentDateLte,
        setStatus,
        handleClearFilter,
        handleCustomerChange,
        handleVoucherChange,
        handleBranchChange,
        handlePageChange,
        handleSearch,
        deleteModal,
    }
}

export default useSalesOrders
