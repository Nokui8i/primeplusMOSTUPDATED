import { Timestamp } from 'firebase/firestore'

export interface Author {
  id: string
  displayName: string
  username?: string | null
  photoURL?: string | null
}

export interface CommentType {
  id: string
  content: string
  authorId: string
  authorDisplayName: string
  authorUsername?: string | null
  authorPhotoURL?: string | null
  createdAt: Timestamp
  updatedAt?: Timestamp
  likes: number
  isEdited: boolean
  parentId: string | null
  postId: string
}

export interface CommentFormData {
  content: string
  parentId: string | null
}

export interface CommentLike {
  userId: string
  commentId: string
  createdAt: Timestamp
} 