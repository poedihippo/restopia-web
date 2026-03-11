import { Meta } from "./global";

export interface IProductInventoriesList {
  data?: IProductInventories[];
  meta?: Meta;
}

export interface IProductInventories {
  id: number;
  branch_id?: number;
  product_uom_id?: number;
  expiry_date?: string;
  sku?: string;
  stock?: number;
  price?: number;
  status?: string;
  is_default?: boolean;
  created_at?: Date;
  updated_at?: Date;
  branch?: Branch;
  product_uom?: ProductUom;
}

export interface Branch {
  id?: number;
  code?: string;
  name?: string;
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

export interface IProductInventoriesDTO {
  product_uom_id: number;
  sku: string;
  price: number;
  expiry_date?: string;
  status: string;
  is_default: boolean;
}
