import { Meta } from "./global";

export interface IStockMovementsList {
  data?: IStockMovement[];
  meta?: Meta;
}

export interface IStockMovement {
  id: number;
  branch_id?: number;
  product_inventory_id?: number;
  reference_type?: null;
  reference_id?: null;
  qty?: number;
  stock_before?: number;
  stock_after?: number;
  direction?: string;
  description?: null;
  created_at?: Date;
  branch?: Branch;
  product_inventory?: ProductInventory;
}

export interface Branch {
  id?: number;
  code?: string;
  name?: string;
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
  product_category?: ProductCategory;
}

export interface ProductCategory {
  id?: number;
  name?: string;
}

export interface IStockMovementDTO {
  product_inventory_id: number;
  qty: number;
  direction: string;
  description: string;
}
