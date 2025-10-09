import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface UsernameEditFieldProps {
  currentUsername: string;
  onUsernameChange: (username: string, isValid: boolean) => void;
  disabled?: boolean;
}

export function UsernameEditField({ currentUsername, onUsernameChange, disabled }: UsernameEditFieldProps) {
  const [usernameValue, setUsernameValue] = useState(currentUsername || '');
  const [usernameStatus, setUsernameStatus] = useState<'available' | 'taken' | 'invalid' | 'checking' | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [nameError, setNameError] = useState('');
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setUsernameValue(currentUsername || '');
  }, [currentUsername]);

  const validateUsername = (username: string) => {
    if (!username.trim()) return 'Username is required';
    if (username.length < 3) return 'Username must be at least 3 characters';
    if (!/^[a-zA-Z0-9]+$/.test(username)) return 'Username can only contain letters and numbers';
    return '';
  };

  const checkUsernameAvailability = async (username: string) => {
    if (username === currentUsername) {
      setUsernameStatus('available');
      onUsernameChange(username, true);
      return true;
    }
    const usernameDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));
    const isAvailable = !usernameDoc.exists();
    setUsernameStatus(isAvailable ? 'available' : 'taken');
    onUsernameChange(username, isAvailable);
    return isAvailable;
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value;
    setUsernameValue(newUsername);
    onUsernameChange(newUsername, false);
    // Clear any existing timeout
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }
    // Validate username format first
    const usernameError = validateUsername(newUsername);
    if (usernameError) {
      setUsernameStatus('invalid');
      setNameError(usernameError);
      return;
    }
    setUsernameStatus('checking');
    setCheckingUsername(true);
    setNameError('');
    // Debounce the check
    checkTimeoutRef.current = setTimeout(async () => {
      try {
        await checkUsernameAvailability(newUsername);
      } catch (err) {
        setUsernameStatus('invalid');
        setNameError('Failed to check username availability');
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={usernameValue}
        onChange={handleUsernameChange}
        className="w-full pr-8"
        style={{
          background: 'rgba(255, 255, 255, 0.6)',
          border: `1px solid ${
            usernameStatus === 'available' ? 'rgba(34, 197, 94, 0.5)' :
            usernameStatus === 'taken' ? 'rgba(239, 68, 68, 0.5)' :
            usernameStatus === 'invalid' ? 'rgba(239, 68, 68, 0.5)' :
            'rgba(200, 200, 200, 0.3)'
          }`,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.8)',
          borderRadius: '10px',
          height: '28px',
          fontSize: '11px',
          padding: '6px 10px',
          color: '#000'
        }}
        placeholder="Username"
        disabled={disabled}
        autoComplete="off"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        {checkingUsername && (
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
        )}
        {!checkingUsername && usernameStatus === 'available' && (
          <div className="text-green-500">✓</div>
        )}
        {!checkingUsername && usernameStatus === 'taken' && (
          <div className="text-red-500">✕</div>
        )}
      </div>
      {nameError && <span className="text-red-500 text-xs block mt-1">{nameError}</span>}
    </div>
  );
} 