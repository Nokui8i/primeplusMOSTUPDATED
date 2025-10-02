'use client'

import CompleteProfileForm from '@/components/auth/CompleteProfileForm'

export default function CompleteProfile() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center">
      <div className="w-full max-w-xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-pink-100/30">
          <h1 className="text-center text-3xl font-bold bg-gradient-to-r from-[#FF4081] to-[#E91E63] bg-clip-text text-transparent">
            Complete Your Profile
          </h1>
          <p className="mt-4 text-center text-gray-700 text-lg font-medium">
            Just a few more details to get you started
          </p>
          <p className="mt-2 text-center text-sm text-gray-500">
            This information helps others find and connect with you
          </p>
          <CompleteProfileForm />
        </div>
      </div>
    </div>
  )
} 