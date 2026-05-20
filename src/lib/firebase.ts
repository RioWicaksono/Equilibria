/**
 * Firebase Configuration - Client Side
 * Single source of truth for Firebase initialization
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDdR8xcaWGqQ-9ElIWJpeiNUSXky-98a40',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'my-project-7725-1741684398090.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'my-project-7725-1741684398090',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'my-project-7725-1741684398090.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '621614980711',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:621614980711:web:0ad312d2ce2d073d84fec2',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-6b3baddc-34fa-4d39-87b3-c0a741ff01cc',
};

// Initialize Firebase app (singleton)
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with specific database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Export app for advanced usage
export default app;