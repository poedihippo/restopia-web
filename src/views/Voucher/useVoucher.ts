import useGetCompaniesList from '@/hooks/companies/useGetCompaniesList';
import useDataTable from '@/hooks/useDataTable';
import useGetVoucherList from '@/hooks/voucher/useGetVoucherList';
import { useCallback, useMemo, useState } from 'react';
import { useDeleteVoucherModal } from './Form/useDeleteVoucherModal';
import { useEditVoucherModal } from './Modal/useEditVoucherModal';

const useVoucher = () => {
    const [companyId, setCompanyId] = useState<number | null>();
    const [validUntilGte, setValidUntilGte] = useState<string | null>();
    const [validUntilLte, setValidUntilLte] = useState<string | null>();
    const [validFromGte, setValidFromGte] = useState<string | null>();
    const [validFromLte, setValidFromLte] = useState<string | null>();
    const [status, setStatus] = useState<string | null>();
    const [scope, setScope] = useState<string | null>();
    const [discountType, setDiscountType] = useState<string | null>();
    const [filterKey, setFilterKey] = useState(0);

    const extraParams = useMemo(() => {
        const filter: Record<string, unknown> = {
            company_id: companyId,
            discount_type: discountType,
            scope: scope,
            status: status,
            valid_from_gte: validFromGte,
            valid_from_lte: validFromLte,
            valid_until_gte: validUntilGte,
            valid_until_lte: validUntilLte,
        };
        const activeFilter = Object.fromEntries(
            Object.entries(filter).filter(([, v]) => v != null),
        );

        return {
            include: "created_by,updated_by,voucher_branches,voucher_product_uoms",
            ...(Object.keys(activeFilter).length > 0 ? { filter: activeFilter } : {}),
        };
    }, [companyId, discountType, status, scope, validFromGte, validFromLte, validUntilGte, validUntilLte]);

    const {
        queryParams,
        search,
        buildPagination,
        handlePageChange,
        handleSearch,
    } = useDataTable({ defaultSort: "-id", extraParams });

    const { data, isLoading, refetch } = useGetVoucherList(queryParams);
    const { data: companyData, isLoading: isLoadingCompany } = useGetCompaniesList();

    const vouchers = useMemo(() => data?.data ?? [], [data?.data]);
    const companies = useMemo(() => companyData?.data ?? [], [companyData?.data]);

    const pagination = useMemo(
        () => buildPagination(data?.meta),
        [buildPagination, data?.meta],
    );

    const deleteModal = useDeleteVoucherModal(refetch);
    const editModal = useEditVoucherModal(refetch);

    const handleCompanyChange = useCallback((id?: number) => {
        setCompanyId(id);
    }, []);

    const handleClearFilter = useCallback(() => {
        setCompanyId(null);
        setDiscountType(null);
        setStatus(null);
        setScope(null);
        setValidFromGte(null);
        setValidFromLte(null);
        setValidUntilGte(null);
        setValidUntilLte(null);
        setFilterKey((k) => k + 1);
    }, []);

    return {
        vouchers,
        companies,
        pagination,
        isLoading,
        search,
        isLoadingCompany,
        filterKey,
        setValidFromGte,
        setValidFromLte,
        setValidUntilGte,
        setValidUntilLte,
        setDiscountType,
        setStatus,
        setScope,
        handleClearFilter,
        handleCompanyChange,
        handlePageChange,
        handleSearch,
        editModal,
        deleteModal,
    }
}

export default useVoucher
