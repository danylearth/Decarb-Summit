import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import type { Session, User as SupabaseUser, RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import type { User } from '../lib/types';

const redirectUrl = Linking.createURL('auth/callback');

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

interface UserContextType {
  user: User | null;
  loading: boolean;
  isDemo: boolean;
  signIn: () => Promise<void>;
  signInWithLinkedIn: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signInDemo: () => void;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  membership: {
    plan: string;
    price: string;
    status: string;
    nextBilling: string;
  };
  updateMembership: (plan: string) => Promise<void>;
  cancelMembership: () => Promise<void>;
  preferences: {
    pushNotifications: boolean;
    publicProfile: boolean;
  };
  togglePreference: (key: 'pushNotifications' | 'publicProfile') => Promise<void>;
}

const DEMO_USER: User = {
  id: 'demo-user-001',
  name: 'Alex Sterling',
  handle: 'alexsterling',
  role: 'Sustainability Director',
  company: 'CarbonZero Inc.',
  avatar: 'https://picsum.photos/seed/demo1/200/200',
  bio: 'Leading industrial decarbonization through innovative CCUS solutions. 10+ years in clean energy transition.',
  tags: ['Carbon Capture', 'Green Hydrogen', 'ESG Reporting', 'Net Zero Strategy'],
  linkedin: 'https://linkedin.com/in/alexsterling',
  twitter: 'https://x.com/alexsterling',
  onboarded: true,
  isAdmin: true,
  isOnline: true,
  isVerified: true,
};

const DEFAULT_MEMBERSHIP = {
  plan: 'Starter',
  price: '$0/mo',
  status: 'Active',
  nextBilling: 'N/A',
};

const DEFAULT_PREFERENCES = {
  pushNotifications: true,
  publicProfile: false,
};

const UserContext = createContext<UserContextType | undefined>(undefined);

function profileToUser(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    role: row.role,
    company: row.company ?? '',
    avatar: row.avatar_url ?? '',
    bio: row.bio ?? '',
    tags: row.tags ?? [],
    linkedin: row.linkedin_url ?? '',
    twitter: row.twitter_url ?? '',
    onboarded: !!row.onboarded,
    isAdmin: !!row.is_admin,
    isOnline: !!row.is_online,
    isVerified: !!row.is_verified,
  };
}

