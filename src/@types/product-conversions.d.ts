import { Meta } from "./global";

export interface IProductConversionsList {
  data?: IProductConversions[];
  meta?: Meta;
}

export interface IProductConversions {
  id: number;
  product_id: number;
  uom_id: number;
  target_uom_id: number;
  amount: number;
  created_at?: Date;
  updated_at?: Date;
  product?: Product;
  uom?: Uom;
  target_uom?: Uom;
}

export interface Uom {
  id?: number;
  code?: string;
  name?: string;
}

export interface Product {
  id?: number;
  product_category_id?: number;
  code?: string;
  name?: string;
}

export interface IProductConversionsDTO {
  product_id: number | string;
  uom_id: number | string;
  target_uom_id: number | string;
  amount: number;
}
