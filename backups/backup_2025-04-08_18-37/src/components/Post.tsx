import { FiHeart, FiMessageSquare, FiShare2 } from 'react-icons/fi'

interface PostAuthor {
  displayName: string
  photoURL: string
  nickname: string
}

export interface PostProps {
  id: string
  author: PostAuthor
  content: string
  imageUrl?: string
  likes: number
  comments: number
  createdAt: any
  onLike?: () => void
  onComment?: () => void
  onShare?: () => void
}

export function Post({
  author,
  content,
  imageUrl,
  likes,
  comments,
  createdAt,
  onLike,
  onComment,
  onShare,
}: PostProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 transform transition-all hover:shadow-xl border border-[#EEEEEE]">
      {/* Post Header */}
      <div className="flex items-center space-x-4">
        <div className="relative">
          <img
            src={author.photoURL || '/default-avatar.png'}
            alt={author.displayName}
            className="w-12 h-12 rounded-xl object-cover border-2 border-[#FF4081]"
          />
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#FF80AB]/20 via-[#FF4081]/20 to-[#C2185B]/20"></div>
        </div>
        <div>
          <h3 className="font-semibold text-[#1A1A1A] hover:text-[#E91E63] transition-colors cursor-pointer">
            {author.displayName}
          </h3>
          <p className="text-sm text-[#666666]">
            <span className="text-[#E91E63]">@{author.nickname}</span> · {new Date(createdAt?.toDate()).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Post Content */}
      <div className="mt-4">
        <p className="text-[#1A1A1A] whitespace-pre-wrap leading-relaxed">{content}</p>
        {imageUrl && (
          <div className="mt-4 rounded-xl overflow-hidden border border-[#EEEEEE]">
            <img
              src={imageUrl}
              alt="Post content"
              className="w-full object-cover transform transition-transform hover:scale-105"
              style={{ maxHeight: '32rem' }}
            />
          </div>
        )}
      </div>

      {/* Post Actions */}
      <div className="mt-6 flex space-x-8">
        <button
          onClick={onLike}
          className="flex items-center text-[#666666] hover:text-[#E91E63] transition-colors group"
        >
          <FiHeart className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium">{likes}</span>
        </button>
        <button
          onClick={onComment}
          className="flex items-center text-[#666666] hover:text-[#E91E63] transition-colors group"
        >
          <FiMessageSquare className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium">{comments}</span>
        </button>
        <button
          onClick={onShare}
          className="flex items-center text-[#666666] hover:text-[#E91E63] transition-colors group"
        >
          <FiShare2 className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium">Share</span>
        </button>
      </div>
    </div>
  )
} 