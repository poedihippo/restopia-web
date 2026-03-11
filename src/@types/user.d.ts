import { Meta } from "./global";
import { IBranch } from "./branch";
import { IRole } from "./role";

export interface IUserMe {
  id?: number;
  nik?: string;
  name?: string;
  type?: string;
  branch_id?: number;
  email?: string;
  created_at?: Date;
  created_by_id?: number;
  updated_at?: Date;
  updated_by_id?: number;
  branch?: IBranch;
  branches?: IBranch[];
  roles?: IRole[];
}

interface ILogin {
  email: string;
  password: string;
}

export interface ILoginResponse {
  data: DataResponse;
}

export interface DataResponse {
  access_token: string;
  access_token_expiration: Date;
  refresh_token: string;
  refresh_token_expiration: Date;
}

export interface IUserList {
  data: IUser[];
  meta: Meta;
}

export interface IUser {
  id: number;
  name?: string;
  type?: string;
  branch_id?: number[];
  role_ids?: number[];
  email?: string;
  created_at?: Date;
  updated_at?: Date;
  nik?: string;
  created_by_id?: number;
  updated_by_id?: number;
  created_by?: AtedBy;
  updated_by?: AtedBy;
  phone?: string;
  birth?: string;
  gender?: string;
  branches?: IBranch[];
  roles?: IRole[];
}

export interface AtedBy {
  id?: number;
  nik?: null;
  name?: string;
  email?: string;
}

export interface IUserDTO {
  nik: string;
  name: string;
  type: string;
  phone: string | number;
  birth: string;
  gender: string;
  email: string;
  password: string;
  branch_ids: number[];
  role_ids: number[];
}

export interface IUserBranchChange {
  branch_id: number
}