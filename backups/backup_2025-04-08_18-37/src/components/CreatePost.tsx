import { useState } from 'react'
import { FiLoader, FiImage, FiVideo, FiSend } from 'react-icons/fi'

interface CreatePostProps {
  onSubmit: (content: string) => Promise<void>
}

export function CreatePost({ onSubmit }: CreatePostProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSubmit(content.trim())
      setContent('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 transform transition-all hover:shadow-xl border border-[#EEEEEE]">
      <form onSubmit={handleSubmit}>
        <textarea
          placeholder="Share your thoughts..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full p-4 border border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF4081] resize-none bg-[#FAFAFA] text-[#1A1A1A] placeholder-[#999999]"
          rows={3}
        />
        <div className="mt-4 flex justify-between items-center">
          <div className="flex space-x-4">
            <button
              type="button"
              className="flex items-center text-[#666666] hover:text-[#E91E63] transition-colors"
            >
              <FiImage className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">Photo</span>
            </button>
            <button
              type="button"
              className="flex items-center text-[#666666] hover:text-[#E91E63] transition-colors"
            >
              <FiVideo className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">Video</span>
            </button>
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !content.trim()}
            className="px-6 py-2.5 bg-gradient-to-r from-[#FF80AB] via-[#FF4081] to-[#E91E63] text-white rounded-xl hover:from-[#FF4081] hover:to-[#C2185B] focus:outline-none focus:ring-2 focus:ring-[#E91E63] focus:ring-offset-2 disabled:opacity-50 transition-all transform hover:scale-105 flex items-center space-x-2 font-medium shadow-lg hover:shadow-xl"
          >
            {isSubmitting ? (
              <FiLoader className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <FiSend className="w-5 h-5" />
                <span>Share</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
} 