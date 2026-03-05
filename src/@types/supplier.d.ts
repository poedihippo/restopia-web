import { Meta } from "./global";

export interface ISupplierList {
    data?: ISupplier[];
    meta?: Meta;
}

export interface ISupplier {
    id: number;
    code?: string;
    name?: string;
    created_at?: Date;
    updated_at?: Date;
}

export interface ISupplierDTO {
    code: string;
    name: string;
}