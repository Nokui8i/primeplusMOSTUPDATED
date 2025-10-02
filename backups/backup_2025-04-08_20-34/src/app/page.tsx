import LoginForm from '@/components/auth/LoginForm'
import { Logo } from '@/components/common/Logo'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      {/* Main Content */}
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Logo Section */}
          <div className="text-center">
            <Logo size="xl" className="justify-center" />
          </div>

          {/* Login Form Card */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-pink-100/30">
            <LoginForm />
          </div>

          {/* Footer Links */}
          <div className="text-center text-sm text-gray-500 space-x-4">
            <a href="#" className="hover:text-pink-600 transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-pink-600 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-pink-600 transition-colors">
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </main>
  )
} 