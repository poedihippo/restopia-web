import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

export default function ServerError() {
    return (
        <div className='w-full bg-white flex min-h-screen items-center justify-center'>
            <Image alt="500" src={'/500.webp'} height={500} width={500} />
            <div>
                <h1 className='text-7xl text-center font-bold'>500</h1>
                <p className='text-3xl text-center'>Sorry, unexpected error</p>
                <p className='text-xl text-gray-500 text-center'>Please contact team</p>
                <Link href={'/dashboard'} className='flex flex-col items-center my-2'>
                    <Button variant={'default'} className='text-xl font-semibold cursor-pointer'>Go Back</Button>
                </Link>
            </div>
        </div>
    )
}