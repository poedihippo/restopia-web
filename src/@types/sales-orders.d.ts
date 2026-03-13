export interface ISalesOrderList {
    data?: ISalesOrder[];
    meta?: Meta;
}

export interface ISalesOrder {
    id: number;
    branch_id?: number;
    type?: string;
    customer_id?: number;
    customer_name?: string;
    customer_phone?: string;
    code?: string;
    total_price?: number;
    subtotal_price?: number;
    discount_price?: number;
    voucher_id?: number;
    date?: string;
    fulfillment_date?: string;
    status?: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
    branch?: Branch;
    sales_order_details?: SalesOrderDetail[];
    media?: Media[]
    created_by?: AtedBy;
    updated_by?: AtedBy;
}

export interface AtedBy {
    id?: number;
    nik?: null;
    name?: string;
    email?: string;
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

export interface Branch {
    id?: number;
    code?: string;
    name?: string;
}

export interface SalesOrderDetail {
    id?: number;
    product_inventory_id?: number;
    qty?: number;
    price?: number;
    status?: string;
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

export interface ISalesOrderDTO {
    code: string;
    type: string;
    customer_id?: number;
    customer_name?: string;
    customer_phone?: string;
    date: string;
    fulfillment_date: string;
    voucher_id: number | null | undefined;
    subtotal_price: number;
    discount_price: number;
    total_price: number;
    status: string;
    description: string
    details: ISalesOrderDetailDTO[]
}

export interface ISalesOrderDetailDTO {
    product_inventory_id: number;
    qty: number;
    price: number;
    status: string;
    description: string
}