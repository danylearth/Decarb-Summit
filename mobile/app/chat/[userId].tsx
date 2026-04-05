import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, TextInput, FlatList, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../context/UserContext';
import type { User } from '../../lib/types';
import { DEMO_USERS, DEMO_MESSAGES } from '../../lib/demoData';

type ProfileRow = { id: string; name: string; handle: string; role: string; company: string | null; avatar_url: string | null; is_online: boolean | null };
type MessageRow = { id: string; sender_id: string; receiver_id: string; content: string | null; is_read: boolean | null; created_at: string | null };

interface Message { id: string; content: string | null; sender: 'me' | 'them'; time: string; createdAt: string | null; isRead: boolean; }

function mapMsg(row: MessageRow, myId: string): Message {
  return { id: row.id, content: row.content, sender: row.sender_id === myId ? 'me' : 'them', time: row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now', createdAt: row.created_at, isRead: row.is_read ?? false };
}

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { user: currentUser, isDemo } = useUser();
  const [partner, setPartner] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!userId) return;
    if (isDemo) {
      const demoPartner = DEMO_USERS.find(u => u.id === userId) || DEMO_USERS[0];
      setPartner(demoPartner);
      setMessages(DEMO_MESSAGES.map(m => ({ ...m, createdAt: new Date().toISOString() })));
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.from('profiles').select('id, name, handle, role, company, avatar_url, is_online').eq('id', userId).single();
      if (data) {
        const p = data as ProfileRow;
        setPartner({ id: p.id, name: p.name, handle: p.handle, role: p.role, company: p.company || '', avatar: p.avatar_url || `https://picsum.photos/seed/${p.id}/200/200`, isOnline: p.is_online ?? false } as User);
      }
    })();
  }, [userId, isDemo]);

  const fetchMessages = useCallback(async () => {
    if (!currentUser?.id || !userId || isDemo) return;
    const { data } = await supabase.from('messages')
      .select('id, sender_id, receiver_id, content, is_read, created_at')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });
    if (data) setMessages((data as MessageRow[]).map(r => mapMsg(r, currentUser.id)));
    setLoading(false);
  }, [currentUser?.id, userId, isDemo]);

  useEffect(() => {
    if (!currentUser?.id || !userId || isDemo) return;
    fetchMessages();
    supabase.from('messages').update({ is_read: true }).eq('sender_id', userId).eq('receiver_id', currentUser.id).eq('is_read', false).then();
    const channel = supabase
      .channel(`chat-${[currentUser.id, userId].sort().join('-')}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${userId}` }, (payload) => {
        const row = payload.new as MessageRow;
        if (row.receiver_id === currentUser.id) {
          setMessages(prev => [...prev, mapMsg(row, currentUser.id)]);
          supabase.from('messages').update({ is_read: true }).eq('id', row.id).then();
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${currentUser.id}` }, (payload) => {
        const row = payload.new as MessageRow;
        if (row.receiver_id === userId) setMessages(prev => prev.some(m => m.id === row.id) ? prev : [...prev, mapMsg(row, currentUser.id)]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const u = payload.new as MessageRow;
        setMessages(prev => prev.map(m => m.id === u.id ? { ...m, isRead: u.is_read ?? false } : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id, userId, fetchMessages, isDemo]);

  const handleSend = async () => {
    if (!input.trim() || !currentUser?.id || !userId) return;
    const text = input;
    setInput('');
    if (isDemo) {
      setMessages(prev => [...prev, { id: `demo-${Date.now()}`, content: text, sender: 'me', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), createdAt: new Date().toISOString(), isRead: false }]);
      return;
    }
    await supabase.from('messages').insert({ sender_id: currentUser.id, receiver_id: userId, content: text });
  };

  const getDateLabel = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header — matches web ChatPage header */}
      <View style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 28, color: '#e2e8f0' }}>←</Text>
          </Pressable>
          <Pressable onPress={() => partner && router.push(`/profile/${partner.id}` as any)}>
            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 24, color: '#c6ee62' }}>ⓘ</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
          <View style={{ position: 'relative' }}>
            <Image source={{ uri: partner?.avatar || 'https://picsum.photos/100' }} style={{ width: 56, height: 56, borderRadius: 28 }} />
            {(partner as any)?.isOnline && (
              <View style={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#c6ee62', borderWidth: 2, borderColor: '#020617' }} />
            )}
          </View>
          <View>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 26, color: '#c6ee62', textTransform: 'uppercase', letterSpacing: -0.5 }}>
              {partner?.name || 'Loading...'}
            </Text>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 3, marginTop: 4, opacity: 0.8 }}>
              {partner?.role || ''}
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1" keyboardVerticalOffset={0}>
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#c6ee62" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 24, paddingBottom: 8 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(198,238,98,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                  <Text style={{ fontSize: 32, color: '#c6ee62' }}>📄</Text>
                </View>
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#fff', marginBottom: 8 }}>Send an Offer</Text>
                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: '#94a3b8', textAlign: 'center', maxWidth: 200 }}>
                  Initiate a deal by sending a message, attaching documents, or recording a voice note.
                </Text>
              </View>
            }
            renderItem={({ item: msg, index }) => {
              const showDate = index === 0 || (msg.createdAt && messages[index - 1]?.createdAt && new Date(msg.createdAt).toDateString() !== new Date(messages[index - 1].createdAt!).toDateString());
              return (
                <View>
                  {showDate && (
                    <View style={{ alignItems: 'center', marginVertical: 16 }}>
                      <View style={{ backgroundColor: 'rgba(5,10,48,0.5)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 4 }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2 }}>
                          {getDateLabel(msg.createdAt)}
                        </Text>
                      </View>
                    </View>
                  )}
                  <View style={{ marginBottom: 12, maxWidth: '85%', alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start' }}>
                    <View style={{
                      paddingHorizontal: 20, paddingVertical: 16, borderRadius: 24,
                      backgroundColor: msg.sender === 'me' ? '#c6ee62' : '#080e3d',
                      borderBottomRightRadius: msg.sender === 'me' ? 0 : 24,
                      borderBottomLeftRadius: msg.sender === 'them' ? 0 : 24,
                      borderWidth: msg.sender === 'them' ? 1 : 0,
                      borderColor: 'rgba(255,255,255,0.05)',
                    }}>
                      <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: msg.sender === 'me' ? '#1a2e05' : '#e2e8f0', lineHeight: 20 }}>
                        {msg.content}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start', paddingHorizontal: 8 }}>
                      <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: -0.5 }}>
                        {msg.time}
                      </Text>
                      {msg.sender === 'me' && (
                        <Text style={{ fontSize: 12, color: msg.isRead ? '#c6ee62' : 'rgba(148,163,184,0.6)' }}>
                          {msg.isRead ? '✓✓' : '✓'}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Input — matches web ChatPage footer */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: 'rgba(12,21,74,0.6)', padding: 8, paddingLeft: 16,
            borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
          }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Describe your offer..."
              placeholderTextColor="rgba(148,163,184,0.5)"
              style={{ flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: '#e2e8f0' }}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <Pressable
              onPress={handleSend}
              disabled={!input.trim()}
              style={{
                width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                backgroundColor: input.trim() ? '#c6ee62' : '#111b57',
                shadowColor: input.trim() ? '#c6ee62' : 'transparent',
                shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
              }}
            >
              <Text style={{ fontSize: 18, color: input.trim() ? '#1a2e05' : '#94a3b8' }}>↑</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
