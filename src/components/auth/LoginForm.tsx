'use client';

import { useState, useEffect } from 'react'
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, sendEmailVerification, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { db } from '@/lib/firebase'
import { doc, setDoc, updateDoc, getDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiInfo, FiEye, FiEyeOff, FiLoader } from 'react-icons/fi'
import AppLoader from '../common/AppLoader'
import { User as FirebaseUser } from 'firebase/auth'
import ForgotPasswordModal from './ForgotPasswordModal'
import { CSSTransition } from 'react-transition-group'
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import '@/styles/modern-auth.css'

// Helper to ensure user profile exists
async function ensureUserProfile(user: FirebaseUser) {
  const userDocRef = doc(db, 'users', user.uid);
  const userDocSnap = await getDoc(userDocRef);
  if (!userDocSnap.exists()) {
    await setDoc(userDocRef, {
      email: user.email,
      username: user.displayName?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user' + user.uid.slice(0, 6),
      displayName: user.displayName || '',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      isActive: true,
      emailVerified: user.emailVerified,
      authProvider: user.providerData[0]?.providerId || 'email',
      profileCompleted: false,
    }, { merge: true });
  }
}

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [formMode, setFormMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationSent, setVerificationSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)
  const router = useRouter()

  // Simulate auth/session check on mount (replace with real check if needed)
  useEffect(() => {
    // Here you would check Firebase auth state or session
    // For now, simulate a short delay
    const timer = setTimeout(() => setPageLoading(false), 600)
    return () => clearTimeout(timer)
  }, [])

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
      
      // Ensure user profile exists (fixes insufficient permissions)
      await ensureUserProfile(user)
      
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
              const userRef = doc(db, 'users', currentUser.uid);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                await updateDoc(userRef, {
                  emailVerified: true,
                  lastLogin: serverTimestamp(),
                  updatedAt: serverTimestamp()
                });
              }
              console.log('Email verification status updated in Firestore')
              
              // Get user profile
              const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
              const userData = userDoc.data()

              // Check if profile is completed
              if (!userData?.profileCompleted) {
                setRedirecting(true)
                router.push('/complete-profile')
              } else {
                setRedirecting(true)
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
      const userRef2 = doc(db, 'users', user.uid);
      const userSnap2 = await getDoc(userRef2);
      if (userSnap2.exists()) {
        await updateDoc(userRef2, {
          lastLogin: serverTimestamp(),
          emailVerified: user.emailVerified,
          updatedAt: serverTimestamp()
        });
      }

      // Check if profile is completed
      if (!userData?.profileCompleted) {
        setRedirecting(true)
        router.push('/complete-profile')
      } else {
        setRedirecting(true)
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

      setVerificationSent(true)
      setError('Registration complete! Please check your email to verify your account before logging in.')
      // Do not auto-login or redirect. Show a button to go back to login.
      setFormMode('login')
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
      await updateDoc(doc(db, 'users', user.uid), {
        lastLogin: serverTimestamp(),
        emailVerified: true
      })

      // Check if profile is completed
      if (!userData?.profileCompleted) {
        setRedirecting(true)
        router.push('/complete-profile')
      } else {
        setRedirecting(true)
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
        // Always redirect Google signups to /complete-profile
        setRedirecting(true)
        router.push('/complete-profile')
      } catch (firestoreErr) {
        console.error('Firestore error:', firestoreErr)
        setError('Failed to process Google sign up. Please try again.')
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      });
      setError('A password reset email has been sent.');
    } catch (error: any) {
      setError(error.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  const toggleForm = () => {
    setFormMode('register')
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
    <div className="onlyfans-layout">
      {(pageLoading || redirecting) && <AppLoader isVisible />}
      
        {/* Left Side - Blue Background with Logo */}
        <div className="onlyfans-left">
          {/* Background Logo */}
          <div className="onlyfans-background-logo">
            <img 
              src="/images/LOGO only.png" 
              alt="PrimePlus+" 
              className="onlyfans-bg-logo-image"
            />
          </div>
          
          {/* Main Content with Full Logo */}
          <div className="onlyfans-main-content">
            <div className="onlyfans-logo-container">
              <img 
                src="/images/ChatGPT Image Sep 26, 2025, 04_01_20 PM.png" 
                alt="PrimePlus+" 
                className="onlyfans-logo-image"
              />
            </div>
          </div>
        </div>

       {/* Right Side - White Background with Form */}
       <div className="onlyfans-right">
         <div className="form-container">
           {/* Desktop Logo */}
           <div className="desktop-logo">
             <img 
               src="/images/ChatGPT Image Sep 26, 2025, 04_01_20 PM.png" 
               alt="PrimePlus+" 
               className="desktop-logo-image"
             />
           </div>
           
           {/* Mobile Logo */}
           <div className="mobile-logo">
             <img 
               src="/images/ChatGPT Image Sep 26, 2025, 04_01_20 PM.png" 
               alt="PrimePlus+" 
               className="mobile-logo-image"
             />
           </div>
          <p className="title">
            {formMode === 'register' ? 'Create account' : formMode === 'forgot' ? 'Reset Password' : 'Log in'}
          </p>
          <p className="sub-title">
            {formMode === 'register' ? "Sign up to support your favorite creators" : formMode === 'forgot' ? "Enter your email to reset your password" : "Welcome back! Please sign in to your account"}
          </p>

          {verificationSent && (
            <div className="success-message">
              <FiInfo className="inline h-4 w-4 mr-2" />
              Almost there! We've sent a verification link to your email. Please verify your account to continue.
            </div>
          )}

          {error && !verificationSent && (
            <div className="error-message">
              {error}
            </div>
          )}

          {formMode === 'login' && (
            <form className="form" onSubmit={handleEmailLogin}>
              <input
                type="email"
                className="input"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
              />
              
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>

              <div className="forgot-password-link">
                <button
                  type="button"
                  onClick={() => setFormMode('forgot')}
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                className="form-btn"
                disabled={loading}
              >
                {loading ? (
                  <span className="loading-spinner"></span>
                ) : (
                  'LOG IN'
                )}
              </button>

              <div className="divider">
                <span>Or continue with</span>
              </div>

              <div className="buttons-container">
                <div className="google-login-button" onClick={handleGoogleLogin}>
                  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" className="google-icon" viewBox="0 0 48 48" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12
	c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24
	c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
                    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657
	C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
                    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36
	c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
                    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571
	c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
                  </svg>
                  <span>Sign in with Google</span>
                </div>
              </div>

              <p className="sign-up-label">
                Need an account? <span className="sign-up-link" onClick={toggleForm}>Sign up</span>
              </p>

              <p className="terms-text">
                By logging in and using PrimePlus+, you agree to our{' '}
                <a href="#" className="text-[#00bcd4]">Terms of Service</a> and{' '}
                <a href="#" className="text-[#00bcd4]">Privacy Policy</a>, and confirm that you are at least 18 years old.
              </p>
            </form>
          )}

          {formMode === 'register' && (
            <form className="form" onSubmit={handleEmailRegister}>
              <input
                type="email"
                className="input"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
              />
              
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="input"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>

              <button
                type="submit"
                className="form-btn"
                disabled={loading}
              >
                {loading ? (
                  <span className="loading-spinner"></span>
                ) : (
                  'Create account'
                )}
              </button>

              <div className="divider">
                <span>Or continue with</span>
              </div>

              <div className="buttons-container">
                <div className="google-login-button" onClick={handleGoogleRegister}>
                  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" className="google-icon" viewBox="0 0 48 48" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12
	c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24
	c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
                    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657
	C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
                    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36
	c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
                    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571
	c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
                  </svg>
                  <span>Sign up with Google</span>
                </div>
              </div>

              <p className="sign-up-label">
                Already have an account? <span className="sign-up-link" onClick={() => setFormMode('login')}>Log in</span>
              </p>

              <p className="terms-text">
                By creating an account, you agree to our{' '}
                <a href="#" className="text-[#00bcd4]">Terms of Service</a> and{' '}
                <a href="#" className="text-[#00bcd4]">Privacy Policy</a>, and confirm that you are at least 18 years old.
              </p>
            </form>
          )}

          {formMode === 'forgot' && (
            <form className="form" onSubmit={handleForgotPassword}>
              <input
                type="email"
                className="input"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              
              <button
                type="submit"
                className="form-btn"
                disabled={loading || !email}
              >
                {loading ? (
                  <span className="loading-spinner"></span>
                ) : (
                  'Send Reset Email'
                )}
              </button>

              <p className="sign-up-label">
                Remember your password? <span className="sign-up-link" onClick={() => setFormMode('login')}>Back to Login</span>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
} 