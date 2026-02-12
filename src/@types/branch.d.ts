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
  is_default?: boolean;
  created_at?: Date;
  updated_at?: Date;
}
