import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Image, TextInput, FlatList, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../context/UserContext';
import type { User, Post, Comment } from '../../lib/types';
import { DEMO_POSTS } from '../../lib/demoData';

type PostRow = { id: string; author_id: string; content: string; media_url: string | null; media_type: string | null; likes_count: number | null; comments_count: number | null; is_sponsored: boolean | null; created_at: string | null; profiles: { id: string; name: string; handle: string; role: string; company: string | null; avatar_url: string | null } };

function mapPost(row: PostRow): Post & { author: User } {
  const p = row.profiles;
  return {
    id: row.id, content: row.content, media: row.media_url || undefined, mediaType: (row.media_type as any) || undefined,
    likes: row.likes_count ?? 0, comments: row.comments_count ?? 0, timestamp: row.created_at ? new Date(row.created_at).toLocaleString() : 'Just now',
    isSponsored: row.is_sponsored ?? false,
    author: { id: p.id, name: p.name, handle: p.handle, role: p.role, company: p.company || '', avatar: p.avatar_url || `https://picsum.photos/seed/${p.id}/100/100` } as User,
  };
}

const POST_SELECT = `*, profiles!author_id (id, name, handle, role, company, avatar_url)`;

export default function FeedScreen() {
  const { user, isDemo } = useUser();
  const [posts, setPosts] = useState<(Post & { author: User })[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPosts = useCallback(async () => {
    const { data } = await supabase.from('posts').select(POST_SELECT).order('created_at', { ascending: false });
    if (data) setPosts((data as PostRow[]).map(mapPost));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isDemo) { setPosts(DEMO_POSTS); setLoading(false); return; }
    fetchPosts();
    const channel = supabase.channel('posts-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
        const { data } = await supabase.from('posts').select(POST_SELECT).eq('id', payload.new.id).single();
        if (data) setPosts(prev => [mapPost(data as PostRow), ...prev]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (payload) => {
        setPosts(prev => prev.filter(p => p.id !== (payload.old as any).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts, isDemo]);

  useEffect(() => {
    if (!user || posts.length === 0 || isDemo) return;
    (async () => {
      const { data } = await supabase.from('post_likes').select('post_id').eq('user_id', user.id);
      if (data) setLikedPosts(new Set(data.map(r => r.post_id)));
    })();
  }, [user?.id, posts.length, isDemo]);

  useEffect(() => {
    if (!expandedPostId || isDemo) { setComments([]); return; }
    (async () => {
      const { data } = await supabase.from('post_comments').select('*, profiles!author_id (name, avatar_url)').eq('post_id', expandedPostId).order('created_at', { ascending: false });
      if (data) setComments(data.map(r => ({
        id: r.id, authorId: r.author_id, authorName: (r.profiles as any).name, authorAvatar: (r.profiles as any).avatar_url || '',
        content: r.content, timestamp: r.created_at ? new Date(r.created_at).toLocaleString() : 'Just now', isEdited: r.is_edited ?? false,
      })));
    })();
  }, [expandedPostId, isDemo]);

  const handleLike = async (postId: string) => {
    if (!user) return;
    const isLiked = likedPosts.has(postId);
    const newLiked = new Set(likedPosts);
    isLiked ? newLiked.delete(postId) : newLiked.add(postId);
    setLikedPosts(newLiked);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes + (isLiked ? -1 : 1) } : p));
    if (isDemo) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    try {
      if (isLiked) {
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
        await supabase.from('posts').update({ likes_count: Math.max(post.likes - 1, 0) }).eq('id', postId);
      } else {
        await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
        await supabase.from('posts').update({ likes_count: post.likes + 1 }).eq('id', postId);
      }
    } catch {}
  };

  const handleAddComment = async (postId: string) => {
    if (!user || !newComment.trim() || isDemo) return;
    await supabase.from('post_comments').insert({ post_id: postId, author_id: user.id, content: newComment });
    setNewComment('');
  };

  const handleCreatePost = async () => {
    if (!user || !newPostContent.trim()) return;
    setSubmitting(true);
    if (isDemo) {
      setPosts(prev => [{ id: `demo-new-${Date.now()}`, content: newPostContent, likes: 0, comments: 0, timestamp: 'Just now', author: { id: user.id, name: user.name, handle: user.handle, role: user.role, company: user.company, avatar: user.avatar } as User }, ...prev]);
    } else {
      await supabase.from('posts').insert({ author_id: user.id, content: newPostContent });
    }
    setNewPostContent('');
    setShowCreate(false);
    setSubmitting(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header — matches web FeedPage header */}
      <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 42, color: '#e2e8f0', letterSpacing: -1.5 }}>Feed</Text>
          <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 16, color: '#94a3b8', marginTop: 4 }}>Connect with the catalysts of change.</Text>
        </View>
        <Pressable
          onPress={() => setShowCreate(true)}
          style={{
            backgroundColor: '#c6ee62', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12,
            marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
            shadowColor: '#c6ee62', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20,
          }}
        >
          <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, color: '#1a2e05', letterSpacing: 3, textTransform: 'uppercase' }}>Share</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#c6ee62" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 32 }} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 80 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: '#94a3b8', fontStyle: 'italic' }}>
                No posts yet. Be the first to share an insight.
              </Text>
            </View>
          }
          renderItem={({ item: post }) => (
            <View style={{ backgroundColor: '#050a30', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
              {/* Author row */}
              <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Image source={{ uri: post.author.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                <View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#e2e8f0' }}>{post.author.name}</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#94a3b8' }}>{post.author.role} @ {post.author.company}</Text>
                </View>
              </View>

              {/* Media */}
              {post.media && (
                <Image source={{ uri: post.media }} style={{ width: '100%', aspectRatio: 4/3 }} resizeMode="cover" />
              )}

              {/* Content + actions */}
              <View style={{ padding: 20 }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: '#e2e8f0', lineHeight: 22, marginBottom: 16 }}>
                  {post.content}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 }}>
                  <Pressable onPress={() => handleLike(post.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 18, color: likedPosts.has(post.id) ? '#c6ee62' : '#94a3b8' }}>
                      {likedPosts.has(post.id) ? '♥' : '♡'}
                    </Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: likedPosts.has(post.id) ? '#c6ee62' : '#94a3b8' }}>{post.likes}</Text>
                  </Pressable>
                  <Pressable onPress={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 18, color: expandedPostId === post.id ? '#c6ee62' : '#94a3b8' }}>💬</Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: expandedPostId === post.id ? '#c6ee62' : '#94a3b8' }}>{post.comments}</Text>
                  </Pressable>
                </View>

                {/* Comments section */}
                {expandedPostId === post.id && (
                  <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <TextInput
                        value={newComment}
                        onChangeText={setNewComment}
                        placeholder="Add a comment..."
                        placeholderTextColor="rgba(148,163,184,0.4)"
                        style={{
                          flex: 1, backgroundColor: '#080e3d', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16,
                          fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#e2e8f0',
                        }}
                        onSubmitEditing={() => handleAddComment(post.id)}
                        returnKeyType="send"
                      />
                      <Pressable onPress={() => handleAddComment(post.id)}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#c6ee62' }}>Send</Text>
                      </Pressable>
                    </View>
                    {comments.map(c => (
                      <View key={c.id} style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: '#111b57' }}>
                          {c.authorAvatar ? <Image source={{ uri: c.authorAvatar }} style={{ width: 28, height: 28 }} /> : null}
                        </View>
                        <View style={{ flex: 1, backgroundColor: 'rgba(8,14,61,0.5)', borderRadius: 12, padding: 10 }}>
                          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: '#fff', marginBottom: 2 }}>{c.authorName}</Text>
                          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#e2e8f0' }}>
                            {c.content}{c.isEdited ? ' (edited)' : ''}
                          </Text>
                        </View>
                      </View>
                    ))}
                    {comments.length === 0 && (
                      <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 }}>
                        No comments yet.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          )}
        />
      )}

      {/* Create Post Modal — matches web modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end">
          <Pressable onPress={() => setShowCreate(false)} className="flex-1" />
          <View style={{
            backgroundColor: '#050a30',
            borderTopLeftRadius: 32, borderTopRightRadius: 32,
            borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
            padding: 32,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <View>
                <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, color: '#c6ee62', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>New Post</Text>
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: '#fff', letterSpacing: -1 }}>Share Insight</Text>
              </View>
              <Pressable onPress={() => setShowCreate(false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#94a3b8', fontSize: 20 }}>✕</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 16, marginTop: 24 }}>
              <Image source={{ uri: user?.avatar || 'https://picsum.photos/100' }} style={{ width: 48, height: 48, borderRadius: 24 }} />
              <TextInput
                value={newPostContent}
                onChangeText={setNewPostContent}
                placeholder="What's happening in decarbonization?"
                placeholderTextColor="rgba(148,163,184,0.3)"
                multiline
                style={{
                  flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 18, color: '#fff',
                  minHeight: 120, textAlignVertical: 'top',
                }}
              />
            </View>

            <View style={{ marginTop: 40, paddingTop: 24, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
              <Pressable
                onPress={handleCreatePost}
                disabled={submitting || !newPostContent.trim()}
                style={{
                  backgroundColor: newPostContent.trim() ? '#c6ee62' : '#111b57',
                  borderRadius: 16, paddingVertical: 20, alignItems: 'center',
                }}
              >
                <Text style={{
                  fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14,
                  color: newPostContent.trim() ? '#1a2e05' : '#94a3b8',
                  letterSpacing: 2, textTransform: 'uppercase',
                }}>
                  {submitting ? 'Posting...' : 'Post Insight'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
