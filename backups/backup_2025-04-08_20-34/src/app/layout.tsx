import type { Metadata } from 'next'
import './globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/lib/auth'
import { RootLayoutContent } from '@/components/RootLayoutContent'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { NotificationList } from '@/components/common/NotificationList'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PrimePlus+',
  description: 'Connect with fellow developers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <NotificationProvider>
            <RootLayoutContent>{children}</RootLayoutContent>
            <NotificationList />
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  )
} 