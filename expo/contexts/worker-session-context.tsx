import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError, syncWorkerAuth } from '@/lib/api';
import { auth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from '@/lib/firebase';
import type { WorkerSession } from '@/lib/types';

const SESSION_STORAGE_KEY = 'buildsync_worker_mobile_session';

type WorkerSessionContextValue = {
  user: WorkerSession;
  firebaseUser: User | null;
  authLoaded: boolean;
  syncing: boolean;
  degraded: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  refresh: () => Promise<void>;
  updateLocalUser: (updates: Partial<WorkerSession>) => void;
};

const defaultUser: WorkerSession = {
  firebaseUid: null,
  mongoId: null,
  firstName: null,
  lastName: null,
  email: null,
  phone: null,
  photoUrl: null,
  role: 'worker',
};

const WorkerSessionContext = createContext<WorkerSessionContextValue | null>(null);

function splitDisplayName(name?: string | null) {
  const fullName = (name ?? '').trim();
  if (!fullName) {
    return { firstName: null as string | null, lastName: null as string | null };
  }
  const [firstName, ...remaining] = fullName.split(' ');
  return {
    firstName: firstName || null,
    lastName: remaining.join(' ') || null,
  };
}

export function WorkerSessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<WorkerSession>(defaultUser);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SESSION_STORAGE_KEY)
      .then((value) => {
        if (!value) return;
        const parsed = JSON.parse(value) as WorkerSession;
        setUser({ ...defaultUser, ...parsed, role: 'worker' });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user.firebaseUid) {
      AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user)).catch(() => {});
      return;
    }
    AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(() => {});
  }, [user]);

  const refresh = useCallback(async () => {
    if (!firebaseUser) return;

    setSyncing(true);
    setError(null);

    try {
      const token = await firebaseUser.getIdToken();
      const syncedUser = await syncWorkerAuth(token);
      setUser({ ...syncedUser, role: 'worker' });
      setDegraded(false);
    } catch (err) {
      const fromProfile = splitDisplayName(firebaseUser.displayName);
      setUser((prev) => ({
        ...prev,
        firebaseUid: firebaseUser.uid,
        email: prev.email ?? firebaseUser.email ?? null,
        photoUrl: prev.photoUrl ?? firebaseUser.photoURL ?? null,
        firstName: prev.firstName ?? fromProfile.firstName,
        lastName: prev.lastName ?? fromProfile.lastName,
        role: 'worker',
      }));
      setDegraded(true);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Profile sync is currently unavailable.');
      }
    } finally {
      setSyncing(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthLoaded(true);

      if (!fbUser) {
        setUser(defaultUser);
        setDegraded(false);
        setError(null);
        return;
      }

      const name = splitDisplayName(fbUser.displayName);
      setUser((prev) => ({
        ...prev,
        firebaseUid: fbUser.uid,
        email: prev.email ?? fbUser.email ?? null,
        photoUrl: prev.photoUrl ?? fbUser.photoURL ?? null,
        firstName: prev.firstName ?? name.firstName,
        lastName: prev.lastName ?? name.lastName,
        role: 'worker',
      }));
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (firebaseUser) {
      refresh();
    }
  }, [firebaseUser, refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    await signInWithEmailAndPassword(auth, email.trim(), password);
    router.replace('/');
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
    setUser(defaultUser);
    setDegraded(false);
    setError(null);
    router.replace('/login');
  }, []);

  const updateLocalUser = useCallback((updates: Partial<WorkerSession>) => {
    setUser((prev) => ({ ...prev, ...updates }));
  }, []);

  const value = useMemo(
    () => ({
      user,
      firebaseUser,
      authLoaded,
      syncing,
      degraded,
      error,
      signIn,
      signOutUser,
      refresh,
      updateLocalUser,
    }),
    [user, firebaseUser, authLoaded, syncing, degraded, error, signIn, signOutUser, refresh, updateLocalUser]
  );

  return <WorkerSessionContext.Provider value={value}>{children}</WorkerSessionContext.Provider>;
}

export function useWorkerSession() {
  const context = useContext(WorkerSessionContext);
  if (!context) {
    throw new Error('useWorkerSession must be used within WorkerSessionProvider');
  }
  return context;
}
