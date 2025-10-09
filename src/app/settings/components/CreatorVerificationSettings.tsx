'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import VerificationApplicationForm from './VerificationApplicationForm';
import { ref, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

export default function CreatorVerificationSettings() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCancelPendingDialog, setShowCancelPendingDialog] = useState(false);

  useEffect(() => {
    async function fetchUserProfile() {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserProfile();
  }, [user]);

  const isVerified = userProfile?.isVerified || false;
  const verificationStatus = userProfile?.verificationStatus || 'unverified';

  const handleApplyVerification = () => {
    setShowApplicationForm(true);
  };

  const handleCancelRequest = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        verificationStatus: 'unverified',
        verificationData: null,
        isVerified: false,
        // Don't change role - keep as 'creator'
      });
      await fetch('https://us-central1-primeplus-11a85.cloudfunctions.net/deleteCreatorVerificationDataHttp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });
      setUserProfile((prev: any) => ({ ...prev, verificationStatus: 'unverified', verificationData: null, isVerified: false }));
      setShowCancelPendingDialog(false);
    } catch (err) {
      alert('Failed to cancel request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetVerification = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        verificationStatus: 'unverified',
        verificationData: null,
        isVerified: false,
        // Don't change role - keep as 'creator'
      });
      await fetch('https://us-central1-primeplus-11a85.cloudfunctions.net/deleteCreatorVerificationDataHttp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });
      // Update local state instead of reload
      setUserProfile((prev: any) => ({ ...prev, verificationStatus: 'unverified', verificationData: null, isVerified: false }));
      setShowCancelDialog(false);
    } catch (err) {
      alert('Failed to cancel verification. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Callback for after verification application is submitted
  const handleVerificationSubmitted = () => {
    setUserProfile((prev: any) => ({ ...prev, verificationStatus: 'pending' }));
    setShowApplicationForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Creator Verification</h2>
          <p className="text-gray-500">
            Get verified to unlock monetization features
          </p>
        </div>
        {verificationStatus === 'verified' ? (
          <div className="flex items-center space-x-2 text-green-600">
            <FiCheckCircle className="w-5 h-5" />
            <span>Verified Creator</span>
          </div>
        ) : verificationStatus === 'pending' ? (
          <div className="flex items-center space-x-2 text-yellow-600">
            <FiAlertCircle className="w-5 h-5" />
            <span>Verification Pending</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-yellow-600">
            <FiAlertCircle className="w-5 h-5" />
            <span>Not Verified</span>
          </div>
        )}
      </div>

      {verificationStatus === 'unverified' && !showApplicationForm && (
        <Card className="p-6 space-y-4">
          <div>
            <h3 className="font-medium mb-2">Benefits of Verification</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-700 mb-1">Monetization Features</h4>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li>Create custom subscription plans</li>
                  <li>Receive tips from your audience</li>
                  <li>Access creator dashboard and analytics</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2">Requirements</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Valid government ID</li>
              <li>Age verification (18+)</li>
              <li>Tax information</li>
              <li>Terms agreement</li>
            </ul>
          </div>

          <Button
            onClick={handleApplyVerification}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Processing...' : 'Apply for Verification'}
          </Button>
        </Card>
      )}

      {showApplicationForm && (
        <VerificationApplicationForm onSubmitted={handleVerificationSubmitted} />
      )}

      {verificationStatus === 'verified' && (
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Verification Details</h3>
              <p className="text-gray-600">
                Your account is verified. You have access to all creator features.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Available Features</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">Creator Tools</h4>
                  <ul className="list-disc list-inside space-y-2 text-gray-600">
                    <li>Create and manage subscription plans</li>
                    <li>Track earnings and analytics</li>
                    <li>Manage subscribers and tips</li>
                  </ul>
                </div>
              </div>
            </div>
            <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
              <AlertDialogTrigger asChild>
                <Button
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isLoading}
                  variant="outline"
                  className="mt-4"
                >
                  {isLoading ? 'Cancelling...' : 'Cancel Verification'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <div className="flex items-center gap-3 mb-2">
                  <FiAlertCircle className="w-7 h-7 text-yellow-500 flex-shrink-0" />
                  <AlertDialogHeader className="flex-1">
                    <AlertDialogTitle className="text-lg font-bold text-red-700">Cancel Creator Verification?</AlertDialogTitle>
                  </AlertDialogHeader>
                </div>
                <AlertDialogDescription className="mb-2 text-gray-700">
                  Are you sure you want to cancel your creator verification?
                </AlertDialogDescription>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isLoading}>Keep Verification</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetVerification} disabled={isLoading} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
                    {isLoading ? 'Cancelling...' : 'Yes, Cancel & Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Card>
      )}

      {verificationStatus === 'pending' && (
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Verification Status</h3>
              <p className="text-gray-600">
                Your verification application is being reviewed. We'll notify you once it's complete.
              </p>
              <div className="flex gap-2 mt-4">
                <AlertDialog open={showCancelPendingDialog} onOpenChange={setShowCancelPendingDialog}>
                  <AlertDialogTrigger asChild>
                    <Button
                      onClick={() => setShowCancelPendingDialog(true)}
                      disabled={isLoading}
                      variant="outline"
                    >
                      {isLoading ? 'Cancelling...' : 'Cancel Request'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <div className="flex items-center gap-3 mb-2">
                      <FiAlertCircle className="w-7 h-7 text-yellow-500 flex-shrink-0" />
                      <AlertDialogHeader className="flex-1">
                        <AlertDialogTitle className="text-lg font-bold text-red-700">Cancel Creator Verification?</AlertDialogTitle>
                      </AlertDialogHeader>
                    </div>
                    <AlertDialogDescription className="mb-2 text-gray-700">
                      Are you sure you want to cancel your creator verification request?
                    </AlertDialogDescription>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isLoading}>Keep Verification</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancelRequest} disabled={isLoading} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
                        {isLoading ? 'Cancelling...' : 'Yes, Cancel & Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
} 