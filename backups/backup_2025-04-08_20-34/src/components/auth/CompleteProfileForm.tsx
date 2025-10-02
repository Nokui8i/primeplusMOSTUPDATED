'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, updateDoc, getDoc, query, collection, where, getDocs, setDoc, deleteDoc, runTransaction } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { FiLoader } from 'react-icons/fi'

interface ValidationErrors {
  username?: string
  displayName?: string
}

export default function CompleteProfileForm() {
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/')
      } else {
        try {
          // Check if user already has a profile
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          if (userDoc.exists() && userDoc.data().profileCompleted) {
            router.push('/home')
            return
          }

          // Pre-fill display name if available
          if (user.displayName) {
            setDisplayName(user.displayName)
          }
          // Generate initial username from email
          const emailUsername = user.email?.split('@')[0] || ''
          setUsername(emailUsername.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
          setIsChecking(false)
        } catch (err) {
          console.error('Error checking user profile:', err)
          setError('Failed to load user data. Please refresh the page.')
        }
      }
    })

    return () => unsubscribe()
  }, [router])

  // Debounced username check
  useEffect(() => {
    const checkUsername = async () => {
      if (!username || username.length < 3) {
        setIsUsernameAvailable(false)
        setError(username.length > 0 ? 'Username must be at least 3 characters' : null)
        return
      }

      if (!/^[a-zA-Z0-9]+$/.test(username)) {
        setIsUsernameAvailable(false)
        setError('Username can only contain letters and numbers')
        return
      }

      try {
        // Check both collections in parallel
        const [usersSnapshot, usernameDoc] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('username', '==', username))),
          getDoc(doc(db, 'usernames', username))
        ])
        
        if (!usersSnapshot.empty || usernameDoc.exists()) {
          setIsUsernameAvailable(false)
          setError('This username is already taken')
          return
        }

        setIsUsernameAvailable(true)
        setError(null)
      } catch (err) {
        console.error('Error checking username:', err)
        setError('Error checking username availability')
        setIsUsernameAvailable(false)
      }
    }

    const timeoutId = setTimeout(() => {
      if (username) {
        checkUsername()
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [username])

  const validateForm = () => {
    if (!displayName.trim()) {
      setError('Display name is required')
      return false
    }
    
    if (!username.trim()) {
      setError('Username is required')
      return false
    }
    
    if (username.length < 3) {
      setError('Username must be at least 3 characters')
      return false
    }
    
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      setError('Username can only contain letters and numbers')
      return false
    }

    if (!isUsernameAvailable) {
      setError('This username is already taken')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const user = auth.currentUser
      if (!user) {
        throw new Error('No user found')
      }

      const finalUsername = username.toLowerCase().trim()

      // Use a transaction to ensure atomic updates
      await runTransaction(db, async (transaction) => {
        // Check username availability again inside transaction
        const usernameDoc = await transaction.get(doc(db, 'usernames', finalUsername))
        if (usernameDoc.exists()) {
          throw new Error('Username was just taken. Please try another.')
        }

        // Get current user data
        const userDoc = await transaction.get(doc(db, 'users', user.uid))
        const userData = userDoc.data() || {}

        // Update user profile
        transaction.update(doc(db, 'users', user.uid), {
          displayName: displayName.trim(),
          username: finalUsername,
          profileCompleted: true,
          updatedAt: new Date(),
          createdAt: userData.createdAt || new Date(),
          role: userData.role || 'user',
          stats: userData.stats || {
            posts: 0,
            followers: 0,
            following: 0,
            engagement: 0
          }
        })

        // Create username entry
        transaction.set(doc(db, 'usernames', finalUsername), {
          userId: user.uid,
          createdAt: new Date()
        })
      })

      // Redirect to home page after successful profile completion
      router.push('/home')
    } catch (err) {
      console.error('Error updating profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to update profile. Please try again.')
      setLoading(false)
    }
  }

  if (isChecking) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <FiLoader className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
          Display Name
        </label>
        <div className="mt-1">
          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4081] focus:border-transparent transition-all duration-200"
            placeholder="How should we call you?"
          />
        </div>
      </div>

      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-700">
          Username
        </label>
        <div className="mt-1 relative">
          <input
            id="username"
            name="username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={`appearance-none block w-full px-4 py-3 border rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 ${
              username.length >= 3
                ? isUsernameAvailable
                  ? 'border-green-500 focus:ring-green-500'
                  : 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-[#FF4081]'
            }`}
            placeholder="Choose a unique username"
          />
          {username.length >= 3 && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {isUsernameAvailable ? (
                <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
          )}
        </div>
        {error && (
          <p className={`mt-2 text-sm ${error.includes('taken') ? 'text-red-600' : 'text-gray-500'}`} role="alert">
            {error}
          </p>
        )}
      </div>

      <div>
        <button
          type="submit"
          disabled={loading}
          className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-[#FF4081] to-[#E91E63] hover:from-[#FF80AB] hover:to-[#FF4081] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FF4081] transition-all duration-200 ${
            loading ? 'opacity-75 cursor-not-allowed' : ''
          }`}
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Setting up your profile...
            </>
          ) : (
            'Complete Profile'
          )}
        </button>
      </div>
    </form>
  )
} 