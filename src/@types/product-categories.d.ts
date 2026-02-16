import { Meta } from "./global";

export interface IProductCategoriesList {
  data?: IProductCategories[];
  meta?: Meta;
}

export interface IProductCategories {
  id: number;
  name?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface IProductCategoriesDTO {
  name: string;
}