function userUpdatesToProfile(updates: Partial<User>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  if ('name' in updates) mapped.name = updates.name;
  if ('handle' in updates) mapped.handle = updates.handle;
  if ('role' in updates) mapped.role = updates.role;
  if ('company' in updates) mapped.company = updates.company;
  if ('bio' in updates) mapped.bio = updates.bio;
  if ('tags' in updates) mapped.tags = updates.tags;
  if ('onboarded' in updates) mapped.onboarded = updates.onboarded;
  if ('avatar' in updates) mapped.avatar_url = updates.avatar || null;
  if ('linkedin' in updates) {
    const val = updates.linkedin;
    mapped.linkedin_url = !val ? null : (val.startsWith('http') ? val : `https://${val}`);
  }
  if ('twitter' in updates) {
    const val = updates.twitter;
    mapped.twitter_url = !val ? null : (val.startsWith('http') ? val : `https://${val}`);
  }
  return mapped;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [membership, setMembership] = useState(DEFAULT_MEMBERSHIP);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentUidRef = useRef<string | null>(null);

  const signInDemo = () => {
    setUser(DEMO_USER);
    setIsDemo(true);
    setLoading(false);
    setMembership({ plan: 'Professional', price: '$29/mo', status: 'Active', nextBilling: 'May 5, 2026' });
  };

  const fetchAndSetProfile = useCallback(async (uid: string) => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();

    if (error && error.code === 'PGRST116') return null;
    if (error) {
      console.error('[UserContext] Failed to fetch profile:', error.message);
      return null;
    }
    applyProfile(profile, uid);
    return profile;
  }, []);

  const applyProfile = useCallback(async (profile: ProfileRow, uid: string) => {
    const storedOnboarded = await AsyncStorage.getItem(`onboarded_${uid}`);
    const localOnboarded = storedOnboarded === 'true';
    const isOnboarded = !!profile.onboarded || localOnboarded;

    if (isOnboarded && !localOnboarded) {
      await AsyncStorage.setItem(`onboarded_${uid}`, 'true');
    }

    const appUser = profileToUser(profile);
    appUser.onboarded = isOnboarded;
    setUser(appUser);

    if (profile.membership) {
      setMembership(profile.membership as typeof DEFAULT_MEMBERSHIP);
    }
    if (profile.preferences) {
      setPreferences(profile.preferences as typeof DEFAULT_PREFERENCES);
    }
  }, []);

  const createProfile = useCallback(async (authUser: SupabaseUser) => {
    const meta = authUser.user_metadata ?? {};
    const newProfile = {
      id: authUser.id,
      name: meta.full_name || meta.name || 'New User',
      handle: authUser.email?.split('@')[0] || 'user',
      role: 'Community Member',
      company: '',
      avatar_url: meta.avatar_url || meta.picture || null,
      email: authUser.email || null,
      onboarded: false,
    };

    const { error } = await supabase.from('profiles').insert(newProfile);
    if (error) {
      console.error('[UserContext] Failed to create profile:', error.message);
      return;
    }
    await fetchAndSetProfile(authUser.id);
  }, [fetchAndSetProfile]);

  const subscribeToProfile = useCallback((uid: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`profile:${uid}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${uid}`,
      }, (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          applyProfile(payload.new as ProfileRow, uid);
        } else if (payload.eventType === 'DELETE') {
          setUser(null);
        }
      })
      .subscribe();

    channelRef.current = channel;
  }, [applyProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const uid = session.user.id;
          if (currentUidRef.current !== uid) {
            currentUidRef.current = uid;
            const profile = await fetchAndSetProfile(uid);
            if (!profile) await createProfile(session.user);
            subscribeToProfile(uid);
          }
        } else {
          currentUidRef.current = null;
          setUser(null);
          if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          }
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [fetchAndSetProfile, createProfile, subscribeToProfile]);

  const signIn = async () => {
    // On mobile, OAuth opens in-app browser. Needs deep link redirect.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl },
    });
    if (error) console.error('Sign in error:', error.message);
  };

  const signInWithLinkedIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: { redirectTo: redirectUrl },
    });
    if (error) console.error('LinkedIn sign in error:', error.message);
  };

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectUrl },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (isDemo) {
      setUser(null);
      setIsDemo(false);
      return;
    }
    await supabase.auth.signOut();
  };

  const updateUser = async (updates: Partial<User>) => {
    if (isDemo) {
      setUser(prev => prev ? { ...prev, ...updates } : prev);
      return;
    }
    if (!currentUidRef.current || !user) return;
    const uid = currentUidRef.current;
    const prevUser = { ...user };
    setUser({ ...user, ...updates });

    if (updates.onboarded) {
      await AsyncStorage.setItem(`onboarded_${uid}`, 'true');
    }

    const profileUpdates = userUpdatesToProfile(updates);
    try {
      const { error } = await supabase.from('profiles').update(profileUpdates).eq('id', uid);
      if (error) {
        setUser(prevUser);
        if (updates.onboarded) await AsyncStorage.removeItem(`onboarded_${uid}`);
        throw error;
      }
    } catch (err) {
      throw err;
    }
  };

  const togglePreference = async (key: keyof typeof preferences) => {
    if (!currentUidRef.current) return;
    const newPrefs = { ...preferences, [key]: !preferences[key] };
    const { error } = await supabase
      .from('profiles')
      .update({ preferences: newPrefs })
      .eq('id', currentUidRef.current);
    if (error) console.error('[togglePreference]', error.message);
  };

  const updateMembership = async (plan: string) => {
    if (!currentUidRef.current) return;
    const plans: Record<string, { price: string; nextBilling: string }> = {
      Starter: { price: '$0/mo', nextBilling: 'N/A' },
      Professional: { price: '$29/mo', nextBilling: 'April 20, 2026' },
      Enterprise: { price: '$99/mo', nextBilling: 'April 20, 2026' },
    };
    const newMembership = { plan, price: plans[plan].price, nextBilling: plans[plan].nextBilling, status: 'Active' };
    await supabase.from('profiles').update({ membership: newMembership }).eq('id', currentUidRef.current);
  };

  const cancelMembership = async () => {
    if (!currentUidRef.current) return;
    const newMembership = { ...membership, status: 'Cancelled', nextBilling: 'Ends April 20, 2026' };
    await supabase.from('profiles').update({ membership: newMembership }).eq('id', currentUidRef.current);
  };

  return (
    <UserContext.Provider value={{
      user, loading, isDemo, signIn, signInWithLinkedIn, signInWithMagicLink, signInDemo, signOut,
      updateUser, membership, updateMembership, cancelMembership, preferences, togglePreference,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
}
