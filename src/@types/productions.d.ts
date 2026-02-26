import { Meta } from "./global";

export interface IProductionsList {
  data?: IProduction[];
  meta?: Meta;
}

export interface IProduction {
  id: number;
  branch_id?: number;
  code?: string;
  date?: string;
  status?: string;
  description?: string;
  created_at?: Date;
  updated_at?: Date;
  branch?: Branch;
  production_details?: ProductionDetail[];
}

export interface Branch {
  id?: number;
  code?: string;
  name?: string;
}

export interface ProductionDetail {
  id?: number;
  product_inventory_id?: number;
  qty?: number;
  status?: string;
  description?: string;
  product_inventory?: ProductInventory;
  product_detail_materials?: ProductDetailMaterial[];
}

export interface ProductDetailMaterial {
  id?: number;
  product_inventory_id?: number;
  uom_id?: number;
  qty?: number;
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
  product_category?: ProductCategory;
}

export interface ProductCategory {
  id?: number;
  name?: string;
}

export interface IProductionDTO {
  code: string;
  date: string | Date;
  status: string;
  description: string;
  details: IProductionDetailDTO[];
}

export interface IProductionDetailDTO {
  product_inventory_id: number;
  qty: number;
  status: string;
  description: string | null;
  materials: IProductionMaterialDTO[];
}

export interface IProductionMaterialDTO {
  product_inventory_id: number;
  qty: number;
}
