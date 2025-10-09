'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { UserProfile } from '@/lib/types/user';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/firebase/auth';
import { ProfilePageClient } from '@/components/profile/ProfilePageClient';

// Create a client component wrapper
function ProfilePageContent({ profile, isOwnProfile }: { profile: UserProfile; isOwnProfile: boolean }) {
  return <ProfilePageClient profile={profile} isOwnProfile={isOwnProfile} />;
}

// Main page component (server component)
export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!params?.username) return;

      try {
        console.log('Fetching profile for username:', params.username);
        
        // First try to find by username
        const usernameQuery = query(
          collection(db, 'users'),
          where('username', '==', params.username)
        );
        let userDoc = await getDocs(usernameQuery);
        
        // If not found by username, try by userId
        if (userDoc.empty) {
          const userIdQuery = query(
            collection(db, 'users'),
            where('id', '==', params.username)
          );
          userDoc = await getDocs(userIdQuery);
        }

        // If still not found, try direct document access using the params.username as UID
        if (userDoc.empty) {
          console.log('Trying direct document access with:', params.username);
          const directDoc = await getDoc(doc(db, 'users', params.username));
          if (directDoc.exists()) {
            const userData = directDoc.data();
            const profileData: UserProfile = {
              id: directDoc.id,
              uid: directDoc.id,
              username: userData.username || '',
              email: userData.email || '',
              displayName: userData.displayName || userData.username || '',
              photoURL: userData.photoURL || userData.profilePhotoUrl || null,
              coverPhotoUrl: userData.coverPhotoUrl || null,
              role: userData.role,
              isVerified: userData.isVerified || false,
              isAgeVerified: userData.isAgeVerified || false,
              status: userData.status || 'active',
              bio: userData.bio,
              location: userData.location,
              website: userData.website,
              socialLinks: userData.socialLinks,
              stats: userData.stats,
              createdAt: userData.createdAt,
              updatedAt: userData.updatedAt,
              defaultSubscriptionPlanId: userData.defaultSubscriptionPlanId || null,
              defaultSubscriptionType: userData.defaultSubscriptionType || null,
            };
            setProfile(profileData);
            setLoading(false);
            return;
          }
        }

        if (!userDoc.empty) {
          const userData = userDoc.docs[0].data();
          const docId = userDoc.docs[0].id;
          const profileData: UserProfile = {
            id: docId,
            uid: docId,
            username: userData.username || '',
            email: userData.email || '',
            displayName: userData.displayName || userData.username || '',
            photoURL: userData.photoURL || userData.profilePhotoUrl || null,
            coverPhotoUrl: userData.coverPhotoUrl || null,
            role: userData.role,
            isVerified: userData.isVerified || false,
            isAgeVerified: userData.isAgeVerified || false,
            status: userData.status || 'active',
            bio: userData.bio,
            location: userData.location,
            website: userData.website,
            socialLinks: userData.socialLinks,
            stats: userData.stats,
            createdAt: userData.createdAt,
            updatedAt: userData.updatedAt,
            defaultSubscriptionPlanId: userData.defaultSubscriptionPlanId || null,
            defaultSubscriptionType: userData.defaultSubscriptionType || null,
          };
          setProfile(profileData);
          setLoading(false);
          return;
        } else {
          console.log('No user document found');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [params?.username, user?.uid]);

  if (loading) {
    return (
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="space-y-4 sm:space-y-8">
          <Skeleton className="h-[200px] sm:h-[312px] w-full rounded-lg" />
          <div className="space-y-3 sm:space-y-4">
            <Skeleton className="h-24 sm:h-32 w-24 sm:w-32 rounded-full" />
            <Skeleton className="h-6 sm:h-8 w-32 sm:w-48" />
            <Skeleton className="h-3 sm:h-4 w-48 sm:w-64" />
          </div>
          <div className="space-y-3 sm:space-y-4">
            <Skeleton className="h-32 sm:h-48 w-full rounded-lg" />
            <Skeleton className="h-32 sm:h-48 w-full rounded-lg" />
            <Skeleton className="h-32 sm:h-48 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Profile not found</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-2">The user you're looking for doesn't exist.</p>
      </div>
    );
  }

  const isOwnProfile = user?.uid === profile.id;

  return <ProfilePageContent profile={profile} isOwnProfile={isOwnProfile} />;
} 