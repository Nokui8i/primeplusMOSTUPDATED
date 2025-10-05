import { useEffect, useRef, useCallback } from 'react'
import { useInView } from 'react-intersection-observer'

interface UseInfiniteScrollProps<T> {
  data: T[]
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => Promise<void>
  threshold?: number
  rootMargin?: string
  error?: Error | null
  retryCount?: number
}

export function useInfiniteScroll<T>({
  data,
  hasMore,
  isLoading,
  onLoadMore,
  threshold = 0.5,
  rootMargin = '100px',
  error = null,
  retryCount = 3
}: UseInfiniteScrollProps<T>) {
  const { ref, inView } = useInView({
    threshold,
    rootMargin
  })
  const shouldLoadMore = useRef(true)
  const retryAttempts = useRef(0)
  const lastLoadTime = useRef(0)
  const onLoadMoreRef = useRef(onLoadMore)
  const MIN_LOAD_INTERVAL = 1000 // Minimum time between loads in milliseconds

  // Keep the ref updated with the latest onLoadMore
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore
  }, [onLoadMore])

  const loadMoreRef = useRef<() => Promise<void>>()

  const loadMore = useCallback(async () => {
    if (!shouldLoadMore.current || isLoading) return

    const now = Date.now()
    if (now - lastLoadTime.current < MIN_LOAD_INTERVAL) {
      return
    }

    shouldLoadMore.current = false
    lastLoadTime.current = now

    try {
      await onLoadMoreRef.current()
      retryAttempts.current = 0 // Reset retry attempts on successful load
    } catch (err) {
      console.error('Error loading more data:', err)
      if (retryAttempts.current < retryCount) {
        retryAttempts.current++
        shouldLoadMore.current = true
        setTimeout(() => {
          loadMoreRef.current?.()
        }, 1000 * retryAttempts.current) // Exponential backoff
      }
    } finally {
      shouldLoadMore.current = true
    }
  }, [isLoading, retryCount])

  // Keep the ref updated with the latest loadMore
  useEffect(() => {
    loadMoreRef.current = loadMore
  }, [loadMore])

  useEffect(() => {
    if (inView && hasMore && !isLoading && shouldLoadMore.current) {
      loadMoreRef.current?.()
    }
  }, [inView, hasMore, isLoading])

  // Reset retry attempts when data changes
  useEffect(() => {
    retryAttempts.current = 0
  }, [data])

  return {
    loadMoreRef: ref,
    loadMore,
    isLoading,
    error,
    retryCount: retryAttempts.current
  }
} 