'use client';

import { useState } from 'react'
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { db } from '@/lib/firebase'
import { doc, setDoc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiInfo, FiEye, FiEyeOff } from 'react-icons/fi'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationSent, setVerificationSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const router = useRouter()

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password)
      
      if (!user.emailVerified) {
        setError('Please verify your email before logging in.')
        // Resend verification email if needed
        await sendEmailVerification(user, {
          url: `${window.location.origin}/complete-profile`,
          handleCodeInApp: true
        })
        setVerificationSent(true)
        return
      }
      
      // Get user profile
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      const userData = userDoc.data()
      
      // Update last login
      await updateDoc(doc(db, 'users', user.uid), {
        lastLogin: new Date().toISOString()
      })

      // Check if profile is completed
      if (!userData?.profileCompleted) {
        router.push('/complete-profile')
      } else {
        router.push('/home')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email.')
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password.')
      } else {
        setError('Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setLoading(true)

    try {
      // Generate a base username from email
      const baseUsername = email.split('@')[0].toLowerCase()
        .replace(/[^a-z0-9]/g, '') // Remove special characters
      
      // Check if username exists
      const usernameQuery = query(
        collection(db, 'users'), 
        where('username', '==', baseUsername)
      )
      const usernameSnapshot = await getDocs(usernameQuery)
      
      // If username exists, add a random number
      let finalUsername = baseUsername
      if (!usernameSnapshot.empty) {
        finalUsername = `${baseUsername}${Math.floor(Math.random() * 10000)}`
      }

      // Create the user
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      
      // Send email verification
      await sendEmailVerification(user, {
        url: `${window.location.origin}/complete-profile`,
        handleCodeInApp: true
      })
      
      const now = new Date().toISOString()
      
      // Create user document with username
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        username: finalUsername,  // Store the unique username
        displayName: finalUsername, // Use as initial display name
        createdAt: now,
        lastLogin: now,
        role: 'user',
        isActive: true,
        emailVerified: false,
        authProvider: 'email',
        profileCompleted: false,
        metadata: {
          lastSignInTime: user.metadata.lastSignInTime,
          creationTime: user.metadata.creationTime
        }
      })

      // Create a username document for quick lookups
      await setDoc(doc(db, 'usernames', finalUsername), {
        uid: user.uid,
        createdAt: now
      })

      setVerificationSent(true)
      setError('')
      // Show verification message instead of redirecting
      setError('Please check your email to verify your account before continuing.')
    } catch (err: any) {
      console.error('Registration error:', err)
      if (err.code === 'auth/email-already-in-use') {
        setError('An account already exists with this email.')
      } else {
        setError(`Registration failed: ${err.message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)

    try {
      const provider = new GoogleAuthProvider()
      // Force account selection for consistency
      provider.setCustomParameters({
        prompt: 'select_account'
      })
      
      const result = await signInWithPopup(auth, provider)
      
      // Get user profile
      const userDoc = await getDoc(doc(db, 'users', result.user.uid))
      const userData = userDoc.data()
      
      // Update last login
      await setDoc(doc(db, 'users', result.user.uid), {
        lastLogin: new Date().toISOString()
      }, { merge: true })

      // Check if profile is completed
      if (!userData?.profileCompleted) {
        router.push('/complete-profile')
      } else {
        router.push('/home')
      }
    } catch (err) {
      setError('Failed to sign in with Google.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleRegister = async () => {
    setError('')
    setLoading(true)

    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({
        prompt: 'select_account'
      })
      
      console.log('Starting Google sign-in popup...')
      const result = await signInWithPopup(auth, provider)
      console.log('Google sign-in successful', result.user.email)
      
      try {
        const user = result.user
        const now = new Date().toISOString()
        
        // First check if user document exists
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        
        if (!userDoc.exists()) {
          // Create initial user document
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            createdAt: now,
            lastLogin: now,
            role: 'user',
            isActive: true,
            authProvider: 'google',
            profileCompleted: false,
            metadata: {
              lastSignInTime: user.metadata.lastSignInTime,
              creationTime: user.metadata.creationTime
            }
          })
          
          console.log('User document created successfully')
          router.push('/complete-profile')
        } else {
          // User exists, check if profile is completed
          const userData = userDoc.data()
          if (!userData.profileCompleted) {
            router.push('/complete-profile')
          } else {
            router.push('/home')
          }
        }
      } catch (firestoreErr) {
        console.error('Firestore error:', firestoreErr)
        setError('Failed to create user profile. Please try again.')
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err)
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-up cancelled. Please try again.')
      } else if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked. Please allow popups for this site.')
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError('An account already exists with this email.')
      } else {
        setError(`Registration failed: ${err.message || 'Please try again.'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleForm = () => {
    setIsRegistering(!isRegistering)
    setError('')
  }

  const validateForm = () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return false
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return false
    }

    return true
  }

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-center text-gray-800">
        {isRegistering ? 'Create your account' : 'Welcome back'}
      </h2>

      {verificationSent && (
        <div className="bg-blue-50 text-blue-600 p-4 rounded-lg flex items-start">
          <FiInfo className="h-5 w-5 mt-0.5 mr-2 flex-shrink-0" />
          <div>
            <p className="font-medium">Verification email sent!</p>
            <p className="text-sm mt-1">
              Please check your email to verify your account. You can close this window.
            </p>
          </div>
        </div>
      )}

      {error && !verificationSent && (
        <div className="bg-red-50 text-red-500 p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <form onSubmit={isRegistering ? handleEmailRegister : handleEmailLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <div className="mt-1 relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm pr-10"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <FiEyeOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <FiEye className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {isRegistering && (
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <div className="mt-1 relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <FiEyeOff className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <FiEye className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
              Remember me
            </label>
          </div>

          <div className="text-sm">
            <Link
              href="/forgot-password"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
        >
          {loading ? 'Please wait...' : isRegistering ? 'Create Account' : 'Sign In'}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={isRegistering ? handleGoogleRegister : handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#EA4335"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#4285F4"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {isRegistering ? 'Sign up with Google' : 'Sign in with Google'}
        </button>
      </form>

      <div className="text-center">
        <button onClick={toggleForm} className="text-sm text-primary-600 hover:text-primary-500">
          {isRegistering ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
        </button>
      </div>

      <div className="mt-6 text-center text-xs text-gray-500">
        By {isRegistering ? 'creating an account' : 'logging in'} you agree to our{' '}
        <Link href="/terms" className="text-[#00AFF0] hover:underline">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-[#00AFF0] hover:underline">
          Privacy Policy
        </Link>
      </div>
    </div>
  )
} 