export interface PostData {
  id: string
  title: string
  content: string
  authorId: string
  authorName: string
  createdAt: Date | any
  updatedAt: Date | any
  likes: number
  comments: Comment[]
  tags: string[]
  imageUrl?: string
  type?: 'text' | 'image' | 'video' | 'live_stream' | 'vr' | 'image360' | 'video360' | 'ar' | 'audio'
  isPublic?: boolean
  shares?: number
  taggedUsers?: string[]
  status?: 'ended' | 'live'
  metadata?: {
    width?: number
    height?: number
    duration?: number
    fileSize?: number
    mimeType?: string
    aspectRatio?: string
    quality?: string
    format?: string
    imageMetadata?: any
    videoMetadata?: any
    audioMetadata?: any
    vrMetadata?: any
  }
  engagement?: {
    views: number
    uniqueViews: number
    averageViewDuration?: number
    clickThroughRate?: number
    saveCount: number
    reportCount: number
    relevanceScore?: number
  }
  accessSettings?: {
    isPremium: boolean
    subscriptionTier?: string
    price?: number
    promoCode?: string
    accessLevel?: 'free' | 'premium' | 'exclusive' | 'followers'
    availableFrom?: any
    availableUntil?: any
    geoRestrictions?: string[]
    ageRestriction?: number
  }
  author?: {
    id: string
    displayName: string
    photoURL?: string
    username?: string
  }
  mediaUrl?: string
  mediaType?: 'text' | 'image' | 'video' | 'live_stream' | 'vr' | 'image360' | 'video360' | 'ar' | 'audio'
  thumbnailUrl?: string
  background?: string
  location?: string
  commands?: any
  likedBy?: string[]
  moderation?: any
  organization?: any
  vrSettings?: any
  storySettings?: any
  analytics?: any
  showWatermark?: boolean
  streamId?: string
  viewerCount?: number
}

export interface Comment {
  id: string
  content: string
  authorId: string
  authorName: string
  createdAt: Date
  likes: number
}

export interface PostProps {
  post: PostData
  onUpdate?: (post: PostData) => void
  onDelete?: (postId: string) => void
  ref?: React.Ref<HTMLDivElement>
} 