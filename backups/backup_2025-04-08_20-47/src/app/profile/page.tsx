'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileRedirect() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    async function redirectToProfile() {
      if (!user) return;

      try {
        // Get the user's profile data
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();

        if (userData?.username) {
          // Redirect to the user's profile page using their username
          router.push(`/${userData.username}`);
        } else {
          // If no username is set, redirect to complete profile
          router.push('/complete-profile');
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    }

    redirectToProfile();
  }, [user, router]);

  // Show loading state while redirecting
  return (
    <div className="flex-1 p-8">
      <div className="space-y-8">
        <Skeleton className="h-48 w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <Skeleton className="h-96 w-full rounded-lg" />
          </div>
          <div>
            <Skeleton className="h-96 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
} 