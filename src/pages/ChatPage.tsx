import { useState, useRef, ChangeEvent, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Avatar, Button } from '../components/UI';
import { ArrowLeft, Info, Plus, Mic, Send, FileText, X, Paperclip, Play, Pause, Square, Loader2, AlertTriangle, Check, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import type { Json } from '../lib/database.types';
import { useUser } from '../context/UserContext';
import { User } from '../types';

interface Attachment {
  name: string;
  size: string;
  type: string;
}

interface VoiceNote {
  duration: string;
  waveform: number[];
  url?: string;
}

interface Message {
  id: string;
  content: string | null;
  sender: 'me' | 'them';
  senderId: string;
  receiverId: string;
  time: string;
  createdAt: string | null;
  isRead: boolean;
  attachments: Attachment[];
  voiceNoteUrl: string | null;
  voiceNoteDuration: string | null;
  voiceNote?: VoiceNote;
}

// Shape returned by Supabase profiles query
type ProfileRow = {
  id: string;
  name: string;
  handle: string;
  role: string;
  company: string | null;
  avatar_url: string | null;
  is_online: boolean | null;
};

function mapProfileToUser(p: ProfileRow): User {
  return {
    id: p.id,
    name: p.name,
    handle: p.handle,
    role: p.role,
    company: p.company || '',
    avatar: p.avatar_url || `https://picsum.photos/seed/${p.id}/200/200`,
    isOnline: p.is_online ?? false,
    tags: [],
  };
}

type MessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  is_read: boolean | null;
  created_at: string | null;
  voice_note_url: string | null;
  voice_note_duration: string | null;
  attachments: Attachment[] | null;
};

function mapMessageRow(row: MessageRow, currentUserId: string): Message {
  return {
    id: row.id,
    content: row.content,
    sender: row.sender_id === currentUserId ? 'me' : 'them',
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    time: row.created_at
      ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Just now',
    createdAt: row.created_at,
    isRead: row.is_read ?? false,
    attachments: (row.attachments as Attachment[]) ?? [],
    voiceNoteUrl: row.voice_note_url,
    voiceNoteDuration: row.voice_note_duration,
  };
}

