import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Image, ActivityIndicator, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../context/UserContext';
import type { Event, Question } from '../../lib/types';

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const { user } = useUser();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data } = await supabase.from('events').select('*').eq('id', sessionId).single();
      if (data) setEvent(data as Event);
      setLoading(false);
    })();
  }, [sessionId]);

  useEffect(() => {
    if (!user || !sessionId) return;
    (async () => {
      const [bRes, cRes] = await Promise.all([
        supabase.from('event_bookmarks').select('event_id').eq('user_id', user.id).eq('event_id', sessionId).maybeSingle(),
        supabase.from('event_checkins').select('event_id').eq('user_id', user.id).eq('event_id', sessionId).maybeSingle(),
      ]);
      setIsBookmarked(!!bRes.data);
      setIsCheckedIn(!!cRes.data);
    })();
  }, [user?.id, sessionId]);

  const fetchQuestions = useCallback(async () => {
    if (!sessionId) return;
    const { data } = await supabase
      .from('questions')
      .select('*, profiles!author_id (name, avatar_url)')
      .eq('event_id', sessionId)
      .order('is_highlighted', { ascending: false })
      .order('upvotes', { ascending: false });
    if (data) {
      setQuestions(data.map((r: any) => ({
        id: r.id, event_id: r.event_id, author_id: r.author_id,
        authorName: r.profiles?.name || 'Anonymous', authorAvatar: r.profiles?.avatar_url || '',
        content: r.content, upvotes: r.upvotes ?? 0, is_highlighted: r.is_highlighted ?? false, created_at: r.created_at,
      })));
    }
  }, [sessionId]);

  useEffect(() => {
    fetchQuestions();
    if (!sessionId) return;
    const ch = supabase.channel(`q-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions', filter: `event_id=eq.${sessionId}` }, fetchQuestions)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, fetchQuestions]);

  const handleBookmark = async () => {
    if (!user || !sessionId) return;
    const prev = isBookmarked;
    setIsBookmarked(!prev);
    try {
      if (prev) await supabase.from('event_bookmarks').delete().eq('user_id', user.id).eq('event_id', sessionId);
      else await supabase.from('event_bookmarks').insert({ user_id: user.id, event_id: sessionId });
    } catch { setIsBookmarked(prev); }
  };

  const handleCheckIn = async () => {
    if (!user || !sessionId || isCheckedIn) return;
    setIsCheckedIn(true);
    try {
      await supabase.from('event_checkins').insert({ user_id: user.id, event_id: sessionId });
    } catch { setIsCheckedIn(false); }
  };

  const handleSubmitQuestion = async () => {
    if (!user || !sessionId || !newQuestion.trim()) return;
    setSubmitting(true);
    await supabase.from('questions').insert({ event_id: sessionId, author_id: user.id, content: newQuestion });
    setNewQuestion('');
    setSubmitting(false);
  };

  const handleUpvote = async (qId: string, current: number) => {
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, upvotes: q.upvotes + 1 } : q));
    await supabase.from('questions').update({ upvotes: current + 1 }).eq('id', qId);
  };

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  if (loading) {
    return <SafeAreaView className="flex-1 bg-background items-center justify-center"><ActivityIndicator size="large" color="#c6ee62" /></SafeAreaView>;
  }

  if (!event) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-red-400 text-sm mb-4">Session not found.</Text>
        <Pressable onPress={() => router.back()} className="border border-white/10 rounded-full px-6 py-3">
          <Text className="text-on-surface text-xs font-bold uppercase tracking-widest">Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        {/* Back */}
        <Pressable onPress={() => router.back()} className="mb-6">
          <Text className="text-on-surface-variant text-sm">← Schedule</Text>
        </Pressable>

        {/* Header */}
        {event.track && (
          <View className="bg-primary-accent/20 self-start rounded-full px-3 py-1 mb-3">
            <Text className="text-primary-accent text-[10px] font-bold uppercase tracking-wider">{event.track}</Text>
          </View>
        )}
        <Text className="text-3xl font-black tracking-tight text-white mb-3">{event.title}</Text>
        <View className="gap-2 mb-6">
          <Text className="text-sm text-on-surface-variant">🕐 {fmtDate(event.starts_at)} · {fmt(event.starts_at)} – {fmt(event.ends_at)}</Text>
          {event.room && <Text className="text-sm text-on-surface-variant">📍 {event.room}</Text>}
          {event.speaker && <Text className="text-sm text-on-surface-variant">👤 {event.speaker}</Text>}
        </View>

        {/* Action buttons */}
        <View className="flex-row gap-3 mb-8">
          <Pressable onPress={handleBookmark}
            className={`flex-1 py-3 rounded-full items-center ${isBookmarked ? 'bg-primary-accent' : 'border border-white/10'}`}>
            <Text className={`text-xs font-bold uppercase tracking-widest ${isBookmarked ? 'text-background' : 'text-on-surface'}`}>
              {isBookmarked ? '★ Bookmarked' : '☆ Bookmark'}
            </Text>
          </Pressable>
          <Pressable onPress={handleCheckIn} disabled={isCheckedIn}
            className={`flex-1 py-3 rounded-full items-center ${isCheckedIn ? 'bg-primary-accent' : 'border border-white/10'}`}>
            <Text className={`text-xs font-bold uppercase tracking-widest ${isCheckedIn ? 'text-background' : 'text-on-surface'}`}>
              {isCheckedIn ? '✓ Checked In' : 'Check In'}
            </Text>
          </Pressable>
        </View>

        {/* Description */}
        {event.description && (
          <View className="mb-8">
            <Text className="text-on-surface-variant/40 text-[10px] font-black uppercase tracking-widest mb-3">About</Text>
            <Text className="text-on-surface-variant text-sm leading-5">{event.description}</Text>
          </View>
        )}

        {/* Q&A */}
        <Text className="text-on-surface-variant/40 text-[10px] font-black uppercase tracking-widest mb-4">Live Q&A ({questions.length})</Text>

        <View className="flex-row items-center gap-2 mb-6">
          <TextInput
            value={newQuestion}
            onChangeText={setNewQuestion}
            placeholder="Ask a question..."
            placeholderTextColor="rgba(148,163,184,0.4)"
            className="flex-1 bg-surface-container rounded-full py-3 px-5 text-sm text-on-surface"
            onSubmitEditing={handleSubmitQuestion}
            returnKeyType="send"
          />
          <Pressable onPress={handleSubmitQuestion} disabled={submitting || !newQuestion.trim()}
            className={`w-10 h-10 rounded-full items-center justify-center ${newQuestion.trim() ? 'bg-primary-accent' : 'bg-surface-container-highest'}`}>
            <Text className={newQuestion.trim() ? 'text-background' : 'text-on-surface-variant'}>↑</Text>
          </Pressable>
        </View>

        {questions.map(q => (
          <View key={q.id} className={`mb-3 p-4 rounded-xl border ${q.is_highlighted ? 'bg-primary-accent/10 border-primary-accent/30' : 'bg-surface-container-low border-white/5'}`}>
            <View className="flex-row items-start gap-3">
              <View className="w-8 h-8 rounded-full overflow-hidden bg-surface-container-highest">
                {q.authorAvatar ? <Image source={{ uri: q.authorAvatar }} className="w-full h-full" /> : null}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className="text-xs font-bold text-white">{q.authorName}</Text>
                  {q.is_highlighted && (
                    <View className="bg-primary-accent rounded px-1.5 py-0.5">
                      <Text className="text-background text-[9px] font-black uppercase">Pinned</Text>
                    </View>
                  )}
                </View>
                <Text className="text-sm text-on-surface">{q.content}</Text>
              </View>
              <Pressable onPress={() => handleUpvote(q.id, q.upvotes)} className="items-center">
                <Text className="text-on-surface-variant text-xs">★</Text>
                <Text className="text-on-surface-variant text-xs font-bold">{q.upvotes}</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {questions.length === 0 && <Text className="text-on-surface-variant/40 text-sm italic text-center py-6">No questions yet. Be the first!</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}
