import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  updateProfile,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAvea9t-gCnGKfH-gfYyu5Xw94Py7jZ3G0",
  authDomain: "mini-7efe8.firebaseapp.com",
  projectId: "mini-7efe8",
  storageBucket: "mini-7efe8.firebasestorage.app",
  messagingSenderId: "228588163466",
  appId: "1:228588163466:web:699d7f4b38aa16b669b873",
  measurementId: "G-6JZZ3SKVYW",
};

// Initialize Firebase (prevent duplicate initialization)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export {
  app,
  auth,
  googleProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  updateProfile,
  onAuthStateChanged,
};
export type { User };
