'use client';

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, orderBy, limit, startAfter, QueryDocumentSnapshot } from 'firebase/firestore'
import { FiLoader, FiSearch, FiUser } from 'react-icons/fi'
import Link from 'next/link'
import Image from 'next/image'

interface User {
  id: string
  username: string
  displayName: string
  photoURL?: string
  bio?: string
}

export default function UserSearch() {
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUser, setLastUser] = useState<QueryDocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = useState(true)

  // Debounced search effect
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setUsers([])
        setLastUser(null)
        setHasMore(true)
        return
      }

      setLoading(true)
      try {
        const usersRef = collection(db, 'users')
        const searchTerm = searchQuery.toLowerCase().trim()
        
        try {
          // Create two queries: one for username and one for displayName
          const usernameQuery = query(
            usersRef,
            where('username', '>=', searchTerm),
            where('username', '<=', searchTerm + '\uf8ff'),
            limit(10)
          )

          const displayNameQuery = query(
            usersRef,
            where('displayName', '>=', searchTerm),
            where('displayName', '<=', searchTerm + '\uf8ff'),
            limit(10)
          )

          console.log('Executing search queries for term:', searchTerm)
          
          // Execute both queries in parallel
          const [usernameSnapshot, displayNameSnapshot] = await Promise.all([
            getDocs(usernameQuery),
            getDocs(displayNameQuery)
          ])

          // Use a Map to prevent duplicate results
          const userMap = new Map()

          // Process username results
          usernameSnapshot.docs.forEach(doc => {
            const data = doc.data()
            userMap.set(doc.id, {
              id: doc.id,
              username: data.username || 'unknown',
              displayName: data.displayName || 'Unknown User',
              photoURL: data.photoURL || '',
              bio: data.bio || ''
            })
          })

          // Process displayName results and add any new ones
          displayNameSnapshot.docs.forEach(doc => {
            if (!userMap.has(doc.id)) {
              const data = doc.data()
              userMap.set(doc.id, {
                id: doc.id,
                username: data.username || 'unknown',
                displayName: data.displayName || 'Unknown User',
                photoURL: data.photoURL || '',
                bio: data.bio || ''
              })
            }
          })

          // Convert Map values to array
          const userResults = Array.from(userMap.values())

          if (userResults.length === 0) {
            console.log('No users found for search term:', searchTerm)
            setUsers([])
            setHasMore(false)
            return
          }

          console.log('Found users:', userResults)
          setUsers(userResults)
          // Store the last user from username results for pagination
          setLastUser(usernameSnapshot.docs[usernameSnapshot.docs.length - 1])
          setHasMore(userResults.length === 10)
        } catch (error) {
          console.error('Search error:', error)
          console.error('Full error object:', JSON.stringify(error, null, 2))
          setUsers([])
          setHasMore(false)
        }
      } catch (error) {
        console.error('Detailed search error:', error)
        if (error instanceof Error) {
          console.error('Error message:', error.message)
          console.error('Error stack:', error.stack)
        }
      } finally {
        setLoading(false)
      }
    }

    const timeoutId = setTimeout(() => {
      searchUsers()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const loadMore = async () => {
    if (!lastUser || !searchQuery.trim()) return

    setLoading(true)
    try {
      const usersRef = collection(db, 'users')
      const searchTerm = searchQuery.toLowerCase().trim()
      
      // Create two queries for pagination
      const usernameQuery = query(
        usersRef,
        where('username', '>=', searchTerm),
        where('username', '<=', searchTerm + '\uf8ff'),
        startAfter(lastUser),
        limit(10)
      )

      const displayNameQuery = query(
        usersRef,
        where('displayName', '>=', searchTerm),
        where('displayName', '<=', searchTerm + '\uf8ff'),
        startAfter(lastUser),
        limit(10)
      )

      // Execute both queries in parallel
      const [usernameSnapshot, displayNameSnapshot] = await Promise.all([
        getDocs(usernameQuery),
        getDocs(displayNameQuery)
      ])

      // Use a Map to prevent duplicate results
      const userMap = new Map()

      // Process username results
      usernameSnapshot.docs.forEach(doc => {
        const data = doc.data()
        userMap.set(doc.id, {
          id: doc.id,
          username: data.username || 'unknown',
          displayName: data.displayName || 'Unknown User',
          photoURL: data.photoURL || '',
          bio: data.bio || ''
        })
      })

      // Process displayName results and add any new ones
      displayNameSnapshot.docs.forEach(doc => {
        if (!userMap.has(doc.id)) {
          const data = doc.data()
          userMap.set(doc.id, {
            id: doc.id,
            username: data.username || 'unknown',
            displayName: data.displayName || 'Unknown User',
            photoURL: data.photoURL || '',
            bio: data.bio || ''
          })
        }
      })

      const newUsers = Array.from(userMap.values())

      if (newUsers.length === 0) {
        setHasMore(false)
        return
      }

      setUsers(prevUsers => [...prevUsers, ...newUsers])
      setLastUser(usernameSnapshot.docs[usernameSnapshot.docs.length - 1])
      setHasMore(newUsers.length === 10)
    } catch (error) {
      console.error('Error loading more users:', error)
      console.error('Full error object:', JSON.stringify(error, null, 2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FiSearch className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4081] focus:border-transparent transition-all duration-200"
          placeholder="Search by username or display name..."
        />
      </div>

      <div className="mt-4 space-y-4">
        {loading && users.length === 0 ? (
          <div className="flex justify-center py-8">
            <FiLoader className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : users.length > 0 ? (
          <>
            {users.map((user) => (
              <Link
                key={user.id}
                href={`/profile/${user.username}`}
                className="block p-4 border border-gray-200 rounded-xl hover:border-[#FF4081] transition-all duration-200"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {user.photoURL ? (
                      <Image
                        src={user.photoURL}
                        alt={user.displayName}
                        width={48}
                        height={48}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                        <FiUser className="w-6 h-6 text-gray-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.displayName}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      @{user.username}
                    </p>
                    {user.bio && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {user.bio}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full py-2 text-sm text-[#FF4081] hover:text-[#E91E63] transition-colors duration-200"
              >
                {loading ? 'Loading...' : 'Load more'}
              </button>
            )}
          </>
        ) : searchQuery.trim() ? (
          <div className="text-center py-8 text-gray-500">
            No users found matching "{searchQuery}"
          </div>
        ) : null}
      </div>
    </div>
  )
} 