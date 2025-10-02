import Image from 'next/image'
import Link from 'next/link'

interface FeaturedPostCardProps {
  title: string
  author: {
    name: string
    avatar: string
  }
  thumbnail: string
  preview: string
}

export default function FeaturedPostCard({ title, author, thumbnail, preview }: FeaturedPostCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="relative h-48">
        <Image
          src={thumbnail}
          alt={title}
          fill
          className="object-cover"
        />
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative w-8 h-8">
            <Image
              src={author.avatar}
              alt={author.name}
              fill
              className="rounded-full object-cover"
            />
          </div>
          <span className="font-medium">{author.name}</span>
        </div>
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="text-gray-600 text-sm line-clamp-2">{preview}</p>
      </div>
    </div>
  )
} 