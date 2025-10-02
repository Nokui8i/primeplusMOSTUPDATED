'use client'

import { useEffect } from 'react'
import { auth } from '@/lib/firebase/config'
import { setPersistence, browserLocalPersistence } from 'firebase/auth'

export function AuthPersistence() {
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence)
      .catch((error) => {
        console.error('Error setting auth persistence:', error)
      })
  }, [])

  return null
} 