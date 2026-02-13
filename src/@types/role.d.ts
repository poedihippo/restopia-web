import { Meta } from "./global";

export interface IRoleList {
  data: IRole[];
  meta: Meta;
}

export interface IRole {
  id: number;
  company_id?: number;
  name: string;
  created_at?: Date;
  updated_at?: Date;
  permissions?: Permission[];
}

export interface Permission {
  id?: number;
  name?: string;
}

export interface IRoleDTO {
  name: string;
  permissions_ids: number[];
}
