export interface IProductUomsList {
  data?: IProductUom[];
  meta?: Meta;
}

export interface IProductUom {
  id: number;
  product_id?: number;
  uom_id: number;
  price: number;
  is_default: boolean;
  created_at?: Date;
  updated_at?: Date;
  product?: Product;
  uom?: Product;
}

export interface Product {
  id?: number;
  product_category_id?: number;
  code?: string;
  name?: string;
}

export interface IProductUomDTO {
  product_id: number;
  uom_id: number;
  price: number;
  is_default: boolean;
}
