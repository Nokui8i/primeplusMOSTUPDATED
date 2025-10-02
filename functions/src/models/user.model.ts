export interface User {
  id: string; // UUID
  username: string;
  email: string;
  // password_hash is managed by Firebase Auth or another auth system if not custom
  // We might not store it directly here if using Firebase Auth for users
  created_at: Date;
  updated_at: Date;
  // Add other user-specific fields as needed, e.g., bio, profilePictureUrl
  bio?: string;
  profilePictureUrl?: string;
} 