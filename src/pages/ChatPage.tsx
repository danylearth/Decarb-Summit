import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// Real user data fetched from Firestore
import { Avatar, Button } from '../components/UI';
import { ArrowLeft, Info, Plus, Mic, Send, FileText, X, Paperclip, Play, Pause, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, storage, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp, limit, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
  id?: string;
  text?: string;
  sender: 'me' | 'them';
  senderId: string;
  receiverId: string;
  time: string;
  timestamp?: any;
  attachments?: Attachment[];
  voiceNote?: VoiceNote;
  voiceNoteUrl?: string;
  voiceNoteDuration?: string;
}

export function ChatPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [chatPartner, setChatPartner] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch real user data from Firestore
  useEffect(() => {
    if (!userId) return;
    const fetchUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setChatPartner({ id: userDoc.id, ...userDoc.data() } as User);
        } else {
          setChatPartner({ id: userId, name: 'Unknown User', handle: 'unknown', role: '', company: '', avatar: `https://picsum.photos/seed/${userId}/200/200`, tags: [] } as User);
        }
      } catch {
        setChatPartner({ id: userId, name: 'Unknown User', handle: 'unknown', role: '', company: '', avatar: `https://picsum.photos/seed/${userId}/200/200`, tags: [] } as User);
      }
    };
    fetchUser();
  }, [userId]);

  useEffect(() => {
    if (!auth.currentUser || !userId) return;

    const messagesRef = collection(db, 'messages');
    
    // Query for messages where current user is a participant
    const q = query(
      messagesRef,
      where('participants', 'array-contains', auth.currentUser.uid),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMessages = snapshot.docs
        .map(doc => {
          const data = doc.data();
          // Filter for the specific conversation with userId
          if (data.participants?.includes(userId)) {
            return {
              id: doc.id,
              ...data,
              sender: data.senderId === auth.currentUser?.uid ? 'me' : 'them',
              time: data.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Just now'
            } as Message;
          }
          return null;
        })
        .filter((m): m is Message => m !== null);
      
      setMessages(allMessages);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => unsubscribe();
  }, [userId]);

  const [inputValue, setInputValue] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedVoiceNote, setRecordedVoiceNote] = useState<VoiceNote | null>(null);
  const [playingMessageIdx, setPlayingMessageIdx] = useState<number | null>(null);
  const [isPlayingReview, setIsPlayingReview] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
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
    let interval: NodeJS.Timeout;
    if (playingMessageIdx !== null || isPlayingReview) {
      interval = setInterval(() => {
        setPlaybackProgress(prev => {
          if (prev >= 100) {
            setPlayingMessageIdx(null);
            setIsPlayingReview(false);
            return 0;
          }
          return prev + 2; // Simulate playback speed
        });
      }, 100);
    } else {
      setPlaybackProgress(0);
    }
    return () => clearInterval(interval);
  }, [playingMessageIdx, isPlayingReview]);

  const togglePlayback = (idx: number, audioUrl?: string) => {
    if (playingMessageIdx === idx) {
      // Pause
      const audio = audioElementsRef.current.get(String(idx));
      audio?.pause();
      setPlayingMessageIdx(null);
    } else {
      // Stop any other playing audio
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
    if (!auth.currentUser || !userId) return;

    const messagesRef = collection(db, 'messages');
    const participants = [auth.currentUser.uid, userId].sort();
    
    try {
      if (recordedVoiceNote && recordedBlobRef.current) {
        // Upload real audio to Firebase Storage
        const audioRef = ref(storage, `voice-notes/${auth.currentUser.uid}/${Date.now()}.webm`);
        const uploadResult = await uploadBytes(audioRef, recordedBlobRef.current);
        const voiceNoteUrl = await getDownloadURL(uploadResult.ref);

        await addDoc(messagesRef, {
          senderId: auth.currentUser.uid,
          receiverId: userId,
          participants,
          voiceNoteUrl,
          voiceNoteDuration: recordedVoiceNote.duration,
          voiceNote: { duration: recordedVoiceNote.duration, waveform: recordedVoiceNote.waveform },
          timestamp: serverTimestamp()
        });
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

      await addDoc(messagesRef, {
        senderId: auth.currentUser.uid,
        receiverId: userId,
        participants,
        text: inputValue,
        attachments: attachments.length > 0 ? attachments : [],
        timestamp: serverTimestamp()
      });

      setInputValue('');
      setSelectedFiles([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
    } else {
      // Start recording
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
          {messages.length === 0 ? (
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
              <div className="flex justify-center my-6">
                <div className="px-4 py-1 rounded-full bg-surface-container-low/50 backdrop-blur-sm">
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Today</span>
                </div>
              </div>
              {messages.map((msg, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex flex-col ${msg.sender === 'me' ? 'items-end ml-auto' : 'items-start'} max-w-[85%] group`}
                >
                  <div className={`${
                    msg.sender === 'me' 
                      ? 'bg-primary-accent text-on-primary-accent rounded-br-none' 
                      : 'bg-surface-container text-on-surface rounded-bl-none border border-white/5'
                  } px-5 py-4 rounded-3xl shadow-xl space-y-3`}>
                    {msg.text && <p className="text-sm leading-relaxed font-medium">{msg.text}</p>}
                    
                    {(msg.voiceNote || msg.voiceNoteUrl) && (
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
                          {msg.voiceNoteDuration || msg.voiceNote?.duration || '0:00'}
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
                  <span className={`text-[10px] text-on-surface-variant mt-2 ${msg.sender === 'me' ? 'mr-4' : 'ml-4'} font-medium uppercase tracking-tighter opacity-60`}>
                    {msg.time}
                  </span>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </AnimatePresence>
      </main>

      {/* Input Area */}
      <footer className="fixed bottom-0 left-0 w-full md:max-w-2xl md:left-1/2 md:-translate-x-1/2 px-6 pb-8 pt-4 bg-gradient-to-t from-background via-background/95 to-transparent z-50">
        <div className="max-w-4xl mx-auto space-y-4">
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
