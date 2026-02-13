import { Meta } from "./global";

export interface IPermissionList {
  data?: IPermission[];
  meta?: Meta;
}

export interface IPermission {
  id?: number;
  name?: string;
}
