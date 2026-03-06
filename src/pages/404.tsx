import { Button } from '@/components/ui/button'
import Image from 'next/image'
import Link from 'next/link'

export default function NotFound() {
    return (
        <div className='w-full bg-white flex min-h-screen items-center justify-center'>
            <Image alt="404" src={'/404.webp'} height={500} width={500} />
            <div>
                <h1 className='text-7xl text-center font-bold'>404</h1>
                <p className='text-3xl text-center'>Looks like page is still cooking!</p>
                <Link href={'/dashboard'} className='flex flex-col items-center my-2'>
                    <Button variant={'default'} className='text-xl font-semibold cursor-pointer'>Go Back</Button>
                </Link>
            </div>
        </div>
    )
}

