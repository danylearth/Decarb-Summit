import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDoc, doc, updateDoc, increment, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useUser } from '../context/UserContext';
import { Post, User, Comment } from '../types';
import { Avatar, Card, Button } from '../components/UI';
import { Heart, MessageCircle, Share2, MoreHorizontal, Plus, X, Image as ImageIcon, Video, Upload, Loader2, Send, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
// Mock data removed - all data comes from Firestore

export function FeedPage() {
  const { user } = useUser();
  const [posts, setPosts] = useState<(Post & { author: User })[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        setPosts([]);
        setLoadingPosts(false);
        return;
      }

      const postsData = await Promise.all(snapshot.docs.map(async (postDoc) => {
        const data = postDoc.data();
        // Fetch author details
        const authorRef = doc(db, 'users', data.authorId);
        const authorSnap = await getDoc(authorRef);
        const authorData = authorSnap.exists() ? authorSnap.data() as User : {
          id: data.authorId,
          name: 'Unknown User',
          handle: 'unknown',
          role: '',
          company: '',
          avatar: `https://picsum.photos/seed/${data.authorId}/100/100`
        } as User;

        return {
          id: postDoc.id,
          ...data,
          author: authorData,
          timestamp: data.timestamp?.toDate?.()?.toLocaleString() || 'Just now'
        } as Post & { author: User };
      }));
      setPosts(postsData);
      setLoadingPosts(false);
      setPostsError(null);
    }, (err) => {
      setPostsError('Failed to load posts. Please try again.');
      setLoadingPosts(false);
      handleFirestoreError(err, OperationType.LIST, 'posts');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || posts.length === 0) return;
    
    const fetchLikes = async () => {
      const liked = new Set<string>();
      await Promise.all(posts.map(async (post) => {
        const likeRef = doc(db, 'posts', post.id, 'likes', user.id);
        const likeSnap = await getDoc(likeRef);
        if (likeSnap.exists()) {
          liked.add(post.id);
        }
      }));
      setLikedPosts(liked);
    };

    fetchLikes();
  }, [user?.id, posts.length]);

  useEffect(() => {
    if (!expandedPostId) {
      setComments([]);
      return;
    }

    const q = query(
      collection(db, 'posts', expandedPostId, 'comments'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.()?.toLocaleString() || 'Just now'
      } as Comment));
      setComments(commentsData);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `posts/${expandedPostId}/comments`);
    });

    return () => unsubscribe();
  }, [expandedPostId]);

  const handleLike = async (postId: string) => {
    if (!user) return;
    const isLiked = likedPosts.has(postId);
    
    // Optimistic update
    const newLikedPosts = new Set(likedPosts);
    if (isLiked) {
      newLikedPosts.delete(postId);
    } else {
      newLikedPosts.add(postId);
    }
    setLikedPosts(newLikedPosts);

    try {
      const postRef = doc(db, 'posts', postId);
      const likeRef = doc(db, 'posts', postId, 'likes', user.id);

      if (isLiked) {
        await deleteDoc(likeRef);
        await updateDoc(postRef, { likes: increment(-1) });
      } else {
        await setDoc(likeRef, { userId: user.id, timestamp: serverTimestamp() });
        await updateDoc(postRef, { likes: increment(1) });
      }
    } catch (err) {
      // Rollback
      setLikedPosts(likedPosts);
      handleFirestoreError(err, OperationType.UPDATE, `posts/${postId}/likes`);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!user || !newComment.trim()) return;
    setIsSubmittingComment(true);

    try {
      const postRef = doc(db, 'posts', postId);
      const commentsRef = collection(db, 'posts', postId, 'comments');

      await addDoc(commentsRef, {
        authorId: user.id,
        authorName: user.name,
        authorAvatar: user.avatar,
        content: newComment,
        timestamp: serverTimestamp()
      });

      await updateDoc(postRef, { comments: increment(1) });
      setNewComment('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `posts/${postId}/comments`);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!user) return;
    try {
      const postRef = doc(db, 'posts', postId);
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);
      await deleteDoc(commentRef);
      await updateDoc(postRef, { comments: increment(-1) });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${postId}/comments/${commentId}`);
    }
  };

  const handleUpdateComment = async (postId: string, commentId: string) => {
    if (!user || !editingCommentContent.trim()) return;
    setIsSubmittingComment(true);
    try {
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);
      await updateDoc(commentRef, {
        content: editingCommentContent,
        isEdited: true,
        updatedAt: serverTimestamp()
      });
      setEditingCommentId(null);
      setEditingCommentContent('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${postId}/comments/${commentId}`);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleShare = async (post: Post & { author: User }) => {
    const shareData = {
      title: `Decarb Connect: Post by ${post.author.name}`,
      text: post.content,
      url: `${window.location.origin}/feed?post=${post.id}`,
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareData.url);
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 3000);
      } catch (err) {
        console.error('Failed to copy link:', err);
      }
    }
  };

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreatePost = async () => {
    if (!user || (!newPostContent.trim() && !selectedFile)) return;
    setIsSubmitting(true);
    setUploadProgress(0);
    
    try {
      let mediaUrl = '';
      let mediaType: 'image' | 'video' = 'image';

      if (selectedFile) {
        const fileRef = ref(storage, `posts/${user.id}/${Date.now()}_${selectedFile.name}`);
        const uploadResult = await uploadBytes(fileRef, selectedFile);
        mediaUrl = await getDownloadURL(uploadResult.ref);
        mediaType = selectedFile.type.startsWith('video') ? 'video' : 'image';
      }

      await addDoc(collection(db, 'posts'), {
        authorId: user.id,
        content: newPostContent,
        likes: 0,
        comments: 0,
        timestamp: serverTimestamp(),
        media: mediaUrl || '',
        mediaType: mediaType
      });

      setNewPostContent('');
      setSelectedFile(null);
      setFilePreview(null);
      setIsCreateModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'posts');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <motion.main 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto px-6 pt-12 pb-32 relative"
    >
      <header className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-5xl font-black tracking-tight mb-2 text-on-surface">Feed</h1>
          <p className="text-on-surface-variant font-medium text-lg">Connect with the catalysts of change.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-primary-accent text-on-primary-accent px-5 py-3 rounded-full shadow-lg flex items-center gap-2 font-black uppercase tracking-widest text-[10px] border border-white/10 shrink-0 mt-2"
        >
          <Plus className="w-4 h-4" />
          <span>Share</span>
        </motion.button>
      </header>

      {/* Posts */}
      <div className="md:grid md:grid-cols-[1fr_300px] md:gap-8 md:items-start">
      <div className="space-y-8">
        {loadingPosts && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-accent" />
          </div>
        )}

        {postsError && !loadingPosts && (
          <div className="flex flex-col items-center text-center py-16 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-400/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-sm text-red-400 font-medium">{postsError}</p>
          </div>
        )}

        {!loadingPosts && !postsError && posts.map((post) => (
          <Card key={post.id} noPadding>
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar src={post.author.avatar} alt={post.author.name} size="sm" />
                <div>
                  <h4 className="font-bold text-on-surface">{post.author.name}</h4>
                  <p className="text-xs text-on-surface-variant">{post.author.role} @ {post.author.company}</p>
                </div>
              </div>
            </div>
            
            {post.media && (
              <div className="relative w-full aspect-[4/3] bg-surface-container-highest">
                {post.mediaType === 'video' ? (
                  <video 
                    src={post.media} 
                    controls 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img 
                    src={post.media} 
                    alt="Post content" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            )}

            <div className="p-5">
              <p className="text-sm leading-relaxed mb-4 text-on-surface">
                {post.content}
              </p>
              <div className="flex items-center justify-between mt-6">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => handleLike(post.id)}
                    className={`flex items-center gap-1.5 transition-colors ${likedPosts.has(post.id) ? 'text-primary-accent' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    <Heart className={`w-5 h-5 ${likedPosts.has(post.id) ? 'fill-current' : ''}`} />
                    <span className="text-xs font-bold">{post.likes}</span>
                  </button>
                  <button 
                    onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                    className={`flex items-center gap-1.5 transition-colors ${expandedPostId === post.id ? 'text-primary-accent' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-xs font-bold">{post.comments}</span>
                  </button>
                  <button 
                    onClick={() => handleShare(post)}
                    className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Inline Comments Section */}
              <AnimatePresence>
                {expandedPostId === post.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-6 pt-6 border-t border-white/5 space-y-6">
                      {/* Comment Input */}
                      <div className="flex items-center gap-3">
                        <Avatar src={user?.avatar || ''} alt={user?.name || ''} size="xs" />
                        <div className="flex-1 relative">
                          <input 
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                            placeholder="Add a comment..."
                            className="w-full bg-surface-container rounded-full py-2 px-4 pr-10 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary-accent outline-none transition-all"
                          />
                          <button 
                            onClick={() => handleAddComment(post.id)}
                            disabled={isSubmittingComment || !newComment.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-primary-accent disabled:opacity-30 transition-opacity"
                          >
                            {isSubmittingComment ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Comments List */}
                      <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {comments.map((comment) => (
                          <div key={comment.id} className="flex gap-2.5 group/comment">
                            <Avatar src={comment.authorAvatar} alt={comment.authorName} size="xs" />
                            <div className="flex-1 min-w-0">
                              {editingCommentId === comment.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editingCommentContent}
                                    onChange={(e) => setEditingCommentContent(e.target.value)}
                                    className="w-full bg-surface-container rounded-xl py-2 px-3 text-xs text-on-surface focus:ring-1 focus:ring-primary-accent outline-none resize-none"
                                    rows={2}
                                    autoFocus
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button 
                                      onClick={() => setEditingCommentId(null)}
                                      className="text-[10px] font-bold text-on-surface-variant hover:text-white transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button 
                                      onClick={() => handleUpdateComment(post.id, comment.id)}
                                      disabled={isSubmittingComment || !editingCommentContent.trim()}
                                      className="text-[10px] font-bold text-primary-accent hover:text-primary-accent/80 disabled:opacity-50 transition-colors"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="relative">
                                  <div className="bg-surface-container/50 rounded-2xl p-2.5">
                                    <div className="flex items-center justify-between gap-2 mb-0.5">
                                      <h5 className="text-[10px] font-bold text-white truncate">{comment.authorName}</h5>
                                      {comment.authorId === user?.id && (
                                        <div className="flex items-center gap-1.5 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                                          <button 
                                            onClick={() => {
                                              setEditingCommentId(comment.id);
                                              setEditingCommentContent(comment.content);
                                            }}
                                            className="p-1 text-on-surface-variant hover:text-primary-accent transition-colors"
                                            title="Edit comment"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                          <button 
                                            onClick={() => handleDeleteComment(post.id, comment.id)}
                                            className="p-1 text-on-surface-variant hover:text-red-400 transition-colors"
                                            title="Delete comment"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-xs text-on-surface leading-relaxed break-words">
                                      {comment.content}
                                      {comment.isEdited && (
                                        <span className="text-[9px] text-on-surface-variant/40 ml-1.5 italic">(edited)</span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {comments.length === 0 && (
                          <div className="text-center py-4">
                            <p className="text-[10px] text-on-surface-variant font-medium italic">No comments yet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        ))}

        {!loadingPosts && !postsError && posts.length === 0 && (
          <div className="text-center py-20">
            <p className="text-on-surface-variant font-medium italic">No posts yet. Be the first to share an insight.</p>
          </div>
        )}
      </div>

      {/* Desktop sidebar widget */}
      <aside className="hidden md:block sticky top-12 space-y-6">
        <div className="bg-surface-container-low rounded-2xl border border-white/5 p-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 mb-4">Trending Topics</h3>
          <div className="space-y-3">
            {['Carbon Capture', 'Green Hydrogen', 'ESG Reporting', 'Circular Economy', 'Net Zero Strategy'].map(topic => (
              <div key={topic} className="flex items-center justify-between">
                <span className="text-sm font-medium text-on-surface">{topic}</span>
                <span className="text-[10px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">Trending</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-2xl border border-white/5 p-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 mb-4">Your Profile</h3>
          {user && (
            <div className="flex items-center gap-3">
              <Avatar src={user.avatar} alt={user.name} size="sm" />
              <div>
                <p className="text-sm font-bold text-on-surface">{user.name}</p>
                <p className="text-xs text-on-surface-variant">{user.role}</p>
              </div>
            </div>
          )}
        </div>
      </aside>
      </div>

      {/* Create Post Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-surface-container-low/95 backdrop-blur-xl rounded-[32px] border border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <div className="px-8 pt-8 pb-4 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-accent mb-1">New Post</span>
                  <h3 className="text-2xl font-extrabold tracking-tighter text-white">Share Insight</h3>
                </div>
                <button 
                  onClick={() => setIsCreateModalOpen(false)} 
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-on-surface-variant hover:bg-white/10 hover:text-white transition-all active:scale-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="px-8 pb-8">
                <div className="flex gap-4 mt-6">
                  <Avatar src={user?.avatar || ''} alt={user?.name || ''} size="md" className="shrink-0" />
                  <div className="flex-1">
                    <textarea 
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder="What's happening in decarbonization?"
                      className="w-full bg-transparent border-none resize-none text-white placeholder:text-on-surface-variant/30 focus:ring-0 outline-none text-xl font-medium leading-tight min-h-[120px]"
                    />
                  </div>
                </div>
                
                {filePreview ? (
                  <div className="relative mt-4 rounded-2xl overflow-hidden aspect-video bg-surface-container-highest border border-white/10 group">
                    {selectedFile?.type.startsWith('video') ? (
                      <video src={filePreview} className="w-full h-full object-contain" />
                    ) : (
                      <img src={filePreview} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={() => {
                          setSelectedFile(null);
                          setFilePreview(null);
                        }}
                        className="w-12 h-12 bg-red-500 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-90 transition-all"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-dashed border-white/10 hover:border-primary-accent/50 hover:bg-primary-accent/5 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-primary-accent/10 flex items-center justify-center text-primary-accent group-hover:scale-110 transition-transform">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-white">Add media</p>
                        <p className="text-[10px] font-medium text-on-surface-variant/60 uppercase tracking-wider">Images or video up to 10MB</p>
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*,video/*"
                        className="hidden"
                      />
                    </button>
                  </div>
                )}

                <div className="mt-10 pt-6 border-t border-white/5">
                  <Button 
                    onClick={handleCreatePost}
                    disabled={isSubmitting || (!newPostContent.trim() && !selectedFile)}
                    className="w-full rounded-2xl py-5 h-auto text-base font-black uppercase tracking-[0.1em]"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Posting...</span>
                      </div>
                    ) : 'Post Insight'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Toast */}
      <AnimatePresence>
        {showShareToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] bg-primary-accent text-on-primary-accent px-6 py-3 rounded-full font-bold text-sm shadow-2xl flex items-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Link copied to clipboard!
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}
