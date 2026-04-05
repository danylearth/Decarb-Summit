import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { Event, Question } from '../types';
import { Button, Avatar, cn } from '../components/UI';
import { ArrowLeft, Bookmark, MapPin, Clock, User, CheckCircle2, Send, Star, Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function SessionDetailPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);

  // Fetch event
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (data) setEvent(data as Event);
      if (error) console.error('Event fetch error:', error);
      setLoading(false);
    })();
  }, [sessionId]);

  // Check bookmark + checkin status
  useEffect(() => {
    if (!user || !sessionId) return;
    (async () => {
      const [bookmarkRes, checkinRes] = await Promise.all([
        supabase.from('event_bookmarks').select('event_id').eq('user_id', user.id).eq('event_id', sessionId).maybeSingle(),
        supabase.from('event_checkins').select('event_id').eq('user_id', user.id).eq('event_id', sessionId).maybeSingle(),
      ]);
      setIsBookmarked(!!bookmarkRes.data);
      setIsCheckedIn(!!checkinRes.data);
    })();
  }, [user?.id, sessionId]);

  // Fetch questions + real-time
  const fetchQuestions = useCallback(async () => {
    if (!sessionId) return;
    const { data } = await supabase
      .from('questions')
      .select('*, profiles!author_id (name, avatar_url)')
      .eq('event_id', sessionId)
      .order('is_highlighted', { ascending: false })
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      setQuestions(data.map((r: any) => ({
        id: r.id,
        event_id: r.event_id,
        author_id: r.author_id,
        authorName: r.profiles?.name || 'Anonymous',
        authorAvatar: r.profiles?.avatar_url || '',
        content: r.content,
        upvotes: r.upvotes ?? 0,
        is_highlighted: r.is_highlighted ?? false,
        created_at: r.created_at,
      })));
    }
  }, [sessionId]);

  useEffect(() => {
    fetchQuestions();
    if (!sessionId) return;

    const channel = supabase
      .channel(`questions-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions', filter: `event_id=eq.${sessionId}` }, fetchQuestions)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, fetchQuestions]);

  const handleBookmark = async () => {
    if (!user || !sessionId) return;
    const prev = isBookmarked;
    setIsBookmarked(!prev);
    try {
      if (prev) {
        await supabase.from('event_bookmarks').delete().eq('user_id', user.id).eq('event_id', sessionId);
      } else {
        await supabase.from('event_bookmarks').insert({ user_id: user.id, event_id: sessionId });
      }
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
    setSubmittingQuestion(true);
    await supabase.from('questions').insert({
      event_id: sessionId,
      author_id: user.id,
      content: newQuestion,
    });
    setNewQuestion('');
    setSubmittingQuestion(false);
  };

  const handleUpvote = async (questionId: string, currentVotes: number) => {
    // Simple increment (no per-user tracking for now)
    setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, upvotes: q.upvotes + 1 } : q));
    await supabase.from('questions').update({ upvotes: currentVotes + 1 }).eq('id', questionId);
  };

  const handleHighlight = async (questionId: string, current: boolean) => {
    if (!user?.isAdmin) return;
    setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, is_highlighted: !current } : q));
    await supabase.from('questions').update({ is_highlighted: !current }).eq('id', questionId);
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-accent" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-400 font-medium">Session not found.</p>
        <Button onClick={() => navigate('/schedule')} variant="outline" className="rounded-full">Back to Schedule</Button>
      </div>
    );
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-3xl mx-auto px-6 pt-12 pb-32"
    >
      {/* Back */}
      <button
        onClick={() => navigate('/schedule')}
        className="mb-8 p-2 hover:bg-surface-container rounded-full transition-colors inline-flex items-center gap-2 text-on-surface-variant/60 hover:text-on-surface"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="text-[10px] font-black uppercase tracking-widest">Schedule</span>
      </button>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          {event.track && (
            <span className="bg-primary-accent/20 text-primary-accent px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {event.track}
            </span>
          )}
        </div>
        <h1 className="text-4xl font-black tracking-tight text-white mb-3">{event.title}</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary-accent" />
            {formatDate(event.starts_at)} &middot; {formatTime(event.starts_at)} – {formatTime(event.ends_at)}
          </span>
          {event.room && (
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary-accent" />
              {event.room}
            </span>
          )}
          {event.speaker && (
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-primary-accent" />
              {event.speaker}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-10">
        <Button
          onClick={handleBookmark}
          variant={isBookmarked ? 'primary' : 'outline'}
          className={cn("rounded-full gap-2", isBookmarked && "bg-primary-accent text-on-primary-accent")}
        >
          <Bookmark className={cn("w-4 h-4", isBookmarked && "fill-current")} />
          {isBookmarked ? 'Bookmarked' : 'Bookmark'}
        </Button>
        <Button
          onClick={handleCheckIn}
          disabled={isCheckedIn}
          variant={isCheckedIn ? 'primary' : 'outline'}
          className={cn("rounded-full gap-2", isCheckedIn && "bg-primary-accent text-on-primary-accent")}
        >
          <CheckCircle2 className={cn("w-4 h-4", isCheckedIn && "fill-current")} />
          {isCheckedIn ? 'Checked In' : 'Check In'}
        </Button>
      </div>

      {/* Description */}
      {event.description && (
        <div className="mb-12">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 mb-4">About</h2>
          <p className="text-on-surface-variant leading-relaxed text-sm whitespace-pre-line">{event.description}</p>
        </div>
      )}

      {/* Live Q&A */}
      <div>
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 mb-4">
          Live Q&A ({questions.length})
        </h2>

        {/* Submit question */}
        <div className="flex items-center gap-3 mb-6">
          <Avatar src={user?.avatar || ''} alt={user?.name || ''} size="sm" />
          <div className="flex-1 relative">
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitQuestion()}
              placeholder="Ask a question..."
              className="w-full bg-surface-container rounded-full py-3 px-5 pr-12 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary-accent outline-none"
            />
            <button
              onClick={handleSubmitQuestion}
              disabled={submittingQuestion || !newQuestion.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-primary-accent disabled:opacity-30"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Questions list */}
        <div className="space-y-3">
          <AnimatePresence>
            {questions.map(q => (
              <motion.div
                key={q.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-4 rounded-xl border",
                  q.is_highlighted
                    ? "bg-primary-accent/10 border-primary-accent/30"
                    : "bg-surface-container-low border-white/5"
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar src={q.authorAvatar || ''} alt={q.authorName || ''} size="xs" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-white">{q.authorName}</span>
                      {q.is_highlighted && (
                        <span className="bg-primary-accent text-on-primary-accent px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                          Pinned
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-on-surface leading-relaxed">{q.content}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleUpvote(q.id, q.upvotes)}
                      className="flex items-center gap-1 text-on-surface-variant hover:text-primary-accent transition-colors"
                    >
                      <Star className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold">{q.upvotes}</span>
                    </button>
                    {user?.isAdmin && (
                      <button
                        onClick={() => handleHighlight(q.id, q.is_highlighted)}
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full transition-colors",
                          q.is_highlighted ? "text-primary-accent bg-primary-accent/20" : "text-on-surface-variant/40 hover:text-primary-accent"
                        )}
                      >
                        {q.is_highlighted ? 'Unpin' : 'Pin'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {questions.length === 0 && (
            <p className="text-center text-on-surface-variant/40 text-sm italic py-8">No questions yet. Be the first to ask!</p>
          )}
        </div>
      </div>
    </motion.main>
  );
}
