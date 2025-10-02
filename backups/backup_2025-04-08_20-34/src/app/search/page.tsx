import UserSearch from '@/components/search/UserSearch'

export default function SearchPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Search Users</h1>
      <UserSearch />
    </div>
  )
} 