import { useState, useEffect } from 'react'
import { FiSearch, FiUser, FiX } from 'react-icons/fi'
import { db } from '@/lib/firebase'
import { collection, query, getDocs } from 'firebase/firestore'
import Link from 'next/link'
import Image from 'next/image'
import { useDebounce } from '@/hooks/useDebounce'

interface SearchResult {
  id: string
  username: string
  displayName: string
  photoURL?: string
  role: 'user' | 'creator' | 'admin'
  matchScore: number
}

export function Search() {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debouncedSearch = useDebounce(searchQuery, 300)

  useEffect(() => {
    const searchUsers = async () => {
      if (!debouncedSearch.trim()) {
        setResults([])
        return
      }

      setLoading(true)
      try {
        const usersRef = collection(db, 'users')
        const snapshot = await getDocs(usersRef)
        const searchTerms = debouncedSearch.toLowerCase().split(' ').filter(term => term.length > 0)
        
        const searchResults: SearchResult[] = []
        
        snapshot.docs.forEach(doc => {
          const data = doc.data()
          const username = data.username?.toLowerCase() || ''
          const displayName = data.displayName?.toLowerCase() || ''
          
          // Calculate match score based on how well the terms match
          let matchScore = 0
          
          searchTerms.forEach(term => {
            // Exact matches get highest score
            if (username === term || displayName === term) {
              matchScore += 100
            }
            // Starts with term gets high score
            else if (username.startsWith(term) || displayName.startsWith(term)) {
              matchScore += 50
            }
            // Contains term gets medium score
            else if (username.includes(term) || displayName.includes(term)) {
              matchScore += 25
            }
            // Individual words in display name match gets lower score
            else if (displayName.split(' ').some((word: string) => word.includes(term))) {
              matchScore += 10
            }
          })

          // Only include results that match at least one term
          if (matchScore > 0) {
            searchResults.push({
              id: doc.id,
              username: data.username,
              displayName: data.displayName,
              photoURL: data.photoURL,
              role: data.role,
              matchScore
            })
          }
        })

        // Sort by match score and limit to top 10 results
        const sortedResults = searchResults
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 10)

        setResults(sortedResults)
      } catch (error) {
        console.error('Search error:', error)
        setResults([])
      } finally {
        setLoading(false)
      }
    }

    searchUsers()
  }, [debouncedSearch])

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text

    const terms = query.toLowerCase().split(' ')
    let highlightedText = text

    terms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi')
      highlightedText = highlightedText.replace(regex, '<mark class="bg-pink-100 rounded-sm px-0.5">$1</mark>')
    })

    return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          type="text"
          placeholder="Search by name or username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
          className="input w-full pr-4"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('')
              setResults([])
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <FiX className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && (searchQuery || loading) && (
        <div className="absolute mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              {results.map((result) => (
                <Link
                  key={result.id}
                  href={`/${result.username}`}
                  className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    setShowResults(false)
                    setSearchQuery('')
                  }}
                >
                  <div className="flex-shrink-0">
                    {result.photoURL ? (
                      <Image
                        src={result.photoURL}
                        alt={result.displayName}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <FiUser className="w-5 h-5 text-gray-500" />
                      </div>
                    )}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">
                      {highlightMatch(result.displayName, searchQuery)}
                    </p>
                    <p className="text-sm text-gray-500">
                      @{highlightMatch(result.username, searchQuery)}
                    </p>
                  </div>
                  {result.role === 'creator' && (
                    <span className="ml-auto px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-full">
                      Creator
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ) : searchQuery ? (
            <div className="p-4 text-center text-gray-500">
              No results found
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
} 