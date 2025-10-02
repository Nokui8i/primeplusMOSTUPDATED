'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, updateDoc, getDoc, query, collection, where, getDocs, setDoc } from 'firebase/firestore'
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
        // Pre-fill display name if available
        if (user.displayName) {
          setDisplayName(user.displayName)
        }
        // Generate initial username from email
        const emailUsername = user.email?.split('@')[0] || ''
        setUsername(emailUsername.toLowerCase().replace(/[^a-z0-9_]/g, ''))
        setIsChecking(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  // Debounced username check
  useEffect(() => {
    const checkUsername = async () => {
      if (username.length < 3) {
        setIsUsernameAvailable(false)
        return
      }

      try {
        // Check both users and usernames collections
        const [usersSnapshot, usernamesSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('username', '==', username.toLowerCase()))),
          getDoc(doc(db, 'usernames', username.toLowerCase()))
        ])

        setIsUsernameAvailable(usersSnapshot.empty && !usernamesSnapshot.exists())
      } catch (err) {
        console.error('Error checking username:', err)
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
    const newErrors: ValidationErrors = {}
    
    if (!displayName.trim()) {
      newErrors.displayName = 'Display name is required'
    }
    
    if (!username.trim()) {
      newErrors.username = 'Username is required'
    } else if (!/^[a-z0-9]+$/.test(username)) {
      newErrors.username = 'Username can only contain lowercase letters and numbers'
    }

    setError(newErrors.username || newErrors.displayName || null)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const user = auth.currentUser
      if (!user) {
        throw new Error('No user found')
      }

      const finalUsername = username.toLowerCase().trim()

      // Update user profile in Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
        username: finalUsername,
        profileCompleted: true,
        updatedAt: new Date(),
        createdAt: new Date(), // Add creation date if not exists
        role: 'user', // Default role
        stats: {
          posts: 0,
          followers: 0,
          following: 0,
          engagement: 0
        }
      })

      // Create username entry
      await setDoc(doc(db, 'usernames', finalUsername), {
        userId: user.uid,
        createdAt: new Date()
      })

      router.push(`/${finalUsername}`)
    } catch (err) {
      console.error('Error updating profile:', err)
      setError('Failed to update profile. Please try again.')
    } finally {
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
        <div className="mt-1">
          <input
            id="username"
            name="username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF4081] focus:border-transparent transition-all duration-200"
            placeholder="Choose a unique username"
          />
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
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