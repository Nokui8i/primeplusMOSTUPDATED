'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { sendPasswordResetEmail } from 'firebase/auth'
import { FiLoader, FiAlertCircle, FiCheckCircle, FiInfo } from 'react-icons/fi'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import Link from 'next/link'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isGoogleUser, setIsGoogleUser] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setIsGoogleUser(false)

    try {
      // First, check if the email exists in our users collection
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email.toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError('No account found with this email address. Please check the email or create a new account.')
        setLoading(false)
        return
      }

      const userData = querySnapshot.docs[0].data();
      if (userData.authProvider === 'google') {
        setIsGoogleUser(true)
        setLoading(false)
        return
      }

      // If not a Google user, proceed with password reset
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/`,
        handleCodeInApp: true,
      })
      setSuccess(true)
    } catch (err: any) {
      console.error('Password reset error:', err)
      if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.')
      } else {
        setError('Failed to send reset email. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (isGoogleUser) {
    return (
      <div className="text-center">
        <FiInfo className="mx-auto h-12 w-12 text-blue-500" />
        <h2 className="mt-4 text-lg font-medium text-gray-900">Google Account Detected</h2>
        <p className="mt-2 text-sm text-gray-600">
          This email is associated with a Google account. To change your password:
        </p>
        <ol className="mt-4 text-sm text-gray-600 text-left list-decimal list-inside space-y-2">
          <li>Go to your Google Account settings</li>
          <li>Look for Security settings</li>
          <li>Update your Google Account password there</li>
        </ol>
        <p className="mt-4 text-sm text-gray-600">
          Then use the "Sign in with Google" button to log in to PrimePlus+
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="text-sm font-medium text-primary-600 hover:text-primary-500"
          >
            Return to home
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="text-center">
        <FiCheckCircle className="mx-auto h-12 w-12 text-green-500" />
        <h2 className="mt-4 text-lg font-medium text-gray-900">Check your email</h2>
        <p className="mt-2 text-sm text-gray-600">
          We've sent password reset instructions to {email}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          If you don't see the email, please check your spam folder.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="text-sm font-medium text-primary-600 hover:text-primary-500"
          >
            Return to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <form className="space-y-6" onSubmit={handleSubmit}>
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
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Enter your email"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <FiAlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <FiLoader className="w-5 h-5 animate-spin mr-2" />
                  Checking...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </div>

          <div className="text-sm text-center">
            <Link
              href="/"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              Back to home
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
} 