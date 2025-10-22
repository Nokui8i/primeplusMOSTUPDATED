import { useState, useEffect } from 'react'
import { Post as PostType } from '@/lib/types/post'
import { Button } from '@/components/ui/button'
import { updatePost } from '@/lib/firebase/db'
import { toast } from 'react-hot-toast'
import MediaContent from '@/components/posts/MediaContent'
import { useAuth } from '@/lib/firebase/auth'
import { X, Smile, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ContentWatermark } from '@/components/media/ContentWatermark'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface EditPostDialogProps {
  post: PostType
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditPostDialog({
  post,
  open,
  onOpenChange,
}: EditPostDialogProps) {
  const { user } = useAuth()
  const [content, setContent] = useState(post.content || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [accessLevel, setAccessLevel] = useState<'free' | 'free_subscriber' | 'paid_subscriber' | 'ppv'>(() => {
    return post.accessSettings?.accessLevel || 'free';
  });
  const [allowComments, setAllowComments] = useState<'everyone' | 'subscribers' | 'paid_subscribers' | 'none'>(() => {
    if (post.allowComments === false) return 'none';
    if (post.allowComments === true) return 'everyone';
    if (post.commentAccessLevel === 'subscribers') return 'subscribers';
    if (post.commentAccessLevel === 'paid_subscribers') return 'paid_subscribers';
    return 'everyone';
  })
  const [ppvPrice, setPpvPrice] = useState<number>(post.accessSettings?.ppvPrice || 0)
  const [ppvEveryonePays, setPpvEveryonePays] = useState<boolean>(post.accessSettings?.ppvEveryonePays ?? true)
  const [showWatermark, setShowWatermark] = useState<boolean>(post.showWatermark ?? false)
  const [isVerified, setIsVerified] = useState(false)
  const [isCreatorRole, setIsCreatorRole] = useState(false)
  const [is360Mode, setIs360Mode] = useState<boolean>(post.type === 'video360' || post.type === 'image360')
  // Store the initial 360 mode state for comparison
  const initialIs360Mode = post.type === 'video360' || post.type === 'image360'

  // Function to handle emoji click
  const handleEmojiClick = (emoji: string) => {
    setContent(prev => prev + emoji);
  }

  // Load user verification status
  useEffect(() => {
    const loadUserVerification = async () => {
      if (user?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Check if user is a verified creator (for paid content monetization)
            const hasCreatorRole = userData.role === 'creator' || userData.role === 'admin' || userData.role === 'superadmin' || userData.role === 'owner';
            setIsCreatorRole(hasCreatorRole);
            
            if (hasCreatorRole) {
              // Admin, superadmin, and owner roles are automatically verified
              if (userData.role === 'admin' || userData.role === 'superadmin' || userData.role === 'owner') {
                setIsVerified(true);
              } else {
                // For regular creators, check BOTH old method (isVerified field) and new method (verificationData collection)
                let verified = false;
                
                // Check old method first (for existing verified creators)
                if (userData.isVerified === true) {
                  verified = true;
                } else {
                  // Check new method (verificationData collection)
                  const verificationDoc = await getDoc(doc(db, 'verificationData', user.uid));
                  if (verificationDoc.exists()) {
                    const verificationData = verificationDoc.data();
                    verified = verificationData.status === 'approved';
                  }
                }
                
                setIsVerified(verified);
              }
            } else {
              // Regular users cannot monetize
              setIsVerified(false);
            }
          }
        } catch (error) {
          console.error('Error loading user verification:', error);
        }
      }
    };

    loadUserVerification();
  }, [user]);

  useEffect(() => {
    if (open) {
      setContent(post.content || '')
      setAccessLevel(post.accessSettings?.accessLevel || 'free')
      setAllowComments(() => {
        if (post.allowComments === false) return 'none';
        if (post.allowComments === true) return 'everyone';
        if (post.commentAccessLevel === 'subscribers') return 'subscribers';
        if (post.commentAccessLevel === 'paid_subscribers') return 'paid_subscribers';
        return 'everyone';
      })
      setPpvPrice(post.accessSettings?.ppvPrice || 0)
      setPpvEveryonePays(post.accessSettings?.ppvEveryonePays ?? true)
      setShowWatermark(post.showWatermark ?? false)
      setIs360Mode(post.type === 'video360' || post.type === 'image360')
    }
  }, [post, open])

  const handleSubmit = async () => {
    if (!user) {
      toast.error('You must be logged in to edit posts')
      return
    }
    if (user.uid !== post.authorId) {
      toast.error('You can only edit your own posts')
      return
    }

    setIsSubmitting(true)
    try {
      // Build accessSettings object with only defined values
      const accessSettings: any = {
        ...(post.accessSettings || {}),
        accessLevel,
      }
      
      // Only add PPV settings if PPV is selected
      if (accessLevel === 'ppv') {
        accessSettings.ppvPrice = ppvPrice
        accessSettings.ppvEveryonePays = ppvEveryonePays
      } else {
        // Remove PPV settings if not PPV
        delete accessSettings.ppvPrice
        delete accessSettings.ppvEveryonePays
      }

      // Determine the new post type based on 360° mode
      let newType = post.type;
      if (is360Mode && (post.type === 'image' || post.type === 'video')) {
        newType = post.type === 'image' ? 'image360' : 'video360';
      } else if (!is360Mode && (post.type === 'image360' || post.type === 'video360')) {
        newType = post.type === 'image360' ? 'image' : 'video';
      }

      await updatePost(post.id, {
        content: content.trim(),
        allowComments: allowComments === 'none' ? false : allowComments === 'everyone' ? true : null,
        commentAccessLevel: allowComments === 'subscribers' ? 'subscribers' : allowComments === 'paid_subscribers' ? 'paid_subscribers' : null,
        showWatermark,
        type: newType,
        accessSettings,
      })
      toast.success('Post updated successfully')
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating post:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update post')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setContent(post.content || '')
    onOpenChange(false)
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="upload-master-container">
        <div className="upload-card">
          <div className="upload-title">
            Edit Post
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-3 h-8 w-8 rounded-full hover:bg-gray-100 text-gray-600"
              onClick={handleClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="upload-content">
            <div className="content-area">
              <div className="relative">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  placeholder={`What's on your mind, ${user?.displayName?.split(' ')[0] || 'there'}?`}
                  className="text-input pr-8"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="absolute right-2 top-2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <Smile className="h-4 w-4 text-yellow-500" />
                    </button>
                  </DropdownMenuTrigger>
                   <DropdownMenuContent 
                     align="end" 
                     className="w-64 p-2"
                     sideOffset={5}
                   >
                     <div 
                       id="emoji-picker-grid"
                       className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto"
                       onWheel={(e) => e.stopPropagation()}
                     >
                       {[
                         // Faces & Emotions
                         '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃',
                         // Animals
                         '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦏', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔',
                         // Hearts & Love
                         '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟',
                         // Symbols & Signs
                         '🔢', '🔠', '🔡', '🔤', '🅰️', '🆎', '🅱️', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓',
                         // Food & Drinks
                         '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫒', '🌽', '🥕', '🫑', '🥔', '🍠', '🥐', '🥖', '🍞', '🥨', '🥯', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥙', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🫖', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾',
                         // Activities & Sports
                         '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️‍♀️', '🏋️', '🏋️‍♂️', '🤼‍♀️', '🤼', '🤼‍♂️', '🤸‍♀️', '🤸', '🤸‍♂️', '⛹️‍♀️', '⛹️', '⛹️‍♂️', '🤺', '🤾‍♀️', '🤾', '🤾‍♂️', '🏌️‍♀️', '🏌️', '🏌️‍♂️', '🏇', '🧘‍♀️', '🧘', '🧘‍♂️', '🏄‍♀️', '🏄', '🏄‍♂️', '🏊‍♀️', '🏊', '🏊‍♂️', '🤽‍♀️', '🤽', '🤽‍♂️', '🚣‍♀️', '🚣', '🚣‍♂️', '🧗‍♀️', '🧗', '🧗‍♂️', '🚵‍♀️', '🚵', '🚵‍♂️', '🚴‍♀️', '🚴', '🚴‍♂️', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🤹', '🤹‍♀️', '🤹‍♂️', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '🪘', '🥁', '🪗', '🎸', '🪕', '🎺', '🎷', '🪗', '🎻', '🪈', '🎲', '♠️', '♥️', '♦️', '♣️', '🃏', '🀄', '🎴', '🎯', '🎳', '🎮', '🎰', '🧩', '🎲'
                       ].map((emoji) => (
                         <button
                           key={emoji}
                           onClick={() => handleEmojiClick(emoji)}
                           className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-md text-lg"
                         >
                           {emoji}
                         </button>
                       ))}
                     </div>
                   </DropdownMenuContent>
                </DropdownMenu>
                </div>
                
              {/* Show existing media */}
                {post.mediaUrl && (
                <div className="mt-4">
                  {post.type.startsWith('image') ? (
                    <div className="relative">
                      <img
                        src={post.mediaUrl}
                        alt="Preview"
                        className="w-full h-64 object-cover rounded-lg"
                      />
                      {showWatermark && (
                        <ContentWatermark 
                          username={user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'User'} 
                        />
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <video
                        src={post.mediaUrl}
                        className="w-full h-64 object-cover rounded-lg"
                        controls
                      />
                      {showWatermark && (
                        <ContentWatermark 
                          username={user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'User'} 
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="upload-settings">
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">360° Mode</div>
                <div className="setting-description">Toggle panoramic viewing mode</div>
              </div>
              <div className="setting-control">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={is360Mode}
                    onChange={(e) => {
                      e.stopPropagation();
                      setIs360Mode(!is360Mode);
                    }}
                    className="checkbox"
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">Show Watermark on Media</div>
              </div>
              <div className="setting-control">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWatermark}
                    onChange={(e) => {
                      e.stopPropagation();
                      setShowWatermark(!showWatermark);
                    }}
                    className="checkbox"
                  />
                  <span className="slider"></span>
                </label>
              </div>
                </div>
                
            {/* Allow Comments - Only for creators */}
            {isCreatorRole && (
              <div className="setting-row">
                <div className="setting-info">
                  <div className="setting-label">Allow Comments</div>
                </div>
                <div className="setting-control">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="w-fit px-3 py-1.5 text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-none hover:shadow-lg hover:scale-[1.02] focus:shadow-lg focus:scale-[1.02] flex items-center gap-2"
                        style={{
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb',
                          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                        }}
                      >
                        <span>
                          {allowComments === 'everyone' ? 'Everyone' : 
                           allowComments === 'subscribers' ? 'Subscribers only' :
                           allowComments === 'paid_subscribers' ? 'Paid subscribers only' :
                           allowComments === 'none' ? 'No comments' :
                           'Everyone'}
                        </span>
                        <ChevronDown className="h-3 w-3 text-gray-600" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="start" 
                      className="w-48 bg-white border-0 p-0 max-h-48 overflow-y-auto"
                      style={{
                        borderRadius: '8px',
                        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                        maxHeight: '192px', // 12rem = 192px
                        overflowY: 'auto'
                      }}
                    >
                      <DropdownMenuItem
                        onClick={() => setAllowComments('everyone')}
                        className="text-xs py-1.5 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                        style={{
                          background: allowComments === 'everyone' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                          color: allowComments === 'everyone' ? 'white' : 'inherit',
                        }}
                      >
                        Everyone
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setAllowComments('subscribers')}
                        className="text-xs py-1.5 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                        style={{
                          background: allowComments === 'subscribers' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                          color: allowComments === 'subscribers' ? 'white' : 'inherit',
                        }}
                      >
                        Subscribers only
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setAllowComments('paid_subscribers')}
                        className="text-xs py-1.5 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                        style={{
                          background: allowComments === 'paid_subscribers' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                          color: allowComments === 'paid_subscribers' ? 'white' : 'inherit',
                        }}
                      >
                        Paid subscribers only
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setAllowComments('none')}
                        className="text-xs py-1.5 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                        style={{
                          background: allowComments === 'none' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                          color: allowComments === 'none' ? 'white' : 'inherit',
                        }}
                      >
                        No comments
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}
                
            {/* Post Visibility - Only show to creators */}
            {isCreatorRole && (
              <div className="setting-row">
                <div className="setting-info">
                  <div className="setting-label">Post Visibility</div>
                </div>
                <div className="setting-control">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        disabled={!isVerified}
                        className="w-fit px-3 py-1.5 text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-none hover:shadow-lg hover:scale-[1.02] focus:shadow-lg focus:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none flex items-center gap-2"
                        style={{
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb',
                          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                        }}
                        title={!isVerified ? 'Complete creator verification to enable paid content' : ''}
                      >
                      <span>
                        {accessLevel === 'free' ? 'Everyone' :
                         accessLevel === 'free_subscriber' ? 'Free + Paid Subscribers' :
                         accessLevel === 'paid_subscriber' ? 'Paid Subscribers Only' :
                         accessLevel === 'ppv' ? 'Pay-Per-View' : 'Select visibility'}
                      </span>
                      <ChevronDown className="h-3 w-3 text-gray-600" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="start" 
                    className="w-48 bg-white border-0 p-0 max-h-48 overflow-y-auto"
                    style={{
                      borderRadius: '8px',
                      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                      maxHeight: '192px',
                      overflowY: 'auto'
                    }}
                  >
                    <DropdownMenuItem
                      onClick={() => isVerified && setAccessLevel('free')}
                      className="text-xs py-1.5 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                      style={{
                        background: accessLevel === 'free' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                        color: accessLevel === 'free' ? 'white' : 'inherit',
                      }}
                    >
                      Everyone
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => isVerified && setAccessLevel('free_subscriber')}
                      className="text-xs py-1.5 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                      style={{
                        background: accessLevel === 'free_subscriber' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                        color: accessLevel === 'free_subscriber' ? 'white' : 'inherit',
                      }}
                    >
                      Free + Paid Subscribers
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => isVerified && setAccessLevel('paid_subscriber')}
                      className="text-xs py-1.5 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                      style={{
                        background: accessLevel === 'paid_subscriber' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                        color: accessLevel === 'paid_subscriber' ? 'white' : 'inherit',
                      }}
                    >
                      Paid Subscribers Only
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => isVerified && setAccessLevel('ppv')}
                      className="text-xs py-1.5 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                      style={{
                        background: accessLevel === 'ppv' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                        color: accessLevel === 'ppv' ? 'white' : 'inherit',
                      }}
                    >
                      Pay-Per-View
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            )}

            {/* PPV Price Input - Only show when PPV is selected */}
            {isCreatorRole && isVerified && accessLevel === 'ppv' && (
              <div className="setting-row">
                <div className="setting-info">
                  <div className="setting-label">PPV Price</div>
                </div>
                <div className="setting-control">
                  <div className="relative w-24">
                    <span className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      step="0.01"
                      value={ppvPrice || ''}
                      onChange={(e) => setPpvPrice(Number(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-2 py-0.5 text-xs border-0 rounded-lg focus:ring-0 focus:outline-none"
                      style={{
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 0 rgba(0, 0, 0, 0.1)',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        appearance: 'none',
                        MozAppearance: 'textfield',
                        height: '28px'
                      }}
                    />
                  </div>
                    </div>
                  </div>
                )}
                
            {/* PPV Payment Rules - Only show when PPV is selected */}
            {isCreatorRole && isVerified && accessLevel === 'ppv' && (
              <div className="setting-row">
                <div className="setting-info">
                  <div className="space-y-2">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ppvEveryonePays}
                        onChange={(e) => setPpvEveryonePays(e.target.checked)}
                        className="checkbox"
                      />
                      <span className="slider"></span>
                      <span className="ml-3 text-sm text-gray-700">Everyone pays</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!ppvEveryonePays}
                        onChange={(e) => setPpvEveryonePays(!e.target.checked)}
                        className="checkbox"
                      />
                      <span className="slider"></span>
                      <span className="ml-3 text-sm text-gray-700">Only free subscribers & non-subscribers pay</span>
                    </label>
                  </div>
                </div>
                <div className="setting-control">
                  <div></div>
                    </div>
                  </div>
                )}
          </div>

          <div className="upload-actions">
            <div className="actions-content">
              <div className="action-buttons">
                <button
                    type="button"
                  className="btn-cancel"
                    onClick={handleClose}
                  >
                    Cancel
                </button>
                <button
                  type="button"
                  className="btn-submit"
                  onClick={handleSubmit}
                  disabled={isSubmitting || (
                    content.trim() === (post.content?.trim() || '') &&
                    allowComments === (() => {
                      if (post.allowComments === false) return 'none';
                      if (post.allowComments === true) return 'everyone';
                      if (post.commentAccessLevel === 'subscribers') return 'subscribers';
                      if (post.commentAccessLevel === 'paid_subscribers') return 'paid_subscribers';
                      return 'everyone';
                    })() &&
                    showWatermark === (post.showWatermark ?? false) &&
                    is360Mode === initialIs360Mode &&
                    accessLevel === (post.accessSettings?.accessLevel || 'free') &&
                    ppvPrice === (post.accessSettings?.ppvPrice || 0) &&
                    ppvEveryonePays === (post.accessSettings?.ppvEveryonePays ?? true)
                  )}
                  >
                    {isSubmitting ? 'Saving...' : 'SAVE CHANGES'}
                </button>
                </div>
            </div>
                </div>
            </div>
          </div>
        </div>
  )
} 