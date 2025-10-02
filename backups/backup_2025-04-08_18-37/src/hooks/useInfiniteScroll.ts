import { useEffect, useRef } from 'react'
import { useInView } from 'react-intersection-observer'

interface UseInfiniteScrollProps<T> {
  data: T[]
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => Promise<void>
}

export function useInfiniteScroll<T>({
  data,
  hasMore,
  isLoading,
  onLoadMore,
}: UseInfiniteScrollProps<T>) {
  const { ref, inView } = useInView()
  const shouldLoadMore = useRef(true)

  useEffect(() => {
    if (inView && hasMore && !isLoading && shouldLoadMore.current) {
      shouldLoadMore.current = false
      onLoadMore().finally(() => {
        shouldLoadMore.current = true
      })
    }
  }, [inView, hasMore, isLoading, onLoadMore])

  return {
    loadMoreRef: ref,
  }
} 