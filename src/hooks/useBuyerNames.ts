import { useQueries } from '@tanstack/react-query'
import { buyersService } from '@/services/buyers.service'

/**
 * Nama buyer per id dari GET /buyers/{id}. Satu request per buyer_id unik,
 * di-cache bersama (queryKey ['buyer', id]) sehingga list & detail PO tidak
 * mengulang request untuk buyer yang sama. Id tanpa nama → tidak ada di map,
 * pemanggil memakai fallback (nama company).
 */
export function useBuyerNames(ids: Array<number | null | undefined>): Record<number, string> {
  const uniqueIds = Array.from(new Set(ids.filter((v): v is number => !!v && v > 0)))

  const results = useQueries({
    queries: uniqueIds.map((id) => ({
      queryKey: ['buyer', id],
      queryFn: () => buyersService.findById(id).then((r) => r.data),
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
  })

  const names: Record<number, string> = {}
  results.forEach((res, i) => {
    const name = (res.data as any)?.data?.name
    if (name) names[uniqueIds[i]] = name
  })
  return names
}
