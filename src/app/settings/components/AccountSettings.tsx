'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { doc, updateDoc, getDoc, runTransaction, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { UsernameEditField } from '@/components/settings/UsernameEditField';
import { getAuth } from 'firebase/auth';

export default function AccountSettings() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    bio: '',
    email: '',
  });
  const [usernameValid, setUsernameValid] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setFormData({
          displayName: data.displayName || '',
          username: data.username || '',
          bio: data.bio || '',
          email: data.email || user.email || '',
        });
      }
    };
    fetchProfile();
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUsernameChange = (username: string, isValid: boolean) => {
    setFormData(prev => ({ ...prev, username }));
    setUsernameValid(isValid);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser || !usernameValid) return;
    setIsLoading(true);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      const fullProfile = userSnap.data();
      if (!fullProfile) throw new Error('User profile not found');

      const oldUsername = profile?.username || '';
      const newUsername = formData.username.toLowerCase();

      console.log('Starting username change:', { oldUsername, newUsername });

      // Only proceed with username change if it's actually different
      if (oldUsername && newUsername && oldUsername !== newUsername) {
        // Step 1: Check if new username is available
        const usernameRef = doc(db, 'usernames', newUsername);
        const usernameDoc = await getDoc(usernameRef);
        console.log('Checking username availability:', { 
          newUsername, 
          exists: usernameDoc.exists(),
          data: usernameDoc.data()
        });

        if (usernameDoc.exists()) {
          throw new Error('Username is no longer available. Please try another.');
        }

        try {
          // Step 2: Create new username document
          console.log('Creating new username document:', newUsername);
          await setDoc(usernameRef, {
            userId: currentUser.uid,
            createdAt: new Date()
          });
          console.log('New username document created successfully');

          // Step 3: Update user profile
          console.log('Updating user profile');
          const updatedProfile = {
            ...fullProfile,
            ...formData,
            username: newUsername,
            updatedAt: new Date()
          };
          await updateDoc(userRef, updatedProfile);
          console.log('User profile updated successfully');

          // Step 4: Delete old username document
          const oldUsernameRef = doc(db, 'usernames', oldUsername.toLowerCase());
          console.log('Deleting old username document:', oldUsername);
          await deleteDoc(oldUsernameRef);
          console.log('Old username document deleted successfully');

          toast.success('Profile updated successfully');
        } catch (error) {
          console.error('Error during username change:', error);
          // If anything fails, try to clean up the new username document
          try {
            console.log('Attempting to clean up new username document');
            await deleteDoc(usernameRef);
            console.log('Cleanup successful');
          } catch (cleanupError) {
            console.error('Failed to clean up username document:', cleanupError);
          }
          throw error;
        }
      } else {
        // No username change, just update profile
        console.log('No username change, updating profile only');
        const updatedProfile = {
          ...fullProfile,
          ...formData,
          updatedAt: new Date()
        };
        await updateDoc(userRef, updatedProfile);
        toast.success('Profile updated successfully');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (!profile) {
    return <div className="py-8 text-center text-gray-400">Loading profile...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Profile Information</h2>
        
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.photoURL || undefined} />
            <AvatarFallback>{profile.displayName?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <Button variant="outline" size="sm">
            Change Photo
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleInputChange}
              placeholder="Your display name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <UsernameEditField
              currentUsername={profile.username || ''}
              onUsernameChange={handleUsernameChange}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              placeholder="Tell us about yourself"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="your@email.com"
              disabled
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading || !usernameValid}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  );
} 