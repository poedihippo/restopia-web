import { Meta } from "./global";

export interface ICompaniesList {
  data: ICompanies[];
  meta: Meta;
}

export interface ICompanies {
  id: number;
  name: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface ICompaniesDTO {
  name: string;
}
