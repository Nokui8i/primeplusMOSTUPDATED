import { getAuth } from 'firebase/auth'
import { app } from './config'

export const useAuth = () => {
  const auth = getAuth(app)
  return { auth }
} 