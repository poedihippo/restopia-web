export interface IProductUomsList {
  data: IProductUom[];
  meta?: Meta;
}

export interface IProductUom {
  id: number;
  product_id?: number;
  uom_id: number;
  code: string;
  name?: string | null;
  base_price: number;
  online_price: number;
  price_editable: boolean;
  is_default: boolean;
  created_at?: Date;
  updated_at?: Date;
  product?: Product;
  uom?: Product;
  created_by?: AtedBy;
  updated_by?: AtedBy;
}

export interface Product {
  id?: number;
  product_category_id?: number;
  code?: string;
  name?: string;
  type?: string;
  description?: string | null,
  product_category?: {
    id?: number,
    name?: string
  }
}

export interface UOM {
  id?: number;
  code?: string;
  name?: string
}

export interface AtedBy {
  id?: number;
  nik?: null;
  name?: string;
  email?: string;
}

export interface IProductUomDTO {
  product_id: number;
  uom_id: number;
  code: string;
  base_price: number;
  online_price: number;
  price_editable: boolean;
  is_default: boolean;
}
