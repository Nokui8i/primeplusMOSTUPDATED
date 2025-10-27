"use client";

import { useState, useEffect } from 'react';
import { FiSearch, FiUser, FiX } from 'react-icons/fi';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchResult {
  id: string;
  username: string;
  displayName: string;
  photoURL?: string;
  role: 'user' | 'creator' | 'admin';
  matchScore: number;
}

export function SearchDropdown() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    const searchUsers = async () => {
      if (!debouncedSearch.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        const searchTerms = debouncedSearch.toLowerCase().split(' ').filter(term => term.length > 0);
        
        const searchResults: SearchResult[] = [];
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const username = data.username?.toLowerCase() || '';
          const displayName = data.displayName?.toLowerCase() || '';
          
          // Calculate match score based on how well the terms match
          let matchScore = 0;
          
          searchTerms.forEach(term => {
            // Exact matches get highest score
            if (username === term || displayName === term) {
              matchScore += 100;
            }
            // Starts with term gets high score
            else if (username.startsWith(term) || displayName.startsWith(term)) {
              matchScore += 50;
            }
            // Contains term gets medium score
            else if (username.includes(term) || displayName.includes(term)) {
              matchScore += 25;
            }
            // Individual words in display name match gets lower score
            else if (displayName.split(' ').some((word: string) => word.includes(term))) {
              matchScore += 10;
            }
          });

          // Only include results that match at least one term
          if (matchScore > 0) {
            searchResults.push({
              id: doc.id,
              username: data.username,
              displayName: data.displayName,
              photoURL: data.photoURL,
              role: data.role,
              matchScore
            });
          }
        });

        // Sort by match score and limit to top 10 results
        const sortedResults = searchResults
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 10);

        setResults(sortedResults);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    searchUsers();
  }, [debouncedSearch]);

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const terms = query.toLowerCase().split(' ');
    let highlightedText = text;

    terms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark class="bg-pink-100 rounded-sm px-0.5">$1</mark>');
    });

    return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
  };

  const handleResultClick = () => {
    setIsExpanded(false);
    setSearchQuery('');
    setResults([]);
  };

  const handleBlur = () => {
    // Close search when clicking outside
    setTimeout(() => {
      if (!searchQuery) {
        setIsExpanded(false);
      }
    }, 200);
  };

  return (
    <>
      <style jsx>{`
        .search-container-header {
          position: relative;
          --size-button: 36px;
          color: white;
          display: flex;
          justify-content: flex-end;
        }
        
        .search-input-header {
          padding-right: var(--size-button);
          padding-left: 10px;
          height: var(--size-button);
          font-size: 16px;
          border: 2px solid transparent;
          color: #000;
          outline: none;
          width: var(--size-button);
          transition: width ease 0.3s;
          background-color: transparent;
          border-radius: 10px;
          cursor: pointer;
          margin-left: auto;
        }
        
        .search-input-header:focus,
        .search-input-header:not(:invalid) {
          width: 250px;
          cursor: text;
          border: 2px solid #4A9DEC;
          box-shadow: 0px 0px 0px 7px rgba(74, 157, 236, 0.2);
          background-color: white;
        }
        
        .search-input-header:focus + .search-icon-header,
        .search-input-header:not(:invalid) + .search-icon-header {
          pointer-events: all;
          cursor: pointer;
        }
        
        .search-icon-header {
          position: absolute;
          width: var(--size-button);
          height: var(--size-button);
          top: 0;
          right: 0;
          padding: 6px;
          pointer-events: none;
          z-index: 10;
        }
        
        .search-icon-header svg {
          width: 100%;
          height: 100%;
        }
        
        .search-close-header {
          position: absolute;
          right: 40px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 20;
        }
      `}</style>

      <div className="search-container-header" style={{ position: 'relative' }}>
        <input
          type="text"
          name="search"
          className="search-input-header"
          required
          placeholder="Search by name or username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsExpanded(true)}
          onBlur={handleBlur}
          autoComplete="off"
        />
        <div className="search-icon-header">
          <FiSearch className="w-full h-full text-gray-500" />
        </div>
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setResults([]);
            }}
            className="search-close-header text-gray-400 hover:text-gray-600"
          >
            <FiX className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {(searchQuery && results.length > 0 || loading || (searchQuery && !loading)) && (
        <div 
          className="absolute top-full right-0 mt-2 z-50 overflow-y-auto max-h-[400px] rounded-2xl border"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            border: '1px solid rgba(255, 255, 255, 0.8)',
            boxShadow: `
              0 20px 60px rgba(0, 0, 0, 0.12),
              0 8px 25px rgba(0, 0, 0, 0.08),
              0 0 0 1px rgba(255, 255, 255, 0.5) inset,
              0 2px 4px rgba(0, 0, 0, 0.04) inset
            `,
            backdropFilter: 'blur(10px)',
            transform: 'translateY(-2px)',
            transition: 'all 0.3s ease',
            width: '280px'
          }}
        >
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : results.length > 0 ? (
            <div>
              {results.map((result) => (
                <Link
                  key={result.id}
                  href={`/${result.username}`}
                  className="flex items-center px-4 py-3 transition-all duration-200 relative"
                  style={{
                    background: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 100%)';
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                  onClick={handleResultClick}
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
                  <div className="ml-3 flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {highlightMatch(result.displayName, searchQuery)}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      @{highlightMatch(result.username, searchQuery)}
                    </p>
                  </div>
                  {result.role === 'creator' && (
                    <span className="ml-2 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-full flex-shrink-0">
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
    </>
  );
}