export function ChatPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useUser();
  const [chatPartner, setChatPartner] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Fetch chat partner profile from Supabase
  useEffect(() => {
    if (!userId) return;
    const fetchUser = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, handle, role, company, avatar_url, is_online')
          .eq('id', userId)
          .single();

        if (error || !data) {
          setChatPartner({ id: userId, name: 'Unknown User', handle: 'unknown', role: '', company: '', avatar: `https://picsum.photos/seed/${userId}/200/200`, tags: [] } as User);
        } else {
          setChatPartner(mapProfileToUser(data as ProfileRow));
        }
      } catch {
        setChatPartner({ id: userId, name: 'Unknown User', handle: 'unknown', role: '', company: '', avatar: `https://picsum.photos/seed/${userId}/200/200`, tags: [] } as User);
      }
    };
    fetchUser();
  }, [userId]);

  // Fetch messages for this specific conversation (proper filtering — not all messages)
  const fetchMessages = useCallback(async () => {
    if (!currentUser?.id || !userId) return;

    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, is_read, created_at, voice_note_url, voice_note_duration, attachments')
      .or(
        `and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`
      )
      .order('created_at', { ascending: true });

    if (error) {
      setMessagesError('Failed to load messages.');
      console.error('Messages fetch error:', error);
      setIsLoading(false);
      return;
    }

    setMessages((data as unknown as MessageRow[]).map((row) => mapMessageRow(row, currentUser.id)));
    setMessagesError(null);
    setIsLoading(false);
  }, [currentUser?.id, userId]);

  // Mark unread messages from the other user as read
  const markMessagesAsRead = useCallback(async () => {
    if (!currentUser?.id || !userId) return;

    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', userId)
      .eq('receiver_id', currentUser.id)
      .eq('is_read', false);
  }, [currentUser?.id, userId]);

  // Initial fetch + real-time subscription
  useEffect(() => {
    if (!currentUser?.id || !userId) return;

    fetchMessages();
    markMessagesAsRead();

    // Real-time: listen for messages in this conversation
    const channel = supabase
      .channel(`chat-${[currentUser.id, userId].sort().join('-')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          // Only add if it's part of this conversation
          if (row.receiver_id === currentUser.id) {
            setMessages((prev) => [...prev, mapMessageRow(row, currentUser.id)]);
            // Mark as read since user is viewing the conversation
            supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', row.id)
              .then();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${currentUser.id}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          if (row.receiver_id === userId) {
            // Add own message from real-time (in case sent from another device)
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              return [...prev, mapMessageRow(row, currentUser.id)];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const updated = payload.new as MessageRow;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id ? { ...m, isRead: updated.is_read ?? false } : m
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, userId, fetchMessages, markMessagesAsRead]);

  const [inputValue, setInputValue] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedVoiceNote, setRecordedVoiceNote] = useState<VoiceNote | null>(null);
  const [playingMessageIdx, setPlayingMessageIdx] = useState<number | null>(null);
  const [isPlayingReview, setIsPlayingReview] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isRecording) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      setRecordingDuration(0);
    }
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (playingMessageIdx !== null || isPlayingReview) {
      interval = setInterval(() => {
        setPlaybackProgress(prev => {
          if (prev >= 100) {
            setPlayingMessageIdx(null);
            setIsPlayingReview(false);
            return 0;
          }
          return prev + 2;
        });
      }, 100);
    } else {
      setPlaybackProgress(0);
    }
    return () => clearInterval(interval);
  }, [playingMessageIdx, isPlayingReview]);

  const togglePlayback = (idx: number, audioUrl?: string | null) => {
    if (playingMessageIdx === idx) {
      const audio = audioElementsRef.current.get(String(idx));
      audio?.pause();
      setPlayingMessageIdx(null);
    } else {
      audioElementsRef.current.forEach(a => a.pause());
      setIsPlayingReview(false);

      if (audioUrl) {
        let audio = audioElementsRef.current.get(String(idx));
        if (!audio) {
          audio = new Audio(audioUrl);
          audioElementsRef.current.set(String(idx), audio);
        }
        audio.currentTime = 0;
        audio.ontimeupdate = () => {
          if (audio!.duration) {
            setPlaybackProgress((audio!.currentTime / audio!.duration) * 100);
          }
        };
        audio.onended = () => {
          setPlayingMessageIdx(null);
          setPlaybackProgress(0);
        };
        audio.play().catch(() => {});
      }
      setPlayingMessageIdx(idx);
      setPlaybackProgress(0);
    }
  };

  const toggleReviewPlayback = () => {
    if (isPlayingReview) {
      setIsPlayingReview(false);
      audioElementsRef.current.get('review')?.pause();
    } else {
      audioElementsRef.current.forEach(a => a.pause());
      setPlayingMessageIdx(null);

      if (recordedVoiceNote?.url) {
        let audio = audioElementsRef.current.get('review');
        if (!audio) {
          audio = new Audio(recordedVoiceNote.url);
          audioElementsRef.current.set('review', audio);
        }
        audio.currentTime = 0;
        audio.ontimeupdate = () => {
          if (audio!.duration) {
            setPlaybackProgress((audio!.currentTime / audio!.duration) * 100);
          }
        };
        audio.onended = () => {
          setIsPlayingReview(false);
          setPlaybackProgress(0);
        };
        audio.play().catch(() => {});
      }
      setIsPlayingReview(true);
      setPlaybackProgress(0);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() && selectedFiles.length === 0 && !isRecording && !recordedVoiceNote) return;
    if (!currentUser?.id || !userId) return;

    try {
      if (recordedVoiceNote && recordedBlobRef.current) {
        // Upload audio to Supabase Storage
        const filePath = `${currentUser.id}/${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from('voice-notes')
          .upload(filePath, recordedBlobRef.current, { contentType: 'audio/webm', cacheControl: '3600' });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('voice-notes').getPublicUrl(filePath);
        const voiceNoteUrl = urlData.publicUrl;

        const { error } = await supabase.from('messages').insert({
          sender_id: currentUser.id,
          receiver_id: userId,
          voice_note_url: voiceNoteUrl,
          voice_note_duration: recordedVoiceNote.duration,
        });
        if (error) throw error;

        if (recordedVoiceNote.url) URL.revokeObjectURL(recordedVoiceNote.url);
        recordedBlobRef.current = null;
        setRecordedVoiceNote(null);
        return;
      }

      const attachments: Attachment[] = selectedFiles.map(file => ({
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type
      }));

      const { error } = await supabase.from('messages').insert({
        sender_id: currentUser.id,
        receiver_id: userId,
        content: inputValue || null,
        attachments: (attachments.length > 0 ? attachments : []) as unknown as Json,
      });
      if (error) throw error;

      setInputValue('');
      setSelectedFiles([]);
    } catch (error) {
      setSendError('Failed to send message. Please try again.');
      setTimeout(() => setSendError(null), 4000);
      console.error('Send message error:', error);
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          recordedBlobRef.current = blob;
          const voiceNote: VoiceNote = {
            duration: formatDuration(recordingDuration),
            waveform: Array.from({ length: 20 }, () => Math.random() * 100),
            url: URL.createObjectURL(blob)
          };
          setRecordedVoiceNote(voiceNote);
        };

        mediaRecorder.start();
        setRecordedVoiceNote(null);
        setIsRecording(true);
      } catch (err) {
        console.error('Microphone access denied:', err);
        alert('Microphone access is required to record voice notes.');
      }
    }
  };

  const discardVoiceNote = () => {
    if (recordedVoiceNote?.url) URL.revokeObjectURL(recordedVoiceNote.url);
    recordedBlobRef.current = null;
    setRecordedVoiceNote(null);
  };

  return (
    <div className="text-on-surface antialiased overflow-hidden h-screen flex flex-col bg-background md:bg-background/50">
      {/* Header */}
      <header className="fixed top-0 w-full md:max-w-2xl md:left-1/2 md:-translate-x-1/2 z-50 px-6 py-6 bg-background/60 backdrop-blur-md border-b border-white/5 shadow-2xl md:border-x">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate(-1)} className="text-on-surface active:scale-95 transition-transform">
            <ArrowLeft className="w-7 h-7" />
          </button>
          <button
            onClick={() => chatPartner && navigate(`/profile/${chatPartner.id}`)}
            className="text-primary-accent active:scale-95 transition-transform"
          >
            <Info className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center gap-5">
          <div className="relative">
            <Avatar src={chatPartner?.avatar || ''} alt={chatPartner?.name || ''} size="lg" isOnline={(chatPartner as any)?.isOnline} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black tracking-tight text-primary-accent uppercase leading-none">
              {chatPartner?.name || 'Loading...'}
            </h1>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-on-surface-variant mt-2 opacity-80">
              {chatPartner?.role || ''}
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-grow pt-48 pb-40 px-6 overflow-y-auto space-y-8 hide-scrollbar md:max-w-2xl md:mx-auto md:border-x md:border-white/5">
        <AnimatePresence initial={false}>
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary-accent" />
            </div>
          ) : messagesError ? (
            <div className="flex flex-col items-center text-center py-16 space-y-3">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-red-400 font-medium">{messagesError}</p>
            </div>
          ) : messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-primary-accent/10 flex items-center justify-center mb-6">
                <FileText className="w-10 h-10 text-primary-accent" />
              </div>
              <h2 className="text-xl font-black text-white mb-2">Send an Offer</h2>
              <p className="text-on-surface-variant font-medium text-sm max-w-[200px]">
                Initiate a deal by sending a message, attaching documents, or recording a voice note.
              </p>
            </motion.div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const msgDate = msg.createdAt ? new Date(msg.createdAt) : null;
                const prevDate = idx > 0 && messages[idx - 1].createdAt ? new Date(messages[idx - 1].createdAt!) : null;
                const showDateSeparator = msgDate && (idx === 0 || !prevDate || msgDate.toDateString() !== prevDate.toDateString());

                let dateLabel = '';
                if (showDateSeparator && msgDate) {
                  const today = new Date();
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  if (msgDate.toDateString() === today.toDateString()) {
                    dateLabel = 'Today';
                  } else if (msgDate.toDateString() === yesterday.toDateString()) {
                    dateLabel = 'Yesterday';
                  } else {
                    dateLabel = msgDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
                  }
                }

                return (
                <div key={msg.id}>
                {showDateSeparator && (
                <div className="flex justify-center my-6">
                  <div className="px-4 py-1 rounded-full bg-surface-container-low/50 backdrop-blur-sm">
                    <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">{dateLabel}</span>
                  </div>
                </div>
                )}
                {(
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex flex-col ${msg.sender === 'me' ? 'items-end ml-auto' : 'items-start'} max-w-[85%] group`}
                >
                  <div className={`${
                    msg.sender === 'me'
                      ? 'bg-primary-accent text-on-primary-accent rounded-br-none'
                      : 'bg-surface-container text-on-surface rounded-bl-none border border-white/5'
                  } px-5 py-4 rounded-3xl shadow-xl space-y-3`}>
                    {msg.content && <p className="text-sm leading-relaxed font-medium">{msg.content}</p>}

                    {(msg.voiceNoteUrl) && (
                      <div className="flex items-center gap-4 py-2 min-w-[200px]">
                        <button
                          onClick={() => togglePlayback(idx, msg.voiceNoteUrl)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${msg.sender === 'me' ? 'bg-white/20 hover:bg-white/30' : 'bg-primary-accent/20 text-primary-accent hover:bg-primary-accent/30'}`}
                        >
                          {playingMessageIdx === idx ? (
                            <Pause className="w-5 h-5 fill-current" />
                          ) : (
                            <Play className="w-5 h-5 fill-current" />
                          )}
                        </button>
                        <div className="flex-1 flex items-end gap-[2px] h-8 relative">
                          {(msg.voiceNote?.waveform || Array.from({ length: 20 }, () => Math.random() * 100)).map((h, i, arr) => {
                            const isPlayed = playingMessageIdx === idx && (i / arr.length) * 100 <= playbackProgress;
                            return (
                              <div
                                key={i}
                                style={{ height: `${Math.max(20, h)}%` }}
                                className={`flex-1 rounded-full transition-colors duration-300 ${
                                  msg.sender === 'me'
                                    ? (isPlayed ? 'bg-white' : 'bg-white/40')
                                    : (isPlayed ? 'bg-primary-accent' : 'bg-primary-accent/40')
                                }`}
                              />
                            );
                          })}
                        </div>
                        <span className="text-[10px] font-bold opacity-60">
                          {msg.voiceNoteDuration || '0:00'}
                        </span>
                      </div>
                    )}

                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="space-y-2">
                        {msg.attachments.map((file, fIdx) => (
                          <div
                            key={fIdx}
                            className={`flex items-center gap-3 p-3 rounded-xl ${
                              msg.sender === 'me' ? 'bg-white/10' : 'bg-surface-container-highest'
                            }`}
                          >
                            <FileText className="w-5 h-5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold truncate">{file.name}</p>
                              <p className="text-[9px] opacity-60 uppercase tracking-widest">{file.size}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={`flex items-center gap-1 mt-2 ${msg.sender === 'me' ? 'mr-4' : 'ml-4'}`}>
                    <span className="text-[10px] text-on-surface-variant font-medium uppercase tracking-tighter opacity-60">
                      {msg.time}
                    </span>
                    {msg.sender === 'me' && (
                      msg.isRead
                        ? <CheckCheck className="w-3.5 h-3.5 text-primary-accent" />
                        : <Check className="w-3.5 h-3.5 text-on-surface-variant opacity-60" />
                    )}
                  </div>
                </motion.div>
                )}
                </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </AnimatePresence>
      </main>

      {/* Input Area */}
      <footer className="fixed bottom-0 left-0 w-full md:max-w-2xl md:left-1/2 md:-translate-x-1/2 px-6 pb-8 pt-4 bg-gradient-to-t from-background via-background/95 to-transparent z-50">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Send Error */}
          <AnimatePresence>
            {sendError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex items-center gap-2 px-4 py-2 bg-red-400/10 border border-red-400/20 rounded-xl"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400 font-medium">{sendError}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {/* File Previews */}
          <AnimatePresence>
            {selectedFiles.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-wrap gap-2 overflow-hidden"
              >
                {selectedFiles.map((file, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-2 bg-surface-container-high px-3 py-2 rounded-xl border border-white/5"
                  >
                    <FileText className="w-4 h-4 text-primary-accent" />
                    <span className="text-[10px] font-bold text-on-surface max-w-[100px] truncate">{file.name}</span>
                    <button onClick={() => removeFile(idx)} className="text-on-surface-variant hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3 bg-surface-container-high/60 backdrop-blur-xl p-2 pl-4 rounded-[28px] border border-white/5 shadow-2xl overflow-hidden">
            <AnimatePresence mode="wait">
              {isRecording ? (
                <motion.div
                  key="recording"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  className="flex-1 flex items-center gap-4 px-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-bold text-red-500 tabular-nums">{formatDuration(recordingDuration)}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-1 h-4">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ height: [4, Math.random() * 16 + 4, 4] }}
                        transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.05 }}
                        className="flex-1 bg-red-500/40 rounded-full"
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setIsRecording(false)}
                    className="text-on-surface-variant hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </motion.div>
              ) : recordedVoiceNote ? (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex-1 flex items-center gap-4 px-2"
                >
                  <div className="flex items-center gap-3 bg-primary-accent/10 px-3 py-2 rounded-2xl flex-1">
                    <button
                      onClick={toggleReviewPlayback}
                      className="w-8 h-8 rounded-full bg-primary-accent/20 flex items-center justify-center text-primary-accent active:scale-90 transition-all"
                    >
                      {isPlayingReview ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 text-primary-accent fill-current" />
                      )}
                    </button>
                    <div className="flex-1 flex items-end gap-[2px] h-4">
                      {recordedVoiceNote.waveform.map((h, i) => {
                        const isPlayed = isPlayingReview && (i / recordedVoiceNote.waveform.length) * 100 <= playbackProgress;
                        return (
                          <div
                            key={i}
                            style={{ height: `${Math.max(20, h)}%` }}
                            className={`flex-1 rounded-full transition-colors duration-300 ${isPlayed ? 'bg-primary-accent' : 'bg-primary-accent/40'}`}
                          />
                        );
                      })}
                    </div>
                    <span className="text-[10px] font-bold text-primary-accent">
                      {isPlayingReview
                        ? formatDuration(Math.ceil((playbackProgress / 100) * recordingDuration))
                        : recordedVoiceNote.duration}
                    </span>
                  </div>
                  <button
                    onClick={discardVoiceNote}
                    className="p-2 text-on-surface-variant hover:text-red-400 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="input"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex items-center gap-3"
                >
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-primary-accent hover:bg-surface-container-highest rounded-full transition-all"
                  >
                    <Paperclip className="w-6 h-6" />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    multiple
                    className="hidden"
                  />
                  <input
                    className="flex-grow bg-transparent border-none focus:ring-0 focus:outline-none outline-none text-on-surface placeholder:text-on-surface-variant/50 text-sm font-medium"
                    placeholder="Describe your offer..."
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-1 pr-1">
              {!inputValue.trim() && selectedFiles.length === 0 && !recordedVoiceNote ? (
                <button
                  onClick={handleToggleRecording}
                  className={`p-3 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/20' : 'text-on-surface-variant hover:text-primary-accent'}`}
                >
                  {isRecording ? <Square className="w-6 h-6 fill-current" /> : <Mic className="w-6 h-6" />}
                </button>
              ) : (
                <button
                  onClick={handleSendMessage}
                  className="bg-primary-accent text-on-primary-accent p-3 rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-90 transition-all"
                >
                  <Send className="w-5 h-5 fill-current" />
                </button>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
