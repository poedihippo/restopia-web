export interface IPermissionList {
  data?: IPermissionListDatum[];
}

export interface IPermissionListDatum {
  group?: string;
  data?: IPermission[];
}

export interface IPermission {
  id?: number;
  name?: string;
}
