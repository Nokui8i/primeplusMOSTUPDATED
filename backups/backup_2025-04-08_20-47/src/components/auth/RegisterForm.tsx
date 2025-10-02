'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendEmailVerification, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore'
import Link from 'next/link'
import { FiLoader } from 'react-icons/fi'

export default function RegisterForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const router = useRouter()

  // Handle Email/Password Registration
  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      // Check if email already exists
      const usersRef = collection(db, 'users')
      const q = query(usersRef, where('email', '==', email))
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
        setError('An account with this email already exists.')
        setLoading(false)
        return
      }

      // Create user with email and password
      const { user } = await createUserWithEmailAndPassword(auth, email, password)

      // Generate username from email
      const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
      let username = baseUsername
      let counter = 1

      // Check username availability
      while (true) {
        const usernameDoc = await getDoc(doc(db, 'usernames', username))
        if (!usernameDoc.exists()) break
        username = `${baseUsername}${counter}`
        counter++
      }

      // Create user document
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        username,
        displayName: '',
        authProvider: 'email',
        role: 'user',
        isActive: true,
        emailVerified: false,
        profileCompleted: false,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        metadata: {
          creationTime: user.metadata.creationTime,
          lastSignInTime: user.metadata.lastSignInTime
        },
        stats: {
          posts: 0,
          followers: 0,
          following: 0,
          engagement: 0
        }
      })

      // Reserve username
      await setDoc(doc(db, 'usernames', username), {
        uid: user.uid
      })

      // Set up auth state listener for email verification
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          // Reload the user to get the latest emailVerified status
          await currentUser.reload()
          
          if (currentUser.emailVerified) {
            // Update emailVerified status in Firestore
            try {
              await updateDoc(doc(db, 'users', currentUser.uid), {
                emailVerified: true,
                updatedAt: new Date().toISOString()
              })
              console.log('Email verification status updated in Firestore')
            } catch (error) {
              console.error('Error updating email verification status:', error)
            }
            unsubscribe()
          }
        }
      })

      // Send verification email
      await sendEmailVerification(user, {
        url: `${window.location.origin}/verify-email`,
        handleCodeInApp: true
      })

      setVerificationSent(true)
    } catch (err: any) {
      console.error('Registration error:', err)
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.')
      } else {
        setError('Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Handle Google Registration
  const handleGoogleRegister = async () => {
    setError('')
    setLoading(true)

    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({
        prompt: 'select_account'
      })

      const result = await signInWithPopup(auth, provider)
      const user = result.user

      // Check if user already exists
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      
      if (userDoc.exists()) {
        await auth.signOut()
        setError('This Google account is already registered. Please sign in instead.')
        setLoading(false)
        return
      }

      // Create new user document
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        emailVerified: true, // Google accounts are pre-verified
        authProvider: 'google',
        createdAt: new Date(),
        lastLogin: new Date(),
        profileCompleted: false
      })

      // Redirect to complete profile
      router.push('/complete-profile')
    } catch (error: any) {
      console.error('Google registration error:', error)
      setError('Failed to register with Google. Please try again.')
      setLoading(false)
    }
  }

  if (verificationSent) {
    return (
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900">Verify your email</h2>
            <p className="mt-2 text-sm text-gray-600">
              We've sent a verification link to {email}. Please check your email and verify your account.
            </p>
            <p className="mt-4 text-sm text-gray-600">
              After verification, you can{' '}
              <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
                sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div className="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10">
        <form onSubmit={handleEmailRegister} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <div className="mt-1">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <div className="mt-1">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600" role="alert">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-[#FF4081] to-[#E91E63] hover:from-[#FF80AB] hover:to-[#FF4081] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E91E63] transition-all duration-200"
            >
              {loading ? <FiLoader className="w-5 h-5 animate-spin" /> : 'Create Account'}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleGoogleRegister}
              disabled={loading}
              className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E91E63] transition-all duration-200"
            >
              <img className="h-5 w-5 mr-2" src="/google.svg" alt="Google logo" />
              Sign up with Google
            </button>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-center text-sm">
            <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
              Already have an account? Sign in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
} 