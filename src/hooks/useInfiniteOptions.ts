import { useMemo } from 'react'
import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query'

/**
 * Paged dropdown source: fetches page 1, then the next page each time the
 * select's list is scrolled to the bottom (spread `selectProps` onto
 * SearchableSelect / MultiSearchableSelect / ui SearchableSelect).
 *
 * `fetchPage(page)` must return the response body (`r.data`) of a paginated
 * list call; both `{ data: { data: [], meta } }` and `{ data: [], meta }`
 * envelopes are accepted.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- option rows are loosely typed API records
export function useInfiniteOptions<T = any>({
  queryKey,
  fetchPage,
  enabled = true,
  staleTime,
}: {
  queryKey: QueryKey
  fetchPage: (page: number) => Promise<unknown>
  enabled?: boolean
  staleTime?: number
}) {
  const query = useInfiniteQuery({
    queryKey: [...queryKey, 'infinite'],
    enabled,
    staleTime,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchPage(pageParam as number),
    // Track the page number ourselves (meta.current_page isn't reliable); stop at the
    // page count from meta, or — when meta gives none — at the first short/empty page.
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      const current = Number(lastPageParam)
      const meta = pageMeta(lastPage)
      const perPage = Number(meta?.per_page ?? 0)
      const total = Number(meta?.total ?? 0)
      const pages = Number(meta?.total_pages ?? meta?.last_page ?? (perPage > 0 && total > 0 ? Math.ceil(total / perPage) : 0))
      if (pages > 0) return current < pages ? current + 1 : undefined
      const count = pageItems(lastPage).length
      const firstCount = pageItems(allPages[0]).length
      return count > 0 && count >= firstCount ? current + 1 : undefined
    },
    placeholderData: (prev) => prev,
  })

  // Stable across renders (only changes when pages change) so callers can use it in deps.
  const pages = query.data?.pages
  const items = useMemo(() => {
    const seen = new Set<unknown>()
    const rows: T[] = []
    for (const page of pages ?? []) {
      for (const item of pageItems(page) as T[]) {
        const id = (item as { id?: unknown } | null)?.id
        if (id != null) {
          if (seen.has(id)) continue
          seen.add(id)
        }
        rows.push(item)
      }
    }
    return rows
  }, [pages])

  return {
    ...query,
    items,
    /** First page / new search in flight — not a next-page fetch, so the list stays visible while paging. */
    loading: query.isFetching && !query.isFetchingNextPage,
    selectProps: {
      hasMore: !!query.hasNextPage,
      loadingMore: query.isFetchingNextPage,
      onLoadMore: () => {
        if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage()
      },
    },
  }
}

type Envelope = { data?: unknown; meta?: PageMeta }
type PageMeta = { current_page?: number; per_page?: number; total?: number; total_pages?: number; last_page?: number }

function pageItems(page: unknown): unknown[] {
  const data = (page as Envelope | undefined)?.data
  if (Array.isArray(data)) return data
  const inner = (data as Envelope | undefined)?.data
  return Array.isArray(inner) ? inner : []
}

function pageMeta(page: unknown): PageMeta | undefined {
  const env = page as Envelope | undefined
  return Array.isArray(env?.data) ? env?.meta : (env?.data as Envelope | undefined)?.meta ?? env?.meta
}
