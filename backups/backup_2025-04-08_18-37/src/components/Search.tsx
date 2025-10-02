import { useState } from 'react'
import { FiSearch } from 'react-icons/fi'

interface SearchProps {
  onSearch: (query: string) => void
}

export function Search({ onSearch }: SearchProps) {
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onSearch(query.trim())
    }
  }

  return (
    <div className="mb-8">
      <form onSubmit={handleSubmit} className="relative max-w-xl mx-auto">
        <input
          type="text"
          placeholder="Search accounts or posts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-2.5 border border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF4081] bg-white text-[#1A1A1A] placeholder-[#999999] shadow-sm hover:shadow transition-shadow"
        />
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#666666]" />
      </form>
    </div>
  )
} 