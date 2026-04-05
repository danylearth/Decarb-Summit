import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../context/UserContext';
import type { Event } from '../../lib/types';
import { DEMO_EVENTS } from '../../lib/demoData';

export default function ScheduleScreen() {
  const router = useRouter();
  const { user, isDemo } = useUser();
  const [events, setEvents] = useState<Event[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'schedule' | 'agenda'>('schedule');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (isDemo) { setEvents(DEMO_EVENTS); setLoading(false); return; }
    const { data } = await supabase.from('events').select('*').order('starts_at', { ascending: true });
    if (data) setEvents(data as Event[]);
    setLoading(false);
  }, [isDemo]);

  const fetchBookmarks = useCallback(async () => {
    if (!user || isDemo) return;
    const { data } = await supabase.from('event_bookmarks').select('event_id').eq('user_id', user.id);
    if (data) setBookmarkedIds(new Set(data.map(r => r.event_id)));
  }, [user?.id, isDemo]);

  useEffect(() => {
    fetchEvents();
    fetchBookmarks();
    if (isDemo) return;
    const ch = supabase.channel('events-mobile').on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, fetchEvents).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchEvents, fetchBookmarks, isDemo]);

  const days = [...new Set(events.map(e => new Date(e.starts_at).toDateString()))];
  useEffect(() => { if (days.length > 0 && !selectedDay) setSelectedDay(days[0]); }, [days.length]);

  const dayEvents = events.filter(e => selectedDay && new Date(e.starts_at).toDateString() === selectedDay);
  const bookmarkedEvents = events.filter(e => bookmarkedIds.has(e.id));

  const checkConflict = (evt: Event): string | null => {
    const s = new Date(evt.starts_at).getTime(), en = new Date(evt.ends_at).getTime();
    for (const e of bookmarkedEvents) {
      if (e.id === evt.id) continue;
      if (s < new Date(e.ends_at).getTime() && en > new Date(e.starts_at).getTime()) return `Overlaps with "${e.title}"`;
    }
    return null;
  };

  const handleBookmark = async (event: Event) => {
    if (!user) return;
    const isB = bookmarkedIds.has(event.id);
    if (!isB) {
      const c = checkConflict(event);
      if (c) { setConflictWarning(c); setTimeout(() => setConflictWarning(null), 4000); }
    }
    const next = new Set(bookmarkedIds);
    isB ? next.delete(event.id) : next.add(event.id);
    setBookmarkedIds(next);
    if (isDemo) return;
    try {
      if (isB) await supabase.from('event_bookmarks').delete().eq('user_id', user.id).eq('event_id', event.id);
      else await supabase.from('event_bookmarks').insert({ user_id: user.id, event_id: event.id });
    } catch { fetchBookmarks(); }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fmtDay = (d: string) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  const displayEvents = tab === 'agenda' ? bookmarkedEvents : dayEvents;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header — matches web SchedulePage */}
      <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: '#c6ee62', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>
          Summit Program
        </Text>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 42, color: '#e2e8f0', letterSpacing: -1.5 }}>
          Schedule
        </Text>
      </View>

      {/* Tab toggle */}
      <View style={{ marginHorizontal: 24, marginBottom: 16, backgroundColor: '#050a30', padding: 6, borderRadius: 999, flexDirection: 'row' }}>
        <Pressable
          onPress={() => setTab('schedule')}
          style={{ flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center', backgroundColor: tab === 'schedule' ? '#c6ee62' : 'transparent' }}
        >
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: tab === 'schedule' ? '#1a2e05' : 'rgba(226,232,240,0.5)' }}>
            All Sessions
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('agenda')}
          style={{ flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center', backgroundColor: tab === 'agenda' ? '#c6ee62' : 'transparent' }}
        >
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: tab === 'agenda' ? '#1a2e05' : 'rgba(226,232,240,0.5)' }}>
            My Agenda ({bookmarkedIds.size})
          </Text>
        </Pressable>
      </View>

      {/* Day pills */}
      {tab === 'schedule' && days.length > 0 && (
        <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
            {days.map(day => (
              <Pressable key={day} onPress={() => setSelectedDay(day)}
                style={{
                  paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
                  backgroundColor: selectedDay === day ? '#c6ee62' : '#080e3d',
                  alignSelf: 'flex-start',
                }}>
                <Text style={{
                  fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase',
                  color: selectedDay === day ? '#1a2e05' : '#94a3b8',
                }}>{fmtDay(day)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Conflict warning */}
      {conflictWarning && (
        <View style={{ marginHorizontal: 24, marginBottom: 12, padding: 12, backgroundColor: 'rgba(250,204,21,0.1)', borderWidth: 1, borderColor: 'rgba(250,204,21,0.2)', borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#facc15' }}>⚠ Conflict: {conflictWarning}</Text>
        </View>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#c6ee62" />
        </View>
      ) : (
        <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} contentContainerStyle={{ paddingBottom: 100 }}>
          {displayEvents.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 80 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(198,238,98,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <Text style={{ fontSize: 28, color: '#c6ee62' }}>📅</Text>
              </View>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#fff', marginBottom: 8 }}>
                {tab === 'agenda' ? 'No Bookmarked Sessions' : 'No Sessions Found'}
              </Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: '#94a3b8', textAlign: 'center', maxWidth: 280 }}>
                {tab === 'agenda' ? 'Bookmark sessions from the schedule to build your personal agenda.' : 'No sessions match your current filters.'}
              </Text>
            </View>
          ) : displayEvents.map(event => {
            const isB = bookmarkedIds.has(event.id);
            return (
              <Pressable
                key={event.id}
                onPress={() => router.push(`/session/${event.id}` as any)}
                style={{
                  padding: 20, borderRadius: 16, marginBottom: 16,
                  backgroundColor: isB ? 'rgba(198,238,98,0.05)' : '#050a30',
                  borderWidth: 1, borderColor: isB ? 'rgba(198,238,98,0.2)' : 'rgba(255,255,255,0.05)',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      {event.track && (
                        <View style={{ backgroundColor: 'rgba(198,238,98,0.2)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 2 }}>
                          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: '#c6ee62', letterSpacing: 1, textTransform: 'uppercase' }}>{event.track}</Text>
                        </View>
                      )}
                      {isB && <Text style={{ fontSize: 12, color: '#c6ee62' }}>★</Text>}
                    </View>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#fff', marginBottom: 4 }}>{event.title}</Text>
                    {event.speaker && <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: '#94a3b8', marginBottom: 8 }}>{event.speaker}</Text>}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(8,14,61,0.8)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Text style={{ fontSize: 11, color: '#c6ee62' }}>●</Text>
                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#e2e8f0' }}>
                          {fmt(event.starts_at)}
                        </Text>
                        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: 'rgba(148,163,184,0.4)' }}>–</Text>
                        <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#e2e8f0' }}>
                          {fmt(event.ends_at)}
                        </Text>
                      </View>
                      {event.room && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(8,14,61,0.8)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ fontSize: 11 }}>📍</Text>
                          <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#94a3b8' }}>{event.room}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Pressable
                    onPress={() => handleBookmark(event)}
                    style={{
                      width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isB ? '#c6ee62' : '#111b57',
                    }}
                  >
                    <Text style={{ fontSize: 16, color: isB ? '#1a2e05' : '#94a3b8' }}>★</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
