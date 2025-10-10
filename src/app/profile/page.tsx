'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/lib/types/user';
import AppLoader from '@/components/common/AppLoader';

export default function ProfileRedirect() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    async function redirectToProfile() {
      if (!user) return;

      try {
        // Get the user's profile data
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data() as User;

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

  // Show loading screen while redirecting
  return <AppLoader isVisible />;
} 