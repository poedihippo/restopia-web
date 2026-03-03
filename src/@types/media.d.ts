export interface IMediaList {
    data?: IMedia[];
    meta?: Meta;
}

export interface IMedia {
    id: number;
    uuid?: string;
    media_type?: string;
    media_id?: number;
    collection_name?: string;
    file_name?: string;
    disk?: string;
    path?: string;
    size?: number;
    mime_type?: string;
    status?: string;
    url?: string;
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

export interface IMediaDTO {
    media_type: string
    media_id: string | number
    collection_name: string
    files: File[]
}