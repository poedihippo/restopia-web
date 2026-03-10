import { Meta } from "./global";

export interface ICustomerList {
    data?: ICustomer[];
    meta?: Meta;
}

export interface ICustomer {
    id: number;
    name?: string;
    phone?: string;
    created_at?: Date;
    created_by_id?: number;
    updated_at?: Date;
    updated_by_id?: number;
    created_by?: AtedBy;
    updated_by?: AtedBy;
}

export interface AtedBy {
    id?: number;
    nik?: null;
    name?: string;
    email?: string;
}

export interface ICustomerDTO {
    name: string;
    phone: string
}