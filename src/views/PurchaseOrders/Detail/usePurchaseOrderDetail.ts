import useGetPurchaseOrder from '@/hooks/purchase-order/useGetPurchaseOrder';
import { productInventoriesService } from '@/services/product-inventories.service';
import productUomBatchesService from '@/services/product-uom-batches.service';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

interface Props {
    id: number
}

const usePurchaseOrderDetail = ({ id }: Props) => {
    const { data: poData, isLoading: isPoLoading } = useGetPurchaseOrder(id, {
        include: "created_by,updated_by,branch,supplier,supplier_branch,media,purchase_order_details,purchase_order_details.product_uom,purchase_order_details.product_uom.product,purchase_order_details.product_uom.uom",
    });

    const { data: inventories, isLoading: isInvLoading } = useQuery({
        queryKey: ['po-inventories', poData?.id],
        enabled: !!poData?.purchase_order_details?.length,
        queryFn: async () => {
            const uomIds = Array.from(new Set(poData!.purchase_order_details?.map((d: any) => d.product_uom_id).filter(Boolean)));
            if (!uomIds.length) return [];
            
            // 1. Fetch batches
            const batchPromises = uomIds.map((uomId) => 
                productUomBatchesService.list({
                    'filter[product_uom_id]': uomId,
                    per_page: 100,
                } as any)
            );
            const batchResponses = await Promise.all(batchPromises);
            const batches = batchResponses.flatMap((res: any) => res.data?.data ?? []);

            if (!batches.length) return [];

            // 2. Fetch inventories
            const batchIds = batches.map((b: any) => b.id).join(',');
            let allInventories: any[] = [];

            const invRes = await productInventoriesService.list({
                'filter[product_uom_batch_id]': batchIds,
                'filter[branch_id]': poData!.branch_id,
                'filter[status]': 'active',
                include: 'product_uom_batch,product_uom_batch.product_uom,product_uom_batch.product_uom.product,product_uom_batch.product_uom.uom',
                per_page: 100,
            } as any);
            allInventories = (invRes.data as any)?.data ?? [];

            if (allInventories.length === 0) {
                const invPromises = batches.map((b: any) =>
                    productInventoriesService.list({
                        'filter[product_uom_batch_id]': b.id,
                        'filter[branch_id]': poData!.branch_id,
                        'filter[status]': 'active',
                        include: 'product_uom_batch,product_uom_batch.product_uom,product_uom_batch.product_uom.product,product_uom_batch.product_uom.uom',
                        per_page: 1,
                    } as any)
                );
                const invResponses = await Promise.all(invPromises);
                allInventories = invResponses.flatMap(res => (res.data as any)?.data ?? []);
            }

            return allInventories;
        }
    });

    const data = useMemo(() => {
        if (!poData) return undefined;
        return {
            ...poData,
            purchase_order_details: poData.purchase_order_details?.map((detail: any) => {
                const inv = inventories?.find((i: any) => i.product_uom_batch?.product_uom_id === detail.product_uom_id);
                return {
                    ...detail,
                    product_inventory: inv ?? detail.product_inventory ?? null,
                    product_inventory_id: inv?.id ?? detail.product_inventory_id ?? null,
                };
            })
        };
    }, [poData, inventories]);

    return {
        data,
        isLoading: isPoLoading || isInvLoading,
    }
}

export default usePurchaseOrderDetail
