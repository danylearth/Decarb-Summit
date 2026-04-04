/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { FeedPage } from './pages/FeedPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { ChatPage } from './pages/ChatPage';
import { PersonalInfoPage } from './pages/PersonalInfoPage';
import { MembershipPage } from './pages/MembershipPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { UserProvider, useUser } from './context/UserContext';
import { ResourceDetailPage } from './pages/ResourceDetailPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Button } from './components/UI';
import { ArrowRight, Linkedin, Mail, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';

function AdminLayout() {
  const { user } = useUser();

  if (!user?.isAdmin) return <Navigate to="/" replace />;

  return <Outlet />;
}

function TutorialGuide({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const steps = [
    {
      route: '/connections',
      title: 'Match with Attendees',
      description: 'Swipe through people at the event. See their role, expertise, and company. Tap Offer to connect.',
      position: 'center' as const,
    },
    {
      route: '/connections?tab=messages',
      title: 'Your Conversations',
      description: 'Switch to Conversations to see your active chats. Send messages, voice notes, and files.',
      position: 'center' as const,
    },
    {
      route: '/connections?filters=true',
      title: 'Filter Your Matches',
      description: 'Use filters to narrow down by role, company, or expertise. Find exactly who you need.',
      position: 'top' as const,
    },
    {
      route: '/feed',
      title: 'Community Feed',
      description: 'Share insights, post updates, and engage with other attendees. This is where conversations start.',
      position: 'center' as const,
    },
    {
      route: '/profile',
      title: 'Your Profile',
      description: "This is how others see you. Keep it sharp — your role, bio, and tags help people find you.",
      position: 'center' as const,
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  useEffect(() => {
    navigate(current.route);
  }, [step]);

  const handleNext = () => {
    if (isLast) {
      navigate('/connections');
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  const positionClass = current.position === 'top'
    ? 'top-28 left-1/2 -translate-x-1/2'
    : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* Subtle backdrop */}
      <div className="absolute inset-0 bg-background/40 pointer-events-auto" onClick={handleNext} />

      {/* Tooltip card */}
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className={`absolute ${positionClass} w-[90%] max-w-sm pointer-events-auto`}
      >
        <div className="bg-surface-container-low/95 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-6 space-y-4">
          {/* Progress */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all ${
                    i === step ? 'bg-primary-accent w-5' : i < step ? 'bg-primary-accent/50 w-2' : 'bg-surface-container-highest w-2'
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">
              {step + 1}/{steps.length}
            </span>
          </div>

          <h3 className="text-xl font-black tracking-tight text-white">{current.title}</h3>
          <p className="text-sm text-on-surface-variant font-medium leading-relaxed">{current.description}</p>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={onComplete}
              className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
            >
              Skip
            </button>
            <Button
              onClick={handleNext}
              className="rounded-full px-6 py-2 flex items-center gap-2 text-xs"
            >
              {isLast ? "Start Connecting" : 'Next'}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AppContent() {
  const { user, loading, signIn, signInWithLinkedIn, signInWithMagicLink } = useUser();
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState('');

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicLinkEmail.trim()) return;
    setMagicLinkLoading(true);
    setMagicLinkError('');
    try {
      await signInWithMagicLink(magicLinkEmail.trim());
      setMagicLinkSent(true);
    } catch (err) {
      setMagicLinkError(err instanceof Error ? err.message : 'Failed to send magic link');
    } finally {
      setMagicLinkLoading(false);
    }
  };
  const location = useLocation();
  const [showTutorial, setShowTutorial] = useState(false);
  // Track onboarded locally so it can NEVER flip back once set
  const [localOnboarded, setLocalOnboarded] = useState(() => {
    // Check all possible localStorage keys on mount
    const keys = Object.keys(localStorage).filter(k => k.startsWith('onboarded_'));
    return keys.some(k => localStorage.getItem(k) === 'true');
  });

  // Auth callback must render before any auth guards — user isn't authenticated yet
  if (location.pathname === '/auth/callback') {
    return <AuthCallbackPage />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col md:flex-row items-stretch relative overflow-hidden">
        {/* Atmospheric Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-accent/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary-accent/5 blur-[120px] rounded-full" />
        </div>

        {/* Desktop left branding panel */}
        <div className="hidden md:flex flex-1 flex-col items-center justify-center relative z-10 border-r border-white/5">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-md px-12 text-center"
          >
            <img
              src="https://storage.googleapis.com/static-assets-public/ais-studio/attachments/a7f8b9c0-d1e2-4f5g-6h7i-8j9k0l1m2n3o/logo.png"
              alt="DECARB SUMMITS"
              className="w-72 h-auto mx-auto mb-8"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<h1 class="text-6xl font-black tracking-tighter text-primary-accent mb-8">DECARB</h1>';
              }}
            />
            <p className="text-on-surface-variant font-medium tracking-wide leading-relaxed text-lg">
              The exclusive network for industrial decarbonization leaders.
            </p>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/30 mt-12">
              Industrial Decarbonization Network © 2026
            </p>
          </motion.div>
        </div>

        {/* Login form */}
        <div className="flex-1 flex flex-col items-center justify-between md:justify-center p-8 text-center relative z-10">
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
            {/* Mobile-only logo */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="mb-12 md:hidden"
            >
              <img
                src="https://storage.googleapis.com/static-assets-public/ais-studio/attachments/a7f8b9c0-d1e2-4f5g-6h7i-8j9k0l1m2n3o/logo.png"
                alt="DECARB SUMMITS"
                className="w-64 h-auto mx-auto"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = '<h1 class="text-5xl font-black tracking-tighter text-primary-accent">DECARB</h1>';
                }}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="space-y-6 w-full"
            >
              <p className="text-on-surface-variant font-medium tracking-wide leading-relaxed md:hidden">
                The exclusive network for industrial decarbonization leaders.
              </p>
              <h2 className="hidden md:block text-3xl font-black tracking-tight text-white mb-2">Welcome Back</h2>
              <p className="hidden md:block text-on-surface-variant text-sm">Sign in to your account to continue</p>

              <div className="pt-8 space-y-4">
                <Button
                  onClick={signIn}
                  size="lg"
                  className="w-full rounded-full py-6 text-sm font-black uppercase tracking-[0.2em] shadow-[0_20px_40px_-12px_rgba(198,238,98,0.3)]"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                  Continue with Google
                </Button>
                <Button
                  onClick={signInWithLinkedIn}
                  variant="outline"
                  size="lg"
                  className="w-full rounded-full py-6 text-sm font-black uppercase tracking-[0.2em] border-white/10 hover:bg-white/5 text-on-surface"
                >
                  <Linkedin className="w-5 h-5 mr-2" />
                  Continue with LinkedIn
                </Button>

                <div className="flex items-center gap-4 pt-2">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/50">or</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                {magicLinkSent ? (
                  <div className="rounded-2xl border border-primary-accent/20 bg-primary-accent/5 p-6 text-center space-y-2">
                    <Mail className="w-8 h-8 text-primary-accent mx-auto" />
                    <p className="text-on-surface font-bold text-sm">Check your email</p>
                    <p className="text-on-surface-variant text-xs leading-relaxed">
                      We sent a sign-in link to <span className="text-on-surface font-medium">{magicLinkEmail}</span>
                    </p>
                    <button
                      onClick={() => { setMagicLinkSent(false); setMagicLinkEmail(''); }}
                      className="text-primary-accent text-xs font-bold uppercase tracking-[0.15em] hover:underline mt-2"
                    >
                      Use a different email
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleMagicLink} className="space-y-3">
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={magicLinkEmail}
                      onChange={(e) => setMagicLinkEmail(e.target.value)}
                      required
                      className="w-full rounded-full border border-white/10 bg-surface-container px-6 py-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary-accent/50 focus:ring-1 focus:ring-primary-accent/25 transition-colors"
                    />
                    {magicLinkError && (
                      <p className="text-red-400 text-xs text-center">{magicLinkError}</p>
                    )}
                    <Button
                      type="submit"
                      variant="outline"
                      size="lg"
                      disabled={magicLinkLoading}
                      className="w-full rounded-full py-6 text-sm font-black uppercase tracking-[0.2em] border-white/10 hover:bg-white/5 text-on-surface"
                    >
                      {magicLinkLoading ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <Mail className="w-5 h-5 mr-2" />
                      )}
                      {magicLinkLoading ? 'Sending...' : 'Sign in with Email'}
                    </Button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="relative z-10 pt-8 md:hidden"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/30">
              Industrial Decarbonization Network © 2026
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  // Once onboarded, lock it in React state so it can NEVER flip back
  const isOnboarded = localOnboarded || user.onboarded || localStorage.getItem(`onboarded_${user.id}`) === 'true';

  // Sync: if we detect onboarded from any source, lock it
  useEffect(() => {
    if (isOnboarded && !localOnboarded) {
      setLocalOnboarded(true);
    }
  }, [isOnboarded, localOnboarded]);

  if (!isOnboarded) {
    return (
      <Routes>
        <Route path="/onboarding" element={
          <OnboardingPage onComplete={() => {
            localStorage.setItem(`onboarded_${user.id}`, 'true');
            setLocalOnboarded(true);
            setShowTutorial(true);
          }} />
        } />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  // Show tutorial after onboarding completes
  const needsTutorial = showTutorial || !localStorage.getItem(`tutorial_done_${user.id}`);

  return (
    <>
      {needsTutorial && (
        <TutorialGuide onComplete={() => {
          localStorage.setItem(`tutorial_done_${user.id}`, 'true');
          setShowTutorial(false);
        }} />
      )}
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/connections" replace />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/resources/:id" element={<ResourceDetailPage />} />
        <Route path="/connections" element={<ConnectionsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/settings" element={<SettingsPage />} />
        <Route path="/profile/personal" element={<PersonalInfoPage />} />
        <Route path="/profile/membership" element={<MembershipPage />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/connections" replace />} />
      </Route>
      <Route path="/chat/:userId" element={<ChatPage />} />
    </Routes>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <UserProvider>
          <AppContent />
        </UserProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
