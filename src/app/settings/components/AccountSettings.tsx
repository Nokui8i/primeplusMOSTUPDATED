'use client';

import { useState, useEffect, useRef } from 'react';
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
import { uploadToS3 } from '@/lib/aws/s3';
import { PhotoEditor } from '@/components/settings/PhotoEditor';
import { SocialLinksManager, SocialLink } from '@/components/settings/SocialLinksManager';

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
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [usernameValid, setUsernameValid] = useState(true);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || hasLoadedProfile) return;
    const fetchProfile = async () => {
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        console.log('📥 Loading profile data:', data);
        console.log('🔗 Social links from Firestore:', data.socialLinks);
        setProfile(data);
        setFormData({
          displayName: data.displayName || '',
          username: data.username || '',
          bio: data.bio || '',
          email: data.email || user.email || '',
        });
        setSocialLinks(data.socialLinks || []);
        setHasLoadedProfile(true);
      }
    };
    fetchProfile();
  }, [user, hasLoadedProfile]);

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

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const validateAndProcessFile = (file: File) => {
    if (!user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    // Create URL for the selected image to show in editor
    const imageUrl = URL.createObjectURL(file);
    setSelectedImageUrl(imageUrl);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndProcessFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    validateAndProcessFile(file);
  };

  const handleSaveCroppedPhoto = async (croppedImageBlob: Blob) => {
    if (!user) return;

    setUploadingPhoto(true);
    try {
      // Delete old profile photo if exists
      const currentPhotoUrl = profile?.photoURL;
      if (currentPhotoUrl) {
        try {
          if (currentPhotoUrl.includes('firebasestorage.googleapis.com')) {
            // Delete from Firebase Storage
            const { ref, deleteObject } = await import('firebase/storage');
            const { storage } = await import('@/lib/firebase/config');
            const url = new URL(currentPhotoUrl);
            const path = decodeURIComponent(url.pathname.split('/o/')[1]);
            const storageRef = ref(storage, path);
            await deleteObject(storageRef);
          } else if (currentPhotoUrl.includes('cloudfront.net')) {
            // Delete from AWS S3
            const { deleteFromS3, extractS3KeyFromUrl } = await import('@/lib/aws/s3');
            const s3Key = extractS3KeyFromUrl(currentPhotoUrl);
            if (s3Key) {
              await deleteFromS3(s3Key);
            }
          }
          console.log('✅ Old profile photo deleted successfully');
        } catch (deleteError) {
          console.error('Error deleting old profile photo:', deleteError);
          // Continue with upload even if deletion fails
        }
      }

      // Convert blob to file
      const file = new File([croppedImageBlob], `profile-photo-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });

      // Upload to S3
      const photoURL = await uploadToS3(file, `profile-photos/${user.uid}/${Date.now()}-profile.jpg`);
      
      // Update user profile in Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        photoURL,
        updatedAt: new Date()
      });

      // Update local state
      setProfile((prev: any) => ({ ...prev, photoURL }));
      
      // Close editor
      setSelectedImageUrl(null);
      
      toast.success('Profile photo updated successfully!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCancelPhotoEdit = () => {
    setSelectedImageUrl(null);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
          console.log('🔗 Social links to save:', socialLinks);
          const updatedProfile = {
            ...fullProfile,
            ...formData,
            username: newUsername,
            socialLinks,
            updatedAt: new Date()
          };
          console.log('📝 Updated profile object:', updatedProfile);
          await updateDoc(userRef, updatedProfile);
          console.log('✅ User profile updated successfully');
          
          // Update local profile state
          const newProfile = { ...profile, ...updatedProfile };
          setProfile(newProfile);

          // Step 4: Delete old username document
          const oldUsernameRef = doc(db, 'usernames', oldUsername.toLowerCase());
          console.log('Deleting old username document:', oldUsername);
          await deleteDoc(oldUsernameRef);
          console.log('Old username document deleted successfully');

          // Force reload the page to show updated data
          setTimeout(() => {
            window.location.reload();
          }, 1000);

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
        console.log('🔗 Social links to save:', socialLinks);
        const updatedProfile = {
          ...fullProfile,
          ...formData,
          socialLinks,
          updatedAt: new Date()
        };
        console.log('📝 Updated profile object:', updatedProfile);
        await updateDoc(userRef, updatedProfile);
        console.log('✅ Profile saved to Firestore');
        
        // Update local profile state
        const newProfile = { ...profile, ...updatedProfile };
        setProfile(newProfile);
        
        // Force reload the page to show updated data
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        
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
    <>
      {selectedImageUrl && (
        <PhotoEditor
          imageUrl={selectedImageUrl}
          onSave={handleSaveCroppedPhoto}
          onCancel={handleCancelPhotoEdit}
        />
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Profile Information</h2>
        
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.photoURL || undefined} />
            <AvatarFallback>{profile.displayName?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={handlePhotoClick}
              disabled={uploadingPhoto}
              style={{
                border: 'none',
                color: '#fff',
                backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
                backgroundColor: 'transparent',
                borderRadius: '20px',
                backgroundSize: '100% auto',
                fontFamily: 'inherit',
                fontSize: '11px',
                padding: '0.3em 0.6em',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
                outline: 'none',
                transition: 'all 0.3s ease-in-out',
                opacity: uploadingPhoto ? 0.5 : 1
              }}
            >
              {uploadingPhoto ? (
                <>
                  <Loader2 className="inline mr-2 h-3 w-3 animate-spin" />
                  <span>UPLOADING...</span>
                </>
              ) : (
                <span>CHANGE PHOTO</span>
              )}
            </button>
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-400 transition-colors cursor-pointer"
              onClick={handlePhotoClick}
            >
              <p className="text-xs text-gray-500">
                or drag & drop image here
              </p>
            </div>
          </div>
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
              style={{
                background: 'rgba(255, 255, 255, 0.6)',
                border: '1px solid rgba(200, 200, 200, 0.3)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.8)',
                borderRadius: '10px',
                height: '28px',
                fontSize: '11px',
                padding: '6px 10px'
              }}
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
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="bio">Bio</Label>
              {isEditingBio && (
                <button
                  type="button"
                  onClick={() => setIsEditingBio(false)}
                  style={{
                    border: 'none',
                    color: '#fff',
                    backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
                    backgroundColor: 'transparent',
                    borderRadius: '20px',
                    backgroundSize: '100% auto',
                    fontFamily: 'inherit',
                    fontSize: '10px',
                    padding: '0.3em 0.6em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.3s ease-in-out',
                  }}
                >
                  <span>DONE</span>
                </button>
              )}
            </div>
            
            {isEditingBio ? (
              <div 
                className="w-full p-3 rounded-md bg-gray-50 border border-gray-200 min-h-[60px] cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setIsEditingBio(false)}
              >
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {formData.bio || 'Click to add your bio...'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  placeholder="Tell us about yourself (max 2000 characters)"
                  rows={8}
                  maxLength={2000}
                  className="settings-bio-field border rounded p-3 w-full text-gray-900"
                  style={{
                    minHeight: '150px',
                    height: 'auto',
                    maxHeight: 'none',
                    resize: 'vertical'
                  }}
                />
                <div className="text-xs text-right text-gray-500">
                  {formData.bio?.length || 0}/2000
                </div>
              </div>
            )}
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
              className="disabled:opacity-100"
              style={{
                background: 'rgba(255, 255, 255, 0.6)',
                border: '1px solid rgba(200, 200, 200, 0.3)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.8)',
                borderRadius: '10px',
                height: '28px',
                fontSize: '11px',
                padding: '6px 10px',
                color: '#000',
                opacity: 1
              }}
            />
          </div>
        </div>
      </div>

      {/* Social Links Section */}
      <div className="mt-6">
        <SocialLinksManager
          links={socialLinks}
          onChange={setSocialLinks}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading || !usernameValid}
          style={{
            border: 'none',
            color: '#fff',
            backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
            backgroundColor: 'transparent',
            borderRadius: '20px',
            backgroundSize: '100% auto',
            fontFamily: 'inherit',
            fontSize: '13px',
            padding: '0.4em 0.8em',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: isLoading || !usernameValid ? 'not-allowed' : 'pointer',
            outline: 'none',
            transition: 'all 0.3s ease-in-out',
            boxShadow: 'none',
            margin: '0',
            width: 'auto',
            height: 'auto',
            minWidth: 'auto',
            minHeight: 'auto',
            maxWidth: 'none',
            maxHeight: 'none',
            lineHeight: '1',
            overflow: 'visible',
            flexShrink: '0',
            textDecoration: 'none',
            fontWeight: 'normal',
            textTransform: 'none',
            letterSpacing: 'normal',
            whiteSpace: 'nowrap',
            verticalAlign: 'middle',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            appearance: 'none',
            backgroundOrigin: 'padding-box',
            backgroundClip: 'padding-box',
            position: 'relative',
            opacity: isLoading || !usernameValid ? 0.5 : 1
          }}
        >
          {isLoading ? (
            <>
              <Loader2 className="inline mr-2 h-3 w-3 animate-spin" />
              <span>SAVING...</span>
            </>
          ) : (
            <span>SAVE</span>
          )}
        </button>
      </div>
    </form>
    </>
  );
} 