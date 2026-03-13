export interface IListParams {
  page?: number;
  per_page?: number;
  include?: string;
  sort?: string;
  [key: string]: string | number | boolean | undefined | Record<string, string | number | boolean | undefined>;
}

export interface IDetailParams {
  include?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface ISuccessResponseMessage {
  message: string;
}

export interface Meta {
  current_page?: number;
  from?: number;
  per_page?: number;
  to?: number;
  total?: number;
  total_pages?: number;
}
