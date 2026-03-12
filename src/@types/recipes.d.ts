import { Meta } from "./global";

export interface IRecipesList {
  data?: IRecipe[];
  meta?: Meta;
}

export interface IRecipe {
  id: number;
  product_id?: number;
  material_product_id?: number;
  material_uom_id?: number;
  qty?: number;
  created_at?: Date;
  updated_at?: Date;
  product?: MaterialProduct;
  material_product?: MaterialProduct;
  material_uom?: MaterialProduct;
}

export interface MaterialProduct {
  id?: number;
  product_category_id?: number;
  code?: string;
  name?: string;
}

export interface IRecipeDTO {
  product_id: number;
  qty: number;
  is_default: boolean;
  materials: IRecipeMaterialDTO[]
}

export interface IRecipeMaterialDTO {
  product_id: number;
  uom_id: number,
  qty: number
}
