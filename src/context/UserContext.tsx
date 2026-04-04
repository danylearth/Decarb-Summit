import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import type { Session, User as SupabaseUser, RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

interface UserContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
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

/** Map a Supabase profiles row to the app-level User type */
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

/** Map app-level User field updates to Supabase column names */
function userUpdatesToProfile(updates: Partial<User>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};

  if ('name' in updates) mapped.name = updates.name;
  if ('handle' in updates) mapped.handle = updates.handle;
  if ('role' in updates) mapped.role = updates.role;
  if ('company' in updates) mapped.company = updates.company;
  if ('bio' in updates) mapped.bio = updates.bio;
  if ('tags' in updates) mapped.tags = updates.tags;
  if ('onboarded' in updates) mapped.onboarded = updates.onboarded;
  if ('isAdmin' in updates) mapped.is_admin = updates.isAdmin;
  if ('isOnline' in updates) mapped.is_online = updates.isOnline;
  if ('isVerified' in updates) mapped.is_verified = updates.isVerified;

  // Handle URL fields — clean empty strings, auto-prefix with https://
  if ('avatar' in updates) {
    mapped.avatar_url = updates.avatar || null;
  }
  if ('linkedin' in updates) {
    const val = updates.linkedin;
    if (!val || val === '') {
      mapped.linkedin_url = null;
    } else if (typeof val === 'string' && !val.startsWith('http://') && !val.startsWith('https://')) {
      mapped.linkedin_url = `https://${val}`;
    } else {
      mapped.linkedin_url = val;
    }
  }
  if ('twitter' in updates) {
    const val = updates.twitter;
    if (!val || val === '') {
      mapped.twitter_url = null;
    } else if (typeof val === 'string' && !val.startsWith('http://') && !val.startsWith('https://')) {
      mapped.twitter_url = `https://${val}`;
    } else {
      mapped.twitter_url = val;
    }
  }

  return mapped;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState(DEFAULT_MEMBERSHIP);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);

  // Track the current auth user ID so we can clean up subscriptions
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentUidRef = useRef<string | null>(null);

  /** Fetch profile from Supabase and update state. Returns the profile or null. */
  const fetchAndSetProfile = useCallback(async (uid: string) => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();

    if (error && error.code === 'PGRST116') {
      // Profile doesn't exist yet — will be created below
      return null;
    }
    if (error) {
      console.error('[UserContext] Failed to fetch profile:', error.message);
      return null;
    }

    applyProfile(profile, uid);
    return profile;
  }, []);

  /** Apply a profile row to React state */
  const applyProfile = useCallback((profile: ProfileRow, uid: string) => {
    // localStorage is the sticky source of truth for onboarded state
    const localOnboarded = localStorage.getItem(`onboarded_${uid}`) === 'true';
    const isOnboarded = !!profile.onboarded || localOnboarded;

    // Once onboarded, persist it so it can never flip back
    if (isOnboarded && !localOnboarded) {
      localStorage.setItem(`onboarded_${uid}`, 'true');
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

  /** Create a new profile for a first-time user */
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

    // Fetch the full row (includes defaults for membership, preferences, etc.)
    await fetchAndSetProfile(authUser.id);
  }, [fetchAndSetProfile]);

  /** Subscribe to real-time changes on the user's profile row */
  const subscribeToProfile = useCallback((uid: string) => {
    // Clean up any existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`profile:${uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${uid}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            applyProfile(payload.new as ProfileRow, uid);
          } else if (payload.eventType === 'DELETE') {
            setUser(null);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, [applyProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const uid = session.user.id;

          // Only set up profile fetch/subscription if the user changed
          if (currentUidRef.current !== uid) {
            currentUidRef.current = uid;

            const profile = await fetchAndSetProfile(uid);

            if (!profile) {
              // New user — create profile
              await createProfile(session.user);
            }

            subscribeToProfile(uid);
          }
        } else {
          // Signed out
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
        channelRef.current = null;
      }
    };
  }, [fetchAndSetProfile, createProfile, subscribeToProfile]);

  const signIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) {
        console.error('Sign in error:', error.message);
      }
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!currentUidRef.current || !user) return;
    const uid = currentUidRef.current;

    // Optimistic update to prevent redirect loops during onboarding
    const prevUser = { ...user };
    setUser({ ...user, ...updates });

    // Sticky onboarded state
    if (updates.onboarded) {
      localStorage.setItem(`onboarded_${uid}`, 'true');
    }

    const profileUpdates = userUpdatesToProfile(updates);

    try {
      const { error } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', uid);

      if (error) {
        console.error('[updateUser] Supabase write FAILED:', error.message);
        // Rollback on error
        setUser(prevUser);
        if (updates.onboarded) {
          localStorage.removeItem(`onboarded_${uid}`);
        }
        throw error;
      }
    } catch (err) {
      // Re-throw so callers (e.g. onboarding) see the error
      throw err;
    }
  };

  const togglePreference = async (key: keyof typeof preferences) => {
    if (!currentUidRef.current) return;
    const uid = currentUidRef.current;
    const newPrefs = { ...preferences, [key]: !preferences[key] };

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ preferences: newPrefs })
        .eq('id', uid);

      if (error) {
        console.error('[togglePreference] Supabase write FAILED:', error.message);
      }
    } catch (err) {
      console.error('[togglePreference] error:', err);
    }
  };

  const updateMembership = async (plan: string) => {
    if (!currentUidRef.current) return;
    const uid = currentUidRef.current;
    const plans: Record<string, { price: string; nextBilling: string }> = {
      'Starter': { price: '$0/mo', nextBilling: 'N/A' },
      'Professional': { price: '$29/mo', nextBilling: 'April 20, 2026' },
      'Enterprise': { price: '$99/mo', nextBilling: 'April 20, 2026' },
    };
    const newMembership = {
      plan,
      price: plans[plan].price,
      nextBilling: plans[plan].nextBilling,
      status: 'Active',
    };

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ membership: newMembership })
        .eq('id', uid);

      if (error) {
        console.error('[updateMembership] Supabase write FAILED:', error.message);
      }
    } catch (err) {
      console.error('[updateMembership] error:', err);
    }
  };

  const cancelMembership = async () => {
    if (!currentUidRef.current) return;
    const uid = currentUidRef.current;
    const newMembership = { ...membership, status: 'Cancelled', nextBilling: 'Ends April 20, 2026' };

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ membership: newMembership })
        .eq('id', uid);

      if (error) {
        console.error('[cancelMembership] Supabase write FAILED:', error.message);
      }
    } catch (err) {
      console.error('[cancelMembership] error:', err);
    }
  };

  return (
    <UserContext.Provider value={{
      user,
      loading,
      signIn,
      signOut,
      updateUser,
      membership,
      updateMembership,
      cancelMembership,
      preferences,
      togglePreference,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
