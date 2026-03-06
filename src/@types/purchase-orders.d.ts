export interface IPurchaseOrderList {
    data?: IPurchaseOrder[];
    meta?: Meta;
}

export interface IPurchaseOrder {
    id: number;
    branch_id?: number;
    code?: string;
    supplier_id?: number | null;
    supplier_branch_id?: number | null;
    date?: Date;
    total_price?: number;
    description?: string;
    status?: string;
    created_at?: Date;
    updated_at?: Date;
    branch?: Branch;
    media?: Media[]
    purchase_order_details?: PurchaseOrderDetail[];
}

export interface Branch {
    id?: number;
    code?: string;
    name?: string;
}

export interface PurchaseOrderDetail {
    id?: number;
    product_inventory_id: number;
    qty: number;
    price: number;
    description?: string;
    product_inventory?: ProductInventory;
}

export interface ProductInventory {
    id?: number;
    product_uom_id?: number;
    sku?: string;
    stock?: number;
    price?: number;
    expiry_date?: null;
    status?: string;
    is_default?: boolean;
    product_uom?: ProductUom;
}

export interface ProductUom {
    id?: number;
    product_id?: number;
    uom_id?: number;
    price?: number;
    is_default?: boolean;
    product?: Product;
    uom?: Branch;
}

export interface Product {
    id?: number;
    product_category_id?: number;
    code?: string;
    name?: string;
    description?: null;
    product_category?: ProductCategory;
}

export interface ProductCategory {
    id?: number;
    name?: string;
}

export interface Media {
    id?: number;
    uuid?: string;
    media_type?: string;
    media_id?: number;
    collection_name: string;
    file_name?: string;
    disk?: string;
    path?: string;
    size?: number;
    mime_type?: string;
    status?: string;
    url?: string;
    created_at?: Date;
    created_by_id?: number;
    updated_at?: Date;
    updated_by_id?: number;
}


export interface IPurchaseOrderDTO {
    code: string;
    supplier_id?: number;
    supplier_branch_id?: number;
    date: string;
    total_price: number;
    status: string;
    description: string;
    details: IPurchaseOrderDetailDTO[]
}

export interface IPurchaseOrderDetailDTO {
    product_inventory_id: number;
    qty: number;
    price: number;
    description: string
}
