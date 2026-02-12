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
  branch?: Branch;
}

export interface Branch {
  id?: number;
  company_id?: number;
  code?: string;
  name?: string;
  company?: Company;
}

export interface Company {
  id?: number;
  name?: string;
  created_at?: Date;
  updated_at?: Date;
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
