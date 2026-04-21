import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAvea9t-gCnGKfH-gfYyu5Xw94Py7jZ3G0',
  authDomain: 'mini-7efe8.firebaseapp.com',
  projectId: 'mini-7efe8',
  storageBucket: 'mini-7efe8.firebasestorage.app',
  messagingSenderId: '228588163466',
  appId: '1:228588163466:web:699d7f4b38aa16b669b873',
  measurementId: 'G-6JZZ3SKVYW',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e) {
  auth = getAuth(app);
}

export { app, auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut };
export type { User };
