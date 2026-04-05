import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../context/UserContext';
import type { User } from '../../lib/types';
import { DEMO_USERS, DEMO_CONVERSATIONS } from '../../lib/demoData';

type ConnectionRow = { id: string; user_id: string; other_user_id: string; status: string; created_at: string | null };
type ProfileRow = { id: string; name: string; handle: string; role: string; company: string | null; avatar_url: string | null; bio: string | null; tags: string[] | null; is_online: boolean | null; is_verified: boolean | null };

function toUser(p: ProfileRow): User {
  return { id: p.id, name: p.name, handle: p.handle, role: p.role, company: p.company || '', avatar: p.avatar_url || `https://picsum.photos/seed/${p.id}/200/200`, bio: p.bio || '', tags: p.tags || [], isOnline: p.is_online ?? false, isVerified: p.is_verified ?? false };
}

export default function ConnectionsScreen() {
  const router = useRouter();
  const { user: currentUser, isDemo } = useUser();
  const [tab, setTab] = useState<'discovery' | 'messages'>('discovery');
  const [discoveryUsers, setDiscoveryUsers] = useState<User[]>([]);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [acceptedMatches, setAcceptedMatches] = useState<User[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!currentUser?.id || isDemo) return;
    const { data } = await supabase.from('connections').select('*').or(`user_id.eq.${currentUser.id},other_user_id.eq.${currentUser.id}`);
    setConnections((data ?? []) as ConnectionRow[]);
  }, [currentUser?.id, isDemo]);

  useEffect(() => {
    if (isDemo) {
      setDiscoveryUsers(DEMO_USERS);
      setAcceptedMatches(DEMO_USERS.slice(0, 3));
      setConversations(DEMO_CONVERSATIONS.map(c => ({ ...c, displayTime: c.timestamp })));
      setLoading(false);
      return;
    }
    fetchConnections();
  }, [fetchConnections, isDemo]);

  // Discovery users (non-demo)
  useEffect(() => {
    if (!currentUser?.id || isDemo) return;
    setLoading(true);
    (async () => {
      const connectedIds = new Set<string>();
      connections.forEach(c => {
        if (c.user_id === currentUser.id) connectedIds.add(c.other_user_id);
        if (c.other_user_id === currentUser.id) connectedIds.add(c.user_id);
      });
      const { data, error: err } = await supabase.from('profiles').select('id, name, handle, role, company, avatar_url, bio, tags, is_online, is_verified').neq('id', currentUser.id).limit(50);
      if (err) { setError('Failed to load connections.'); setLoading(false); return; }
      setDiscoveryUsers((data as ProfileRow[]).map(toUser).filter(u => !connectedIds.has(u.id)));
      setCurrentIndex(0);
      setError(null);
      setLoading(false);
    })();
  }, [currentUser?.id, connections, isDemo]);

  // Accepted matches (non-demo)
  useEffect(() => {
    if (!currentUser?.id || isDemo) return;
    (async () => {
      const accepted = connections.filter(c => c.status === 'accepted');
      const ids = accepted.map(c => c.user_id === currentUser.id ? c.other_user_id : c.user_id);
      if (ids.length === 0) { setAcceptedMatches([]); return; }
      const { data } = await supabase.from('profiles').select('id, name, handle, role, company, avatar_url, bio, tags, is_online, is_verified').in('id', ids);
      setAcceptedMatches((data as ProfileRow[]).map(toUser));
    })();
  }, [currentUser?.id, connections, isDemo]);

  // Conversations (non-demo)
  useEffect(() => {
    if (!currentUser?.id || isDemo) return;
    (async () => {
      const { data: messages } = await supabase.from('messages').select('id, sender_id, receiver_id, content, is_read, created_at').or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`).order('created_at', { ascending: false });
      const convMap = new Map<string, any>();
      (messages ?? []).forEach(msg => {
        const otherId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
        if (!convMap.has(otherId)) convMap.set(otherId, { id: msg.id, lastMessage: msg.content, timestamp: msg.created_at, isUnread: !msg.is_read && msg.receiver_id === currentUser.id });
      });
      if (convMap.size === 0) { setConversations([]); return; }
      const { data: partners } = await supabase.from('profiles').select('id, name, handle, role, company, avatar_url, bio, tags, is_online, is_verified').in('id', Array.from(convMap.keys()));
      const partnerMap = new Map<string, User>();
      (partners as ProfileRow[]).forEach(p => partnerMap.set(p.id, toUser(p)));
      const convs: any[] = [];
      convMap.forEach((conv, pid) => {
        const u = partnerMap.get(pid);
        if (!u) return;
        convs.push({ ...conv, otherUser: u, displayTime: conv.timestamp ? new Date(conv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now' });
      });
      convs.sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      setConversations(convs);
    })();
  }, [currentUser?.id, isDemo]);

  const activeUser = discoveryUsers[currentIndex];

  const handleLike = async (target: User) => {
    if (!currentUser?.id) return;
    setDiscoveryUsers(prev => prev.filter(u => u.id !== target.id));
    if (isDemo) return;
    try {
      const reverse = connections.find(c => c.user_id === target.id && c.other_user_id === currentUser.id && c.status === 'pending');
      if (reverse) {
        await supabase.from('connections').insert({ user_id: currentUser.id, other_user_id: target.id, status: 'accepted' });
        await supabase.from('connections').update({ status: 'accepted' }).eq('id', reverse.id);
      } else {
        await supabase.from('connections').insert({ user_id: currentUser.id, other_user_id: target.id, status: 'pending' });
      }
      fetchConnections();
    } catch { setDiscoveryUsers(prev => [...prev, target]); }
  };

  const handleReject = async () => {
    if (!activeUser || !currentUser?.id) return;
    const target = activeUser;
    setDiscoveryUsers(prev => prev.filter(u => u.id !== target.id));
    if (isDemo) return;
    await supabase.from('connections').insert({ user_id: currentUser.id, other_user_id: target.id, status: 'rejected' });
    fetchConnections();
  };

  const handleOffer = () => {
    if (!activeUser) return;
    handleLike(activeUser);
    router.push(`/chat/${activeUser.id}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: '#c6ee62', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>
          Network
        </Text>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 36, color: '#e2e8f0', letterSpacing: -1.5 }}>
          Connections
        </Text>
      </View>

      {/* Tab toggle */}
      <View style={{ marginHorizontal: 24, marginBottom: 16, backgroundColor: '#050a30', padding: 6, borderRadius: 999, flexDirection: 'row' }}>
        <Pressable
          onPress={() => setTab('discovery')}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 999,
            alignItems: 'center',
            backgroundColor: tab === 'discovery' ? '#c6ee62' : 'transparent',
          }}
        >
          <Text style={{
            fontFamily: 'PlusJakartaSans_700Bold',
            fontSize: 11,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: tab === 'discovery' ? '#1a2e05' : 'rgba(226,232,240,0.5)',
          }}>
            Match
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('messages')}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 999,
            alignItems: 'center',
            backgroundColor: tab === 'messages' ? '#c6ee62' : 'transparent',
          }}
        >
          <Text style={{
            fontFamily: 'PlusJakartaSans_700Bold',
            fontSize: 11,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: tab === 'messages' ? '#1a2e05' : 'rgba(226,232,240,0.5)',
          }}>
            Conversations
          </Text>
        </Pressable>
      </View>

      {tab === 'discovery' ? (
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 16 }}>
          {loading ? (
            <ActivityIndicator size="large" color="#c6ee62" />
          ) : error ? (
            <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: '#f87171' }}>{error}</Text>
          ) : activeUser ? (
            <View style={{ width: '100%', height: 550, borderRadius: 16, overflow: 'hidden', backgroundColor: '#080e3d' }}>
              <ImageBackground
                source={{ uri: activeUser.avatar }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              >
                {/* Gradient overlay */}
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%', backgroundColor: 'rgba(2,6,23,0.95)' }} />
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 32, gap: 12 }}>
                  {/* Name + verified */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 32, color: '#fff', letterSpacing: -1 }}>
                      {activeUser.name}
                    </Text>
                    {activeUser.isVerified && (
                      <View style={{ backgroundColor: 'rgba(198,238,98,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 9, color: '#c6ee62', letterSpacing: 1, textTransform: 'uppercase' }}>Verified</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#c6ee62' }}>
                    {activeUser.role} @ {activeUser.company}
                  </Text>

                  {/* Tags */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {activeUser.tags?.map(tag => (
                      <View key={tag} style={{ backgroundColor: 'rgba(17,27,87,0.9)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#94a3b8' }}>{tag}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 20 }} numberOfLines={2}>
                    {activeUser.bio || 'No bio provided.'}
                  </Text>

                  {/* Action buttons */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingTop: 16 }}>
                    <Pressable
                      onPress={handleReject}
                      style={{
                        width: 64, height: 64, borderRadius: 32,
                        backgroundColor: 'rgba(17,27,87,0.4)',
                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 28, color: '#f87171' }}>✕</Text>
                    </Pressable>

                    <Pressable
                      onPress={handleOffer}
                      style={{
                        flex: 1,
                        backgroundColor: '#c6ee62',
                        paddingVertical: 16,
                        borderRadius: 999,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: '#1a2e05', letterSpacing: 3, textTransform: 'uppercase' }}>
                        OFFER
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleLike(activeUser)}
                      style={{
                        width: 64, height: 64, borderRadius: 32,
                        backgroundColor: 'rgba(17,27,87,0.4)',
                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 28, color: '#c6ee62' }}>★</Text>
                    </Pressable>
                  </View>
                </View>
              </ImageBackground>
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: 16 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: '#94a3b8', fontStyle: 'italic' }}>
                No more catalysts found in your area.
              </Text>
              <Pressable onPress={() => { setCurrentIndex(0); fetchConnections(); }} style={{ backgroundColor: '#c6ee62', borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11, color: '#1a2e05', letterSpacing: 2, textTransform: 'uppercase' }}>Refresh</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Active Matches */}
          <View style={{ marginBottom: 32 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: 'rgba(226,232,240,0.6)', letterSpacing: 2, textTransform: 'uppercase' }}>
                Active Matches
              </Text>
              <View style={{ backgroundColor: 'rgba(198,238,98,0.1)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: '#c6ee62' }}>{acceptedMatches.length} MATCHED</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 24 }}>
                {acceptedMatches.length === 0 ? (
                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: 'rgba(148,163,184,0.6)', fontStyle: 'italic' }}>
                    No matches yet. Start swiping to connect!
                  </Text>
                ) : acceptedMatches.map(u => (
                  <Pressable key={u.id} onPress={() => router.push(`/chat/${u.id}`)} style={{ alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: '#c6ee62', padding: 2 }}>
                      <Image source={{ uri: u.avatar }} style={{ width: '100%', height: '100%', borderRadius: 34 }} />
                    </View>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#e2e8f0' }}>
                      {u.name.split(' ')[0]} {u.name.split(' ')[1]?.[0]}.
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Recent Messages */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: 'rgba(226,232,240,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 24 }}>
              Recent Messages
            </Text>

            {conversations.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 48, backgroundColor: 'rgba(5,10,48,0.2)', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.05)' }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: '#94a3b8', fontStyle: 'italic' }}>
                  No conversations yet.
                </Text>
                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: 'rgba(148,163,184,0.6)', marginTop: 4 }}>
                  Start by sending an offer to someone.
                </Text>
              </View>
            ) : conversations.map((conv: any) => (
              <Pressable
                key={conv.id}
                onPress={() => router.push(`/chat/${conv.otherUser.id}`)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                  padding: 20,
                  borderRadius: 16,
                  marginBottom: 12,
                  backgroundColor: conv.isUnread ? '#050a30' : 'rgba(5,10,48,0.4)',
                }}
              >
                <View style={{ position: 'relative' }}>
                  <Image source={{ uri: conv.otherUser.avatar }} style={{ width: 48, height: 48, borderRadius: 24 }} />
                  {conv.isUnread && (
                    <View style={{ position: 'absolute', top: -4, right: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: '#c6ee62' }} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <Text style={{ fontFamily: conv.isUnread ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_700Bold', fontSize: 14, color: '#e2e8f0' }} numberOfLines={1}>
                      {conv.otherUser.name}
                    </Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: conv.isUnread ? '#c6ee62' : 'rgba(226,232,240,0.4)', textTransform: 'uppercase' }}>
                      {conv.displayTime}
                    </Text>
                  </View>
                  <Text
                    style={{ fontFamily: conv.isUnread ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_400Regular', fontSize: 13, color: conv.isUnread ? '#e2e8f0' : 'rgba(226,232,240,0.6)' }}
                    numberOfLines={1}
                  >
                    {conv.lastMessage}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
