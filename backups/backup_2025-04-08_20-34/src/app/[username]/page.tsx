'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/lib/types/user';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileContent } from '@/components/profile/ProfileContent';
import { ProfileSidebar } from '@/components/profile/ProfileSidebar';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProfilePage() {
  const { username } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      if (!username) return;

      try {
        // Try to find user by username in users collection first
        const usersRef = collection(db, 'users');
        const usersQuery = query(usersRef, where('username', '==', username));
        const usersSnapshot = await getDocs(usersQuery);

        let userId;
        
        if (!usersSnapshot.empty) {
          // Found user directly in users collection
          userId = usersSnapshot.docs[0].id;
        } else {
          // Try to find user in usernames collection as fallback
          const usernameDoc = await getDoc(doc(db, 'usernames', username as string));
          
          if (!usernameDoc.exists()) {
            // Handle user not found
            setLoading(false);
            return;
          }
          
          userId = usernameDoc.data().userId;
        }

        // Get the user's profile data
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (!userDoc.exists()) {
          setLoading(false);
          return;
        }

        const profileData = {
          id: userDoc.id,
          ...userDoc.data()
        } as UserProfile;

        setProfile(profileData);
        setIsOwnProfile(user?.uid === userId);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [username, user]);

  if (loading) {
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

  if (!profile) {
    return (
      <div className="flex-1 p-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900">Profile Not Found</h2>
          <p className="text-gray-500 mt-2">The user you're looking for doesn't exist.</p>
          <p className="text-gray-500 mt-2">
            {user ? "If this is your profile, please complete your profile setup." : "Please sign in to create your profile."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8">
      <div className="space-y-8">
        <ProfileHeader profile={profile} isOwnProfile={isOwnProfile} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <ProfileContent profile={profile} />
          </div>
          <div>
            <ProfileSidebar profile={profile} isOwnProfile={isOwnProfile} />
          </div>
        </div>
      </div>
    </div>
  );
} 