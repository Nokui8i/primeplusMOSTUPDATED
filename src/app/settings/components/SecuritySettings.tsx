'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { doc, updateDoc, getDoc, arrayUnion, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Shield, Lock, Key, CheckCircle2, Circle, XCircle } from 'lucide-react';
import { 
  getAuth, 
  EmailAuthProvider, 
  reauthenticateWithCredential, 
  updatePassword,
  sendPasswordResetEmail,
  signOut,
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

// Password validation rules
const PASSWORD_RULES = {
  minLength: 8,
  hasUpperCase: /[A-Z]/,
  hasLowerCase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/,
  isEnglish: /^[A-Za-z0-9!@#$%^&*(),.?":{}|<>]+$/,
};

const validatePassword = (password: string) => {
  const errors = [];
  
  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`Password must be at least ${PASSWORD_RULES.minLength} characters long`);
  }
  if (!PASSWORD_RULES.hasUpperCase.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!PASSWORD_RULES.hasLowerCase.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!PASSWORD_RULES.hasNumber.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!PASSWORD_RULES.hasSpecialChar.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  if (!PASSWORD_RULES.isEnglish.test(password)) {
    errors.push('Password must be in English (A-Z, a-z, 0-9, symbols)');
  }
  
  return errors;
};

const getPasswordStatus = (password: string) => {
  return {
    minLength: password.length >= PASSWORD_RULES.minLength,
    hasUpperCase: PASSWORD_RULES.hasUpperCase.test(password),
    hasLowerCase: PASSWORD_RULES.hasLowerCase.test(password),
    hasNumber: PASSWORD_RULES.hasNumber.test(password),
    hasSpecialChar: PASSWORD_RULES.hasSpecialChar.test(password),
  };
};

export default function SecuritySettings() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailPasswordUser, setIsEmailPasswordUser] = useState(false);
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    loginNotifications: true,
    deviceManagement: true,
    sessionTimeout: '24h',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [isCheckingAuthMethod, setIsCheckingAuthMethod] = useState(true);
  const [passwordHistory, setPasswordHistory] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showFinalDeleteDialog, setShowFinalDeleteDialog] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  useEffect(() => {
    const checkAuthMethod = async () => {
      if (user?.email && user?.uid) {
        let isEmailPassword = false;
        try {
          // 1. Check Firestore user document
          const userDocSnap = await getDoc(doc(db, 'users', user.uid));
          const userData = userDocSnap.data();
          if (userData?.authProvider === 'email') {
            isEmailPassword = true;
          } else {
            // 2. Fallback to Firebase method check
            const methods = await fetchSignInMethodsForEmail(getAuth(), user.email);
            isEmailPassword = methods.includes('password');
          }
        } catch (e) {
          // If there's an error, fallback to showing the form
          isEmailPassword = true;
        }
        setIsEmailPasswordUser(isEmailPassword);
        setIsCheckingAuthMethod(false);
      }
    };
    checkAuthMethod();
  }, [user]);

  useEffect(() => {
    // Fetch password history for real-time validation
    const fetchHistory = async () => {
      if (user?.uid) {
        try {
          const userDocSnap = await getDoc(doc(db, 'users', user.uid));
          const userData = userDocSnap.data();
          setPasswordHistory(userData?.security?.passwordHistory || []);
        } catch {
          setPasswordHistory([]);
        }
      }
    };
    fetchHistory();
  }, [user]);

  const handleSecuritySettingChange = async (setting: string, value: boolean | string) => {
    setIsLoading(true);
    try {
      const userRef = doc(db, 'users', user!.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          [`security.${setting}`]: value,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(userRef, {
          [`security.${setting}`]: value,
          updatedAt: serverTimestamp(),
        });
      }
      setSecuritySettings(prev => ({ ...prev, [setting]: value }));
      toast.success('Security settings updated');
    } catch (error) {
      console.error('Error updating security settings:', error);
      toast.error('Failed to update security settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPasswordErrors([]);

    if (!isEmailPasswordUser) {
      setPasswordErrors(['Password change is only available for email/password accounts']);
      setIsLoading(false);
      return;
    }

    // Validate passwords match
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordErrors(['New passwords do not match']);
      setIsLoading(false);
      return;
    }

    // Validate new password strength
    const validationErrors = validatePassword(passwordForm.newPassword);
    if (validationErrors.length > 0) {
      setPasswordErrors(validationErrors);
      setIsLoading(false);
      return;
    }

    try {
      const auth = getAuth();
      if (!auth.currentUser || !auth.currentUser.email) {
        throw new Error('No authenticated user found');
      }

      // Get user's password history
      const userDoc = await getDoc(doc(db, 'users', user!.uid));
      const userData = userDoc.data();
      const passwordHistory = userData?.security?.passwordHistory || [];

      // Check if password was used before
      if (passwordHistory.includes(passwordForm.newPassword)) {
        setPasswordErrors(['You cannot reuse a previous password']);
        setIsLoading(false);
        return;
      }

      // Re-authenticate user before password change
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        passwordForm.currentPassword
      );
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Generate a secure random token
      const token = uuidv4();

      // Store the new password and token temporarily in Firestore
      await updateDoc(doc(db, 'users', user!.uid), {
        'security.pendingPasswordChange': {
          password: passwordForm.newPassword,
          timestamp: new Date().toISOString(),
          token,
          verified: false
        }
      });

      // Send a custom email with the confirmation link
      const confirmUrl = `${window.location.origin}/settings/security/verify?uid=${user!.uid}&token=${token}`;
      await fetch('/api/send-password-change-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: auth.currentUser.email,
          confirmUrl
        })
      });

      toast.success('A confirmation email has been sent.');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        setPasswordErrors(['Current password is incorrect']);
      } else if (error.code === 'auth/requires-recent-login') {
        setPasswordErrors(['Please log out and log in again before changing your password']);
      } else if (error.code === 'auth/network-request-failed') {
        setPasswordErrors(['Network error. Please check your connection and try again']);
      } else {
        setPasswordErrors(['Failed to update password. Please try again']);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStatus = getPasswordStatus(passwordForm.newPassword);

  const handleDeleteAccount = async () => {
    setIsLoading(true);
    setDeleteError(null);
    try {
      // 1. Get the Firebase ID token
      const auth = getAuth();
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      if (!token) throw new Error('User not authenticated');

      // 2. Call backend API to delete user data and trigger cleanup
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete user data.');
      }
      // 3. Delete Firebase Auth user
      if (auth.currentUser) {
        await auth.currentUser.delete();
      }
      // 4. Sign out and redirect
      await signOut(auth);
      router.push('/');
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        setDeleteError('Please log out and log in again before deleting your account.');
      } else {
        setDeleteError(error.message || 'Failed to delete account.');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold mb-2">Password</h2>
        {isCheckingAuthMethod ? (
          <div className="text-gray-400 bg-gray-50 p-2 rounded-lg text-sm">Checking authentication method...</div>
        ) : !isEmailPasswordUser ? (
          <div className="text-yellow-600 bg-yellow-50 p-2 rounded-lg text-sm">
            Password change is only available for accounts that use email and password authentication.
          </div>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="currentPassword" className="text-sm font-medium text-gray-800">Current Password</Label>
              <input
                id="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={e => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                required
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.6)',
                  border: '1px solid rgba(200, 200, 200, 0.3)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  borderRadius: '10px',
                  height: '28px',
                  fontSize: '11px',
                  padding: '6px 10px',
                  color: '#000',
                  outline: 'none',
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="newPassword" className="text-sm font-medium text-gray-800">New Password</Label>
              <input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                required
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.6)',
                  border: '1px solid rgba(200, 200, 200, 0.3)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  borderRadius: '10px',
                  height: '28px',
                  fontSize: '11px',
                  padding: '6px 10px',
                  color: '#000',
                  outline: 'none',
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-800">Confirm New Password</Label>
              <input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                required
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.6)',
                  border: '1px solid rgba(200, 200, 200, 0.3)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  borderRadius: '10px',
                  height: '28px',
                  fontSize: '11px',
                  padding: '6px 10px',
                  color: '#000',
                  outline: 'none',
                }}
              />
              {(passwordForm.newPassword && passwordForm.confirmPassword) && (
                passwordForm.newPassword === passwordForm.confirmPassword ? (
                  <div className="flex items-center text-green-500 text-xs mt-0.5">
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Passwords match
                  </div>
                ) : (
                  <div className="flex items-center text-red-500 text-xs mt-0.5">
                    <XCircle className="h-4 w-4 mr-1" /> Passwords do not match
                  </div>
                )
              )}
            </div>
            {passwordErrors.length > 0 && (
              <div className="text-red-500 text-xs space-y-0.5 mt-1">
                {passwordErrors.map((error, index) => (
                  <p key={index}>{error}</p>
                ))}
              </div>
            )}
            <div className="text-xs text-gray-500 mt-1">
              <p className="mb-0.5">Password must:</p>
              <ul className="list-none space-y-0.5 mt-0">
                <li className={passwordStatus.minLength ? 'text-green-500' : 'text-gray-400'}>
                  {passwordStatus.minLength ? <CheckCircle2 className="inline mr-1 h-4 w-4" /> : <Circle className="inline mr-1 h-4 w-4" />}
                  Be at least 8 characters long
                </li>
                <li className={passwordStatus.hasUpperCase ? 'text-green-500' : 'text-gray-400'}>
                  {passwordStatus.hasUpperCase ? <CheckCircle2 className="inline mr-1 h-4 w-4" /> : <Circle className="inline mr-1 h-4 w-4" />}
                  Contain at least one uppercase letter
                </li>
                <li className={passwordStatus.hasNumber ? 'text-green-500' : 'text-gray-400'}>
                  {passwordStatus.hasNumber ? <CheckCircle2 className="inline mr-1 h-4 w-4" /> : <Circle className="inline mr-1 h-4 w-4" />}
                  Contain at least one number
                </li>
                <li className={passwordStatus.hasSpecialChar ? 'text-green-500' : 'text-gray-400'}>
                  {passwordStatus.hasSpecialChar ? <CheckCircle2 className="inline mr-1 h-4 w-4" /> : <Circle className="inline mr-1 h-4 w-4" />}
                  Contain at least one special character
                </li>
              </ul>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2"
              style={{
                border: 'none',
                color: '#fff',
                backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
                backgroundColor: 'transparent',
                borderRadius: '15px',
                fontSize: '13px',
                padding: '0.4em 0.8em',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading && <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </button>
          </form>
        )}
      </div>
      {/* Delete Account Section */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-xl font-semibold text-red-600 mb-2">Delete Account</h2>
        <p className="text-sm text-gray-600 mb-4">
          Deleting your account is <span className="font-bold text-red-600">permanent</span> and will remove all your data, content, and files from our system. This action cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteDialog(true)}
          disabled={isLoading}
          className="del"
          style={{
            position: 'relative',
            top: 0,
            left: 0,
            width: '120px',
            height: '38px',
            margin: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              background: 'none',
              boxShadow: '3px 3px 5px 0 rgba(255,255,255,.5), -3px -3px 5px 0 rgba(116, 125, 136, .5), inset -3px -3px 5px 0 rgba(255,255,255,.2), inset 3px 3px 5px 0 rgba(0, 0, 0, .4)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '25px',
              letterSpacing: '1px',
              color: '#ff0000',
              zIndex: 1,
              transition: '.6s',
              fontSize: '13px',
            }}
            className="del-inner"
          >
            Delete
          </div>
        </button>
        {/* First Confirmation Dialog */}
        {showDeleteDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="card">
              <div className="card-content">
                <p className="card-heading">Confirm Account Deletion</p>
                <p className="card-description">Are you sure you want to permanently delete your account? This cannot be undone.</p>
              </div>
              <div className="card-button-wrapper">
                <button className="card-button secondary" onClick={() => setShowDeleteDialog(false)} disabled={isLoading}>Cancel</button>
                <button
                  className="card-button primary"
                  onClick={() => { setShowDeleteDialog(false); setShowFinalDeleteDialog(true); setDeleteError(null); setDeleteConfirmInput(''); }}
                  disabled={isLoading}
                >
                  Continue
                </button>
              </div>
              <button className="exit-button" onClick={() => setShowDeleteDialog(false)}>
                <svg height="20px" viewBox="0 0 384 512">
                  <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"></path>
                </svg>
              </button>
            </div>
          </div>
        )}
        {/* Second (Final) Confirmation Dialog */}
        {showFinalDeleteDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="card">
              <div className="card-content">
                <p className="card-heading">Final Confirmation</p>
                <p className="card-description">To confirm, please type <span className="font-bold text-white">DELETE</span> below. This action is <span className="text-red-500 font-bold">permanent</span> and cannot be undone.</p>
                <input
                  type="text"
                  style={{
                    width: '100%',
                    padding: '10px 15px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    fontSize: '14px',
                    outline: 'none',
                    marginTop: '10px',
                  }}
                  placeholder="Type DELETE to confirm"
                  value={deleteConfirmInput}
                  onChange={e => setDeleteConfirmInput(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
                {deleteError && <div style={{ color: '#ff4444', fontSize: '12px', marginTop: '8px' }}>{deleteError}</div>}
              </div>
              <div className="card-button-wrapper">
                <button className="card-button secondary" onClick={() => { setShowFinalDeleteDialog(false); setDeleteConfirmInput(''); setDeleteError(null); }} disabled={isLoading}>Cancel</button>
                <button
                  className="card-button primary"
                  onClick={async () => {
                    if (deleteConfirmInput !== 'DELETE') {
                      setDeleteError('You must type DELETE to confirm.');
                      return;
                    }
                    setDeleteError(null);
                    setShowFinalDeleteDialog(false);
                    await handleDeleteAccount();
                  }}
                  disabled={isLoading || deleteConfirmInput !== 'DELETE'}
                  style={{
                    opacity: (isLoading || deleteConfirmInput !== 'DELETE') ? 0.5 : 1,
                    cursor: (isLoading || deleteConfirmInput !== 'DELETE') ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoading ? <Loader2 className="inline mr-2 h-4 w-4 animate-spin" /> : null}
                  Delete
                </button>
              </div>
              <button className="exit-button" onClick={() => { setShowFinalDeleteDialog(false); setDeleteConfirmInput(''); setDeleteError(null); }}>
                <svg height="20px" viewBox="0 0 384 512">
                  <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"></path>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 