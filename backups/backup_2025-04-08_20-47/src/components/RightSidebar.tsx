'use client';

import { FiTrendingUp, FiStar, FiRefreshCw, FiEdit } from 'react-icons/fi'
import { useState } from 'react'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { FollowButton } from '@/components/FollowButton'
import { useFollowStats } from '@/lib/follow'
import Link from 'next/link'
import { MessagePopup } from './messages/MessagePopup'

interface Creator {
  id: string
  displayName: string
  nickname: string
  photoURL: string
  isVerified?: boolean
}

interface TrendingTopic {
  id: string
  name: string
  postCount: number
}

interface RightSidebarProps {
  suggestedCreators: Creator[]
  trendingTopics: TrendingTopic[]
  isLoading?: boolean
}

export function RightSidebar({ 
  suggestedCreators: initialCreators, 
  trendingTopics,
  isLoading = false 
}: RightSidebarProps) {
  const [suggestedCreators, setSuggestedCreators] = useState(initialCreators)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false)

  const handleRefreshCreators = async () => {
    setIsRefreshing(true)
    try {
      const creatorsRef = collection(db, 'users')
      const q = query(
        creatorsRef,
        where('isCreator', '==', true),
        orderBy('followers', 'desc'),
        limit(5)
      )
      const querySnapshot = await getDocs(q)
      const creators = querySnapshot.docs.map(doc => ({
        id: doc.id,
        displayName: doc.data().displayName || '',
        nickname: doc.data().nickname || '',
        photoURL: doc.data().photoURL || '',
        isVerified: doc.data().isVerified || false
      }))
      setSuggestedCreators(creators)
    } catch (error) {
      console.error('Error refreshing creators:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <>
      <aside className="w-80 h-full flex flex-col" aria-label="Sidebar">
        <div className="flex-1 space-y-6">
          {/* Suggested Creators */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#EEEEEE] overflow-hidden">
            <div className="p-4 border-b border-[#EEEEEE] flex justify-between items-center">
              <h2 className="font-semibold text-[#1A1A1A] flex items-center">
                <FiStar className="w-5 h-5 mr-2 text-[#E91E63]" />
                Suggested Creators
              </h2>
              <button 
                onClick={handleRefreshCreators}
                disabled={isRefreshing || isLoading}
                className="w-8 h-8 flex items-center justify-center text-[#E91E63] hover:bg-pink-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Discover more creators"
                aria-label="Refresh suggested creators"
              >
                <FiRefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="divide-y divide-[#EEEEEE]">
              {isLoading ? (
                // Loading skeleton for creators
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="p-4 animate-pulse">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2 mt-2"></div>
                      </div>
                      <div className="w-20 h-8 bg-gray-200 rounded-lg"></div>
                    </div>
                  </div>
                ))
              ) : (
                suggestedCreators.map((creator) => {
                  const { stats } = useFollowStats(creator.id)
                  
                  return (
                    <div key={creator.id} className="p-4 hover:bg-[#FAFAFA] transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <img
                            src={creator.photoURL}
                            alt={`${creator.displayName}'s profile`}
                            className="w-10 h-10 rounded-lg object-cover border border-[#EEEEEE]"
                          />
                          {creator.isVerified && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#E91E63] rounded-full flex items-center justify-center">
                              <FiStar className="w-3 h-3 text-white" aria-label="Verified creator" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-[#1A1A1A] truncate">
                            {creator.displayName}
                          </h3>
                          <p className="text-sm text-[#666666] truncate">
                            @{creator.nickname}
                          </p>
                        </div>
                        <FollowButton 
                          userId={creator.id}
                          variant="outline"
                          size="sm"
                          className="px-4 py-1.5 text-sm font-medium"
                        />
                      </div>
                      <p className="text-sm text-[#666666] mt-2">
                        {stats.followersCount.toLocaleString()} followers
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Trending Topics */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#EEEEEE] overflow-hidden">
            <div className="p-4 border-b border-[#EEEEEE]">
              <h2 className="font-semibold text-[#1A1A1A] flex items-center">
                <FiTrendingUp className="w-5 h-5 mr-2 text-[#E91E63]" />
                Trending Topics
              </h2>
            </div>
            <div className="divide-y divide-[#EEEEEE]">
              {isLoading ? (
                // Loading skeleton for topics
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3 mt-2"></div>
                  </div>
                ))
              ) : (
                trendingTopics.map((topic) => (
                  <Link
                    key={topic.id}
                    href={`/topics/${topic.name.toLowerCase()}`}
                    className="block p-4 hover:bg-[#FAFAFA] transition-colors"
                  >
                    <h3 className="font-medium text-[#1A1A1A] hover:text-[#E91E63] transition-colors">
                      #{topic.name}
                    </h3>
                    <p className="text-sm text-[#666666] mt-1">
                      {topic.postCount.toLocaleString()} posts
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* New Message Button */}
        <div className="p-4 mt-auto">
          <button
            onClick={() => setIsNewMessageOpen(true)}
            className="w-full flex items-center justify-center gap-2 p-3 bg-white rounded-xl border border-[#EEEEEE] text-gray-600 hover:text-[#E91E63] hover:bg-pink-50 transition-colors"
            aria-label="New message"
          >
            <FiEdit className="w-5 h-5" />
            <span className="font-medium">New Message</span>
          </button>
        </div>
      </aside>

      {/* New Message Popup */}
      {isNewMessageOpen && (
        <MessagePopup onClose={() => setIsNewMessageOpen(false)} />
      )}
    </>
  )
} 