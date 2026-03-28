/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { UserProvider, useUser } from './context/UserContext';
import { ResourceDetailPage } from './pages/ResourceDetailPage';
import { Button } from './components/UI';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';

function AppContent() {
  const { user, loading, signIn } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-between p-8 text-center relative overflow-hidden">
        {/* Atmospheric Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-accent/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary-accent/5 blur-[120px] rounded-full" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full max-w-sm">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-12"
          >
            <img 
              src="https://storage.googleapis.com/static-assets-public/ais-studio/attachments/a7f8b9c0-d1e2-4f5g-6h7i-8j9k0l1m2n3o/logo.png" 
              alt="DECARB SUMMITS" 
              className="w-64 h-auto mx-auto"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Fallback if the specific attachment URL isn't available
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
            <p className="text-on-surface-variant font-medium tracking-wide leading-relaxed">
              The exclusive network for industrial decarbonization leaders.
            </p>

            <div className="pt-8 space-y-4">
              <Button 
                onClick={signIn} 
                size="lg" 
                className="w-full rounded-full py-6 text-sm font-black uppercase tracking-[0.2em] shadow-[0_20px_40px_-12px_rgba(198,238,98,0.3)]"
              >
                Log In
              </Button>
              <Button 
                onClick={signIn} 
                variant="outline"
                size="lg" 
                className="w-full rounded-full py-6 text-sm font-black uppercase tracking-[0.2em] border-white/10 hover:bg-white/5 text-on-surface"
              >
                Register
              </Button>
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="relative z-10 pt-8"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/30">
            Industrial Decarbonization Network © 2026
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/resources/:id" element={<ResourceDetailPage />} />
        <Route path="/connections" element={<ConnectionsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
        <Route path="/profile/settings" element={<SettingsPage />} />
        <Route path="/profile/personal" element={<PersonalInfoPage />} />
        <Route path="/profile/membership" element={<MembershipPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Route>
      <Route path="/chat/:userId" element={<ChatPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <AppContent />
      </UserProvider>
    </BrowserRouter>
  );
}
