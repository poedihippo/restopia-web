import { Meta } from "./global";

export interface IUOMList {
  data: IUOM[];
  meta?: Meta;
}

export interface IUOM {
  id: number;
  code?: string;
  name?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface IUOMDTO {
  code: string;
  name: string;
}
