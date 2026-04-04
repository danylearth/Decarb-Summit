import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';

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

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState({
    plan: 'Starter',
    price: '$0/mo',
    status: 'Active',
    nextBilling: 'N/A',
  });
  const [preferences, setPreferences] = useState({
    pushNotifications: true,
    publicProfile: false,
  });

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous profile listener if it exists
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = undefined;
      }

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Listen for real-time updates to the user profile
        unsubProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as User & { membership: any, preferences: any };
            // localStorage is the sticky source of truth for onboarded state
            const localOnboarded = localStorage.getItem(`onboarded_${firebaseUser.uid}`) === 'true';
            const isOnboarded = !!data.onboarded || localOnboarded;

            // Once onboarded, persist it so it can never flip back
            if (isOnboarded && !localOnboarded) {
              localStorage.setItem(`onboarded_${firebaseUser.uid}`, 'true');
            }

            setUser({
              id: data.id || docSnap.id,
              name: data.name ?? '',
              handle: data.handle ?? '',
              role: data.role ?? '',
              company: data.company ?? '',
              avatar: data.avatar ?? '',
              bio: data.bio ?? '',
              tags: data.tags ?? [],
              linkedin: data.linkedin ?? '',
              twitter: data.twitter ?? '',
              onboarded: isOnboarded,
              isAdmin: !!data.isAdmin,
            });
            
            if (data.membership) setMembership(data.membership);
            if (data.preferences) setPreferences(data.preferences);
          } else {
            // Initialize new user profile
            const newUser: any = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'New User',
              email: firebaseUser.email,
              handle: firebaseUser.email?.split('@')[0] || 'user',
              role: 'Community Member',
              company: '',
              avatar: firebaseUser.photoURL || `https://picsum.photos/seed/${firebaseUser.uid}/200/200`,
              linkedin: '',
              twitter: '',
              onboarded: false,
              membership: {
                plan: 'Starter',
                price: '$0/mo',
                status: 'Active',
                nextBilling: 'N/A',
              },
              preferences: {
                pushNotifications: true,
                publicProfile: false,
              }
            };
            setDoc(userRef, newUser).catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${firebaseUser.uid}`));
          }
          setLoading(false);
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!auth.currentUser || !user) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);

    // Optimistic update to prevent redirect loops during onboarding
    const prevUser = { ...user };
    setUser({ ...user, ...updates });

    // Sticky onboarded state
    if (updates.onboarded) {
      localStorage.setItem(`onboarded_${auth.currentUser.uid}`, 'true');
    }

    // Clean updates for Firestore rules compliance
    const cleanedUpdates: Record<string, any> = { ...updates };
    ['linkedin', 'twitter', 'avatar'].forEach(field => {
      if (field in cleanedUpdates) {
        const val = cleanedUpdates[field];
        if (!val || val === '') {
          // Remove empty strings — rules require valid URLs
          delete cleanedUpdates[field];
        } else if (typeof val === 'string' && !val.startsWith('http://') && !val.startsWith('https://')) {
          // Auto-prefix with https:// if missing
          cleanedUpdates[field] = `https://${val}`;
        }
      }
    });

    try {
      await updateDoc(userRef, cleanedUpdates);
    } catch (err: any) {
      console.error('[updateUser] Firestore write FAILED:', err?.code, err?.message);
      // Rollback on error
      setUser(prevUser);
      if (updates.onboarded) {
        localStorage.removeItem(`onboarded_${auth.currentUser.uid}`);
      }
      handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
      throw err; // Re-throw so onboarding catch block sees it
    }
  };

  const togglePreference = async (key: keyof typeof preferences) => {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const newPrefs = { ...preferences, [key]: !preferences[key] };
    try {
      await updateDoc(userRef, { preferences: newPrefs });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  const updateMembership = async (plan: string) => {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const plans: Record<string, any> = {
      'Starter': { price: '$0/mo', nextBilling: 'N/A' },
      'Professional': { price: '$29/mo', nextBilling: 'April 20, 2026' },
      'Enterprise': { price: '$99/mo', nextBilling: 'April 20, 2026' },
    };
    const newMembership = {
      plan,
      price: plans[plan].price,
      nextBilling: plans[plan].nextBilling,
      status: 'Active'
    };
    try {
      await updateDoc(userRef, { membership: newMembership });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  const cancelMembership = async () => {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const newMembership = { ...membership, status: 'Cancelled', nextBilling: 'Ends April 20, 2026' };
    try {
      await updateDoc(userRef, { membership: newMembership });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
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
      togglePreference
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
