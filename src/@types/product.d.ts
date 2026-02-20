import { Meta } from "./global";

export interface IProductList {
  data: IProduct[];
  meta?: Meta;
}

export interface IProduct {
  id: number;
  product_category_id: number;
  code?: string;
  name?: string;
  created_at?: Date;
  updated_at?: Date;
  product_category?: ProductCategory;

  //   ga tau ada atau kg
  price?: number;
  type?: string;
  description?: string;
}

export interface ProductCategory {
  id?: number;
  name?: string;
}

export interface IProductDTO {
  product_category_id: number;
  code: string;
  name: string;
  type: string;
  description: string;
}
