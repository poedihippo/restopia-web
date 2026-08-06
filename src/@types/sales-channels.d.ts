export interface ISalesChannel {
  id: number;
  code: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface ISalesChannelDTO {
  code: string;
  name: string;
}
