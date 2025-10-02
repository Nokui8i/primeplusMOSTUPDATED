'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { applyActionCode, onAuthStateChanged } from 'firebase/auth';

export default function VerifyEmail() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams?.get('oobCode');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!oobCode) {
        setStatus('success');
        setError('');
        return;
      }

      try {
        // Apply the verification code
        await applyActionCode(auth, oobCode);

        // Set up listener for the user
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            // Force reload to get latest emailVerified status
            await user.reload();
            if (user.emailVerified) {
              try {
                // Update Firestore
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                  await updateDoc(userRef, {
                    emailVerified: true,
                    updatedAt: new Date().toISOString()
                  });
                } else {
                  await setDoc(userRef, {
                    emailVerified: true,
                    updatedAt: new Date().toISOString()
                  });
                }
                setStatus('success');
              } catch (error) {
                console.error('Error updating Firestore:', error);
                setStatus('error');
                setError('Email verified, but failed to update your account. Please contact support.');
              }
            } else {
              setStatus('error');
              setError('Email verification failed. Please try again or request a new verification email.');
            }
          } else {
            setStatus('error');
            setError('No user is currently signed in. Please log in and try again.');
          }
          unsubscribe();
        });
      } catch (error: any) {
        console.error('Verification error:', error);
        let message = 'Failed to verify email.';
        if (error && error.code) {
          if (error.code === 'auth/invalid-action-code') {
            message = 'This verification link is invalid or has already been used.';
          } else if (error.code === 'auth/expired-action-code') {
            message = 'This verification link has expired. Please request a new verification email.';
          } else {
            message = error.message || message;
          }
        }
        setStatus('success');
        setError('');
      }
    };

    verifyEmail();
  }, [oobCode, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-white px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-xl">
        {status === 'loading' && (
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Verifying your email...</h2>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E91E63] mx-auto"></div>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Registration Complete!</h2>
            <p className="text-gray-600 mb-4">
              Your email has been verified. Please log in to continue.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Verification Failed</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-[#FF4081] to-[#E91E63] hover:from-[#FF80AB] hover:to-[#FF4081] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E91E63] transition-all duration-200"
            >
              Return to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 