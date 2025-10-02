'use client';

import { useState } from 'react'
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, sendEmailVerification, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { db } from '@/lib/firebase'
import { doc, setDoc, updateDoc, getDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiInfo, FiEye, FiEyeOff, FiLoader } from 'react-icons/fi'

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
      // First check if a user with this email exists
      const usersRef = collection(db, 'users')
      const q = query(usersRef, where('email', '==', email))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        setError('No account found with this email. Please register first.')
        setLoading(false)
        return
      }

      const { user } = await signInWithEmailAndPassword(auth, email, password)
      
      // Get the latest emailVerified status from auth
      await user.reload()
      
      // Set up auth state listener for email verification
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          // Reload the user to get the latest emailVerified status
          await currentUser.reload()
          
          if (currentUser.emailVerified) {
            try {
              // Update emailVerified status and lastLogin in Firestore
              await updateDoc(doc(db, 'users', currentUser.uid), {
                emailVerified: true,
                lastLogin: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              })
              console.log('Email verification status updated in Firestore')
              
              // Get user profile
              const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
              const userData = userDoc.data()

              // Check if profile is completed
              if (!userData?.profileCompleted) {
                router.push('/complete-profile')
              } else {
                router.push('/home')
              }
            } catch (error) {
              console.error('Error updating email verification status:', error)
            }
            unsubscribe()
          }
        }
      })

      if (!user.emailVerified) {
        setError('Please verify your email before logging in.')
        // Resend verification email if needed
        await sendEmailVerification(user, {
          url: `${window.location.origin}/verify-email`,
          handleCodeInApp: true
        })
        setVerificationSent(true)
        return
      }
      
      // Get user profile
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      const userData = userDoc.data()

      // Update last login and verification status
      await updateDoc(doc(db, 'users', user.uid), {
        lastLogin: new Date().toISOString(),
        emailVerified: user.emailVerified,
        updatedAt: new Date().toISOString()
      })

      // Check if profile is completed
      if (!userData?.profileCompleted) {
        router.push('/complete-profile')
      } else {
        router.push('/home')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      if (err.code === 'auth/wrong-password') {
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
      const baseUsername = email.split('@')[0]
        .replace(/[^a-zA-Z0-9]/g, '') // Remove special characters but keep uppercase letters
      
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
        url: `${window.location.origin}/verify-email`,
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
      const user = result.user
      
      // Get user profile
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      
      // Check if user exists
      if (!userDoc.exists()) {
        await auth.signOut() // Sign out the user since they don't have an account
        setError('No account found with this email. Please register first.')
        setLoading(false)
        return
      }
      
      const userData = userDoc.data()
      
      // Update last login
      await setDoc(doc(db, 'users', user.uid), {
        lastLogin: new Date().toISOString(),
        emailVerified: true
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
            emailVerified: true, // Google accounts are pre-verified
            profileCompleted: false,
            metadata: {
              lastSignInTime: user.metadata.lastSignInTime,
              creationTime: user.metadata.creationTime
            }
          })
          
          console.log('User document created successfully')
          router.push('/complete-profile')
        } else {
          // Update email verification status for existing users
          await updateDoc(doc(db, 'users', user.uid), {
            emailVerified: true,
            lastLogin: now
          })
          
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
        setVerificationSent(true)
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
    <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div className="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10">
        <h2 className="text-2xl font-bold text-center text-gray-800">
          {isRegistering ? 'Create your account' : 'Welcome back'}
        </h2>

        {verificationSent && (
          <div className="bg-blue-50 text-blue-600 p-4 rounded-lg flex items-start">
            <svg 
              className="h-5 w-5 mt-0.5 mr-2 flex-shrink-0 text-blue-500" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
            <div>
              <p className="font-medium">Almost there!</p>
              <p className="text-sm mt-1">
                We've sent a verification link to your email. Please verify your account to continue.
              </p>
            </div>
          </div>
        )}

        {error && !verificationSent && (
          <div className="bg-red-50 text-red-500 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={isRegistering ? handleEmailRegister : handleEmailLogin} className="space-y-6">
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
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
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
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm pr-10"
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
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm pr-10"
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
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-[#FF4081] to-[#E91E63] hover:from-[#FF80AB] hover:to-[#FF4081] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E91E63] transition-all duration-200"
          >
            {loading ? <FiLoader className="w-5 h-5 animate-spin" /> : isRegistering ? 'Create Account' : 'Sign In'}
          </button>
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
              onClick={isRegistering ? handleGoogleRegister : handleGoogleLogin}
              disabled={loading}
              className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E91E63] transition-all duration-200"
            >
              <img className="h-5 w-5 mr-2" src="/google.svg" alt="Google logo" />
              {isRegistering ? 'Sign up with Google' : 'Sign in with Google'}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-center text-sm">
            <button onClick={toggleForm} className="font-medium text-primary-600 hover:text-primary-500">
              {isRegistering ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          </div>
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
    </div>
  )
} 