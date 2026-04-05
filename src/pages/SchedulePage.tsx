import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { Event } from '../types';
import { Button, cn } from '../components/UI';
import { CalendarDays, Clock, MapPin, Filter, Bookmark, AlertTriangle, Loader2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Track = string;
type Room = string;

export function SchedulePage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [events, setEvents] = useState<Event[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'schedule' | 'agenda'>('schedule');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [trackFilter, setTrackFilter] = useState<string>('');
  const [roomFilter, setRoomFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('starts_at', { ascending: true });

    if (error) {
      console.error('Events fetch error:', error);
    } else {
      setEvents((data ?? []) as Event[]);
    }
    setLoading(false);
  }, []);

  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('event_bookmarks')
      .select('event_id')
      .eq('user_id', user.id);
    if (data) setBookmarkedIds(new Set(data.map(r => r.event_id)));
  }, [user?.id]);

  useEffect(() => {
    fetchEvents();
    fetchBookmarks();

    const channel = supabase
      .channel('events-schedule')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, fetchEvents)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchEvents, fetchBookmarks]);

  // Derive unique days, tracks, rooms
  const days = [...new Set(events.map(e => new Date(e.starts_at).toDateString()))];
  const tracks = [...new Set(events.map(e => e.track).filter(Boolean))] as Track[];
  const rooms = [...new Set(events.map(e => e.room).filter(Boolean))] as Room[];

  useEffect(() => {
    if (days.length > 0 && !selectedDay) setSelectedDay(days[0]);
  }, [days.length]);

  // Filter events
  const dayEvents = events.filter(e => {
    if (selectedDay && new Date(e.starts_at).toDateString() !== selectedDay) return false;
    if (trackFilter && e.track !== trackFilter) return false;
    if (roomFilter && e.room !== roomFilter) return false;
    return true;
  });

  // Bookmarked events for agenda
  const bookmarkedEvents = events.filter(e => bookmarkedIds.has(e.id));

  // Conflict detection
  const checkConflict = (eventToBookmark: Event): string | null => {
    const start = new Date(eventToBookmark.starts_at).getTime();
    const end = new Date(eventToBookmark.ends_at).getTime();
    for (const e of bookmarkedEvents) {
      if (e.id === eventToBookmark.id) continue;
      const eStart = new Date(e.starts_at).getTime();
      const eEnd = new Date(e.ends_at).getTime();
      if (start < eEnd && end > eStart) {
        return `Overlaps with "${e.title}"`;
      }
    }
    return null;
  };

  const handleBookmark = async (event: Event) => {
    if (!user) return;
    const isBookmarked = bookmarkedIds.has(event.id);

    if (!isBookmarked) {
      const conflict = checkConflict(event);
      if (conflict) {
        setConflictWarning(conflict);
        setTimeout(() => setConflictWarning(null), 4000);
      }
    }

    // Optimistic
    const prev = new Set(bookmarkedIds);
    const next = new Set(bookmarkedIds);
    isBookmarked ? next.delete(event.id) : next.add(event.id);
    setBookmarkedIds(next);

    try {
      if (isBookmarked) {
        await supabase.from('event_bookmarks').delete().eq('user_id', user.id).eq('event_id', event.id);
      } else {
        await supabase.from('event_bookmarks').insert({ user_id: user.id, event_id: event.id });
      }
    } catch {
      setBookmarkedIds(prev);
    }
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDay = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <motion.main
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto px-6 pt-12 pb-32"
    >
      <header className="mb-8 flex items-start justify-between">
        <div>
          <span className="text-primary-accent font-bold text-[10px] tracking-[0.2em] uppercase">Summit Program</span>
          <h1 className="text-5xl font-black tracking-tighter text-white mt-1">Schedule</h1>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center hover:bg-surface-container-highest transition-colors mt-2"
        >
          <Filter className="w-5 h-5 text-primary-accent" />
        </button>
      </header>

      {/* Tab toggle */}
      <div className="bg-surface-container-low p-1.5 rounded-full flex items-center w-full max-w-sm mb-6">
        <button
          onClick={() => setActiveTab('schedule')}
          className={cn("flex-1 py-3 rounded-full font-bold text-xs tracking-widest uppercase transition-all duration-300",
            activeTab === 'schedule' ? 'bg-primary-accent text-on-primary-accent shadow-lg' : 'text-on-surface/50'
          )}
        >
          All Sessions
        </button>
        <button
          onClick={() => setActiveTab('agenda')}
          className={cn("flex-1 py-3 rounded-full font-bold text-xs tracking-widest uppercase transition-all duration-300",
            activeTab === 'agenda' ? 'bg-primary-accent text-on-primary-accent shadow-lg' : 'text-on-surface/50'
          )}
        >
          My Agenda ({bookmarkedIds.size})
        </button>
      </div>

      {/* Day pills */}
      {activeTab === 'schedule' && days.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {days.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={cn(
                "px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all",
                selectedDay === day
                  ? "bg-primary-accent text-on-primary-accent shadow-lg"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              )}
            >
              {formatDay(day)}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="flex gap-4 flex-wrap">
              <select
                value={trackFilter}
                onChange={e => setTrackFilter(e.target.value)}
                className="bg-surface-container rounded-full px-5 py-2.5 text-xs font-bold text-on-surface outline-none"
              >
                <option value="">All Tracks</option>
                {tracks.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={roomFilter}
                onChange={e => setRoomFilter(e.target.value)}
                className="bg-surface-container rounded-full px-5 py-2.5 text-xs font-bold text-on-surface outline-none"
              >
                <option value="">All Rooms</option>
                {rooms.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {(trackFilter || roomFilter) && (
                <button
                  onClick={() => { setTrackFilter(''); setRoomFilter(''); }}
                  className="text-primary-accent text-xs font-bold uppercase tracking-widest"
                >
                  Clear
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conflict warning */}
      <AnimatePresence>
        {conflictWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-xl flex items-center gap-3"
          >
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
            <p className="text-xs text-yellow-400 font-medium">Conflict: {conflictWarning}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Events list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-accent" />
        </div>
      ) : (
        <div className="space-y-4">
          {(activeTab === 'agenda' ? bookmarkedEvents : dayEvents).length === 0 ? (
            <div className="flex flex-col items-center text-center py-20">
              <div className="w-16 h-16 rounded-full bg-primary-accent/10 flex items-center justify-center mb-6">
                <CalendarDays className="w-8 h-8 text-primary-accent" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                {activeTab === 'agenda' ? 'No Bookmarked Sessions' : 'No Sessions Found'}
              </h2>
              <p className="text-on-surface-variant text-sm max-w-xs">
                {activeTab === 'agenda'
                  ? 'Bookmark sessions from the schedule to build your personal agenda.'
                  : 'No sessions match your current filters.'}
              </p>
            </div>
          ) : (
            (activeTab === 'agenda' ? bookmarkedEvents : dayEvents).map(event => {
              const isBookmarked = bookmarkedIds.has(event.id);
              return (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "group p-5 rounded-2xl border transition-all cursor-pointer",
                    isBookmarked
                      ? "bg-primary-accent/5 border-primary-accent/20"
                      : "bg-surface-container-low border-white/5 hover:bg-surface-container"
                  )}
                  onClick={() => navigate(`/schedule/${event.id}`)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {event.track && (
                          <span className="bg-primary-accent/20 text-primary-accent px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            {event.track}
                          </span>
                        )}
                        {isBookmarked && (
                          <Bookmark className="w-3.5 h-3.5 text-primary-accent fill-current" />
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1 group-hover:text-primary-accent transition-colors">
                        {event.title}
                      </h3>
                      {event.speaker && (
                        <p className="text-sm text-on-surface-variant mb-2">{event.speaker}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-on-surface-variant/60">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(event.starts_at)} – {formatTime(event.ends_at)}
                        </span>
                        {event.room && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {event.room}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleBookmark(event); }}
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90",
                          isBookmarked
                            ? "bg-primary-accent text-on-primary-accent"
                            : "bg-surface-container-highest text-on-surface-variant hover:text-primary-accent"
                        )}
                      >
                        <Bookmark className={cn("w-4 h-4", isBookmarked && "fill-current")} />
                      </button>
                      <ChevronRight className="w-5 h-5 text-on-surface-variant/20 group-hover:text-primary-accent transition-colors" />
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}
    </motion.main>
  );
}
