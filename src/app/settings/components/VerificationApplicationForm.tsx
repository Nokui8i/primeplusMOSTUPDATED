'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { doc, updateDoc, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
// Firebase Storage imports removed - now using AWS S3
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function VerificationApplicationForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [taxId, setTaxId] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIdFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setError('');

    try {
      // Upload ID document to AWS S3
      if (!idFile) {
        throw new Error('Please upload your government ID');
      }

      const { uploadToS3, generateS3Key } = await import('@/lib/aws/s3');
      const s3Key = generateS3Key(user.uid, `government_id_${Date.now()}_${idFile.name}`, 'documents');
      const idUrl = await uploadToS3(idFile, s3Key);

      // Update user document with verification application
      await updateDoc(doc(db, 'users', user.uid), {
        verificationStatus: 'pending',
        verificationData: {
          governmentIdUrl: idUrl,
          taxId,
          termsAgreed,
          submittedAt: new Date().toISOString()
        }
      });

      // Check for existing application in verificationData
      const q = query(collection(db, 'verificationData'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        // Update the first found application
        const appDoc = snap.docs[0];
        await updateDoc(appDoc.ref, {
          status: 'pending',
          idDocumentUrl: idUrl,
          taxInfo: taxId,
          termsAgreed,
          submittedAt: new Date().toISOString()
        });
      } else {
        // Create a new document in verificationData collection for admin dashboard
        await addDoc(collection(db, 'verificationData'), {
          userId: user.uid,
          status: 'pending',
          idDocumentUrl: idUrl,
          taxInfo: taxId,
          termsAgreed,
          submittedAt: new Date().toISOString()
        });
      }

      // Show success message or redirect
      if (onSubmitted) onSubmitted();
    } catch (err: any) {
      setError(err.message || 'Failed to submit verification application');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
      <Card className="p-6 shadow-sm border-gray-100 bg-transparent">
        <div className="space-y-6">
          {/* Header Section */}
          <div className="px-4 py-3 rounded-lg text-center space-y-0.5 bg-gradient-to-r from-[#6B3BFF] to-[#2B55FF]">
            <div className="flex items-center justify-center gap-1.5">
              <h2 className="text-base font-bold text-white">Creator Verification</h2>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="text-white/80 hover:text-white cursor-help text-sm">ⓘ</button>
                </PopoverTrigger>
                <PopoverContent className="w-72">
                  <div className="space-y-1.5">
                    <h4 className="font-medium text-indigo-100">Verification Process</h4>
                    <p className="text-xs text-indigo-100">
                      To become a verified creator, we need to verify your identity and ensure you meet our requirements. 
                      This process typically takes 1-2 business days. We'll notify you once your application is reviewed.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-xs text-indigo-100">Complete this form to become a verified creator and unlock monetization features</p>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Government ID Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="governmentId" className="text-sm font-medium text-white">Government ID</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="text-white/70 hover:text-white cursor-help text-sm">ⓘ</button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72">
                    <div className="space-y-2">
                      <h4 className="font-medium text-indigo-100">ID Requirements</h4>
                      <div>
                        <p className="text-xs font-medium text-indigo-100">What we accept:</p>
                        <ul className="list-disc list-inside text-xs text-indigo-100 mt-0.5 space-y-0.5">
                          <li>Driver's license</li>
                          <li>Passport</li>
                          <li>National ID card</li>
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-indigo-100">Make sure your ID is:</p>
                        <ul className="list-disc list-inside text-xs text-indigo-100 mt-0.5 space-y-0.5">
                          <li>Clear and readable</li>
                          <li>Not expired</li>
                          <li>Shows your full name and date of birth</li>
                        </ul>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Input
                  id="governmentId"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  required
                  className="h-7 text-xs border-gray-400 bg-white/10 text-white file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-indigo-700 file:text-white hover:file:bg-indigo-800 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-colors"
                />
              </div>
            </div>

            {/* Tax Information Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="taxId" className="text-sm font-medium text-white">Tax Information</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="text-white/70 hover:text-white cursor-help text-sm">ⓘ</button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72">
                    <div className="space-y-2">
                      <h4 className="font-medium text-indigo-100">Why We Need Tax Information</h4>
                      <ul className="list-disc list-inside text-xs text-indigo-100 space-y-0.5">
                        <li>Required for tax reporting</li>
                        <li>Needed to process your earnings</li>
                        <li>Helps us comply with financial regulations</li>
                      </ul>
                      <p className="text-xs text-indigo-100 mt-1.5">
                        Your tax information is encrypted and stored securely. We only use it for tax reporting purposes.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Input
                  id="taxId"
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  required
                  placeholder="Enter your Tax ID or SSN"
                  className="h-7 text-xs border-gray-400 bg-white/10 text-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-colors"
                />
              </div>
            </div>

            {/* Terms Section */}
            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={termsAgreed}
                  onCheckedChange={(checked: boolean) => setTermsAgreed(checked)}
                  required
                  className="mt-0.5 border-gray-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="terms" className="text-sm font-medium text-white">
                      Age Verification & Terms
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button type="button" className="text-white/70 hover:text-white cursor-help text-sm">ⓘ</button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72">
                        <div className="space-y-1.5">
                          <h4 className="font-medium text-indigo-100">Age Requirement</h4>
                          <p className="text-xs text-indigo-100">
                            You must be at least 18 years old to become a verified creator. This is required by law and our platform policies.
                          </p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <p className="text-xs text-indigo-100">
                    I confirm that I am at least 18 years old and agree to the{' '}
                    <a href="/terms" className="text-white underline hover:text-indigo-200" target="_blank">
                      terms of service
                    </a>
                    {' '}and{' '}
                    <a href="/content-guidelines" className="text-white underline hover:text-indigo-200" target="_blank">
                      content guidelines
                    </a>
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50/60 p-3 rounded-md border border-red-100">
                <p className="text-xs text-red-600 font-medium">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-center">
              <Button
                type="submit"
                disabled={isLoading || !termsAgreed}
                className="h-9 px-8 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[#6B3BFF] to-[#2B55FF] hover:from-[#7C5FE6] hover:to-[#3B6BFF]"
              >
                {isLoading ? 'Submitting...' : 'Submit Application'}
              </Button>
            </div>

            {/* Footer Note */}
            <p className="text-xs text-indigo-100 text-center">
              By submitting, you agree to our verification process and understand that we may contact you for additional information if needed.
            </p>
          </div>
        </div>
      </Card>
    </form>
  );
} 