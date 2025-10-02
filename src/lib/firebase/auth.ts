import { getAuth, onAuthStateChanged, User } from 'firebase/auth'
import { app } from './config'
import { useEffect, useState } from 'react'

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => {
    const auth = getAuth(app)
    const unsubscribe = onAuthStateChanged(auth, setUser)
    return () => unsubscribe()
  }, [])
  return { user }
} 