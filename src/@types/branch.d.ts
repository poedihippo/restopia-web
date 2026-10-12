import { Meta } from "./global";

export interface IBranchList {
  data: IBranch[];
  meta: Meta;
}

export interface IBranch {
  id: number;
  company_id?: number;
  code?: string;
  name?: string;
  type?: 'warehouse' | 'production' | 'outlet' | 'others';
  is_default?: boolean;
  created_at?: Date;
  updated_at?: Date;
  company?: ICompanyBranch;
}

export interface ICompanyBranch {
  id: number;
  name: string;
  product_types?: string | null;
}

export interface IBranchDTO {
  code: string;
  name: string;
  is_default: boolean;
}
