import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { NextPageContext } from 'next'

function Error({ statusCode }: { statusCode?: number }) {
    const message = statusCode
        ? `Error ${statusCode} - Terjadi kesalahan pada server`
        : "Terjadi kesalahan yang tidak terduga";

    return (
        <div className='w-full bg-white flex min-h-screen items-center justify-center'>
            <Image alt="error" src={'/error.webp'} height={500} width={500} />
            <div>
                <h1 className='text-7xl text-center font-bold'>{statusCode}</h1>
                <p className='text-3xl text-center'>{message}</p>
                <Link href={'/dashboard'} className='flex flex-col items-center my-2'>
                    <Button variant={'default'} className='text-xl font-semibold cursor-pointer'>Go Back</Button>
                </Link>
            </div>
        </div>
    )
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
    const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
    return { statusCode };
};

export default Error;