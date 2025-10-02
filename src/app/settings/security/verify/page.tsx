'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuth, updatePassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, arrayUnion, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInMinutes } from 'date-fns';

export default function VerifyPasswordChange() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyPasswordChange = async () => {
      try {
        const uid = searchParams?.get('uid');
        const token = searchParams?.get('token');
        if (!uid || !token) {
          throw new Error('Invalid verification link');
        }

        // Get the pending password change from Firestore using UID from query
        const userDoc = await getDoc(doc(db, 'users', uid));
        const userData = userDoc.data();
        const pendingChange = userData?.security?.pendingPasswordChange;

        if (!pendingChange || !pendingChange.password || !pendingChange.timestamp || !pendingChange.token) {
          throw new Error('No pending password change found or link is invalid.');
        }

        // Check if the request is within 10 minutes
        const now = new Date();
        const requestedAt = new Date(pendingChange.timestamp);
        if (differenceInMinutes(now, requestedAt) > 10) {
          throw new Error('This password change link has expired. Please request a new password change.');
        }

        // Check if the token matches
        if (pendingChange.token !== token) {
          throw new Error('Invalid or expired confirmation token.');
        }

        // Authenticate the user (prompt for login if not already authenticated)
        const auth = getAuth();
        let currentUser = auth.currentUser;
        if (!currentUser || currentUser.uid !== uid) {
          // Prompt for login (email required)
          const email = userData.email;
          if (!email) throw new Error('User email not found. Please log in first.');
          // Optionally, you could show a login form here
          // For now, throw an error
          throw new Error('Please log in to confirm your password change.');
        }

        // Update password
        await updatePassword(currentUser, pendingChange.password);

        // Clear pending password and update history
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          await updateDoc(userRef, {
            'security.pendingPasswordChange': null,
            'security.passwordHistory': arrayUnion(pendingChange.password),
            'security.lastPasswordChange': new Date().toISOString(),
          });
        } else {
          await setDoc(userRef, {
            'security.pendingPasswordChange': null,
            'security.passwordHistory': arrayUnion(pendingChange.password),
            'security.lastPasswordChange': new Date().toISOString(),
          });
        }

        toast.success('Password changed successfully');
        router.push('/login');
      } catch (error: any) {
        console.error('Error verifying password change:', error);
        setError(error.message || 'Failed to verify password change');
      } finally {
        setIsLoading(false);
      }
    };

    verifyPasswordChange();
  }, [router, searchParams]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-lg">Verifying password change...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-red-500 mb-4">{error}</div>
        <Button onClick={() => router.push('/settings/security')}>
          Return to Security Settings
        </Button>
      </div>
    );
  }

  return null;
} 