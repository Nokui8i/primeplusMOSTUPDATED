'use client'

import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm'
import { Logo } from '@/components/common/Logo'
import Link from 'next/link'

export default function ForgotPassword() {
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gradient-to-br from-white via-gray-50 to-pink-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Link href="/">
            <Logo showText />
          </Link>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Reset your password
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter your email address and we'll send you instructions to reset your password.
        </p>
      </div>

      <ForgotPasswordForm />
    </div>
  )
} 