import { Meta } from "./global";

export interface IVoucherList {
    data?: IVoucher[];
    meta?: Meta;
}

export interface IVoucher {
    id: number;
    company_id?: number;
    code?: string;
    name?: string;
    discount_type?: "percent" | 'fixed';
    discount_value?: number;
    min_subtotal_price?: number;
    max_discount_price?: number | null;
    scope?: "company" | "branch";
    valid_from?: string;
    valid_until?: string;
    quota?: number | null;
    used_quota?: number;
    status?: 'active' | 'inactive';
    description?: string;
    created_at?: Date;
    updated_at?: Date;
    voucher_branches?: VoucherBranch[];
    voucher_product_uoms?: VoucherProductUom[];
    created_by?: AtedBy;
    updated_by?: AtedBy;
}

export interface AtedBy {
    id?: number;
    nik?: null;
    name?: string;
    email?: string;
}

export interface VoucherBranch {
    id?: number;
    branch_id?: number;
    quota?: number;
    used_quota?: number;
    branch?: Branch;
}

export interface Branch {
    id?: number;
    code?: string;
    name?: string;
}

export interface VoucherProductUom {
    id?: number;
    product_uom_id?: number;
    quota?: number;
    used_quota?: number;
    product_uom?: ProductUom;
}

export interface ProductUom {
    id?: number;
    product_id?: number;
    uom_id?: number;
    price?: number;
    product?: Product;
    uom?: Branch;
}

export interface Product {
    id?: number;
    product_category_id?: number;
    code?: string;
    name?: string;
    description?: null;
}

export interface IVoucherDTO {
    code: string;
    name: string;
    discount_type: "percent" | 'fixed';
    discount_value: number;
    min_subtotal_price: number;
    max_discount_price: number;
    scope: "branch" | "company";
    valid_from: string;
    valid_until: string;
    quota: number;
    status: string;
    description: string;
    branches: IVoucherBranchDTO[];
    product_uoms: IVoucherProductUoms[];

}

export interface IVoucherBranchDTO {
    branch_id: number;
    quota?: number
}

export interface IVoucherProductUoms {
    product_uom_id: number
    quota?: number
}

export interface IVoucherStatusDTO {
    status: "active" | 'inactive'
}