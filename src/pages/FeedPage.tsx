import { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { Post, User, Comment } from '../types';
import { Avatar, Card, Button } from '../components/UI';
import { Heart, MessageCircle, Share2, Plus, X, Image as ImageIcon, Loader2, Send, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Shape returned by Supabase posts query with joined profiles
type PostRow = {
  id: string;
  author_id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  likes_count: number | null;
  comments_count: number | null;
  is_sponsored: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  profiles: {
    id: string;
    name: string;
    handle: string;
    role: string;
    company: string | null;
    avatar_url: string | null;
  };
};

function mapPostRow(row: PostRow): Post & { author: User } {
  const p = row.profiles;
  return {
    id: row.id,
    content: row.content,
    media: row.media_url || undefined,
    mediaType: (row.media_type as 'image' | 'video') || undefined,
    likes: row.likes_count ?? 0,
    comments: row.comments_count ?? 0,
    timestamp: row.created_at ? new Date(row.created_at).toLocaleString() : 'Just now',
    isSponsored: row.is_sponsored ?? false,
    author: {
      id: p.id,
      name: p.name,
      handle: p.handle,
      role: p.role,
      company: p.company || '',
      avatar: p.avatar_url || `https://picsum.photos/seed/${p.id}/100/100`,
    } as User,
  };
}

const POST_SELECT = `*, profiles!author_id (id, name, handle, role, company, avatar_url)`;

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

  // ── Fetch posts + real-time subscription ───────────────────────────
  const fetchPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .order('created_at', { ascending: false });

    if (error) {
      setPostsError('Failed to load posts. Please try again.');
      console.error('Posts fetch error:', error);
    } else {
      setPosts((data as PostRow[]).map(mapPostRow));
      setPostsError(null);
    }
    setLoadingPosts(false);
  }, []);

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel('posts-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          // Fetch the new post with author join
          const { data } = await supabase
            .from('posts')
            .select(POST_SELECT)
            .eq('id', payload.new.id)
            .single();
          if (data) {
            setPosts((prev) => [mapPostRow(data as PostRow), ...prev]);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts' },
        (payload) => {
          const updated = payload.new as { id: string; likes_count: number; comments_count: number; content: string; media_url: string | null; media_type: string | null };
          setPosts((prev) =>
            prev.map((p) =>
              p.id === updated.id
                ? {
                    ...p,
                    likes: updated.likes_count ?? p.likes,
                    comments: updated.comments_count ?? p.comments,
                    content: updated.content ?? p.content,
                    media: updated.media_url || p.media,
                    mediaType: (updated.media_type as 'image' | 'video') || p.mediaType,
                  }
                : p,
            ),
          );
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts' },
        (payload) => {
          setPosts((prev) => prev.filter((p) => p.id !== (payload.old as { id: string }).id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts]);

  // ── Fetch current user's likes ─────────────────────────────────────
  useEffect(() => {
    if (!user || posts.length === 0) return;

    const fetchLikes = async () => {
      const { data } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user.id);
      if (data) {
        setLikedPosts(new Set(data.map((row) => row.post_id)));
      }
    };

    fetchLikes();
  }, [user?.id, posts.length]);

  // ── Fetch comments + real-time when a post is expanded ─────────────
  useEffect(() => {
    if (!expandedPostId) {
      setComments([]);
      return;
    }

    const fetchComments = async () => {
      const { data, error } = await supabase
        .from('post_comments')
        .select('*, profiles!author_id (name, avatar_url)')
        .eq('post_id', expandedPostId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setComments(
          data.map((row) => ({
            id: row.id,
            authorId: row.author_id,
            authorName: (row.profiles as { name: string; avatar_url: string | null }).name,
            authorAvatar: (row.profiles as { name: string; avatar_url: string | null }).avatar_url || '',
            content: row.content,
            timestamp: row.created_at ? new Date(row.created_at).toLocaleString() : 'Just now',
            isEdited: row.is_edited ?? false,
          })),
        );
      }
    };

    fetchComments();

    const channel = supabase
      .channel(`comments-${expandedPostId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${expandedPostId}` },
        () => {
          // Refetch all comments for this post on any change (simpler than partial merge)
          fetchComments();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [expandedPostId]);

  // ── Like toggle ────────────────────────────────────────────────────
  const handleLike = async (postId: string) => {
    if (!user) return;
    const isLiked = likedPosts.has(postId);
    const currentPost = posts.find((p) => p.id === postId);
    if (!currentPost) return;

    // Optimistic update
    const prevLiked = new Set(likedPosts);
    const newLiked = new Set(likedPosts);
    if (isLiked) {
      newLiked.delete(postId);
    } else {
      newLiked.add(postId);
    }
    setLikedPosts(newLiked);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, likes: p.likes + (isLiked ? -1 : 1) } : p,
      ),
    );

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        if (error) throw error;

        await supabase
          .from('posts')
          .update({ likes_count: Math.max((currentPost.likes ?? 0) - 1, 0) })
          .eq('id', postId);
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id });
        if (error) throw error;

        await supabase
          .from('posts')
          .update({ likes_count: (currentPost.likes ?? 0) + 1 })
          .eq('id', postId);
      }
    } catch (err) {
      // Rollback
      setLikedPosts(prevLiked);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likes: currentPost.likes } : p,
        ),
      );
      console.error('Like toggle error:', err);
    }
  };

  // ── Add comment ────────────────────────────────────────────────────
  const handleAddComment = async (postId: string) => {
    if (!user || !newComment.trim()) return;
    setIsSubmittingComment(true);

    try {
      const { error } = await supabase.from('post_comments').insert({
        post_id: postId,
        author_id: user.id,
        content: newComment,
      });
      if (error) throw error;

      // Update comments count on the post
      const currentPost = posts.find((p) => p.id === postId);
      if (currentPost) {
        await supabase
          .from('posts')
          .update({ comments_count: (currentPost.comments ?? 0) + 1 })
          .eq('id', postId);
      }

      setNewComment('');
    } catch (err) {
      console.error('Add comment error:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // ── Delete comment ─────────────────────────────────────────────────
  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId);
      if (error) throw error;

      const currentPost = posts.find((p) => p.id === postId);
      if (currentPost) {
        await supabase
          .from('posts')
          .update({ comments_count: Math.max((currentPost.comments ?? 0) - 1, 0) })
          .eq('id', postId);
      }
    } catch (err) {
      console.error('Delete comment error:', err);
    }
  };

  // ── Update comment ─────────────────────────────────────────────────
  const handleUpdateComment = async (_postId: string, commentId: string) => {
    if (!user || !editingCommentContent.trim()) return;
    setIsSubmittingComment(true);
    try {
      const { error } = await supabase
        .from('post_comments')
        .update({ content: editingCommentContent, is_edited: true })
        .eq('id', commentId);
      if (error) throw error;

      setEditingCommentId(null);
      setEditingCommentContent('');
    } catch (err) {
      console.error('Update comment error:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // ── Share ──────────────────────────────────────────────────────────
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
      try {
        await navigator.clipboard.writeText(shareData.url);
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 3000);
      } catch (err) {
        console.error('Failed to copy link:', err);
      }
    }
  };

  // ── File upload state (media upload stays on Firebase Storage — migrated in P2.27) ──
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
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

  // ── Create post ────────────────────────────────────────────────────
  const handleCreatePost = async () => {
    if (!user || (!newPostContent.trim() && !selectedFile)) return;
    setIsSubmitting(true);

    try {
      let mediaUrl: string | null = null;
      let mediaType: 'image' | 'video' | null = null;

      // Media upload still uses Firebase Storage (P2.27 will migrate to Supabase Storage)
      if (selectedFile) {
        const fileRef = ref(storage, `posts/${user.id}/${Date.now()}_${selectedFile.name}`);
        const uploadResult = await uploadBytes(fileRef, selectedFile);
        mediaUrl = await getDownloadURL(uploadResult.ref);
        mediaType = selectedFile.type.startsWith('video') ? 'video' : 'image';
      }

      const { error } = await supabase.from('posts').insert({
        author_id: user.id,
        content: newPostContent,
        media_url: mediaUrl,
        media_type: mediaType,
      });
      if (error) throw error;

      setNewPostContent('');
      setSelectedFile(null);
      setFilePreview(null);
      setIsCreateModalOpen(false);
    } catch (err) {
      console.error('Create post error:', err);
    } finally {
      setIsSubmitting(false);
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
