/**
 * Firebase Configuration - Infrastructure Layer
 * Handles Firebase client initialization
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Firebase config interface
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
}

// Lazy initialization
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;

/**
 * Initialize Firebase app (singleton pattern)
 */
export function initializeFirebase(): FirebaseApp {
  if (app) return app;

  const config: FirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDdR8xcaWGqQ-9ElIWJpeiNUSXky-98a40',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'my-project-7725-1741684398090.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'my-project-7725-1741684398090',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'my-project-7725-1741684398090.firebasestorage.app',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '621614980711',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:621614980711:web:0ad312d2ce2d073d84fec2',
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-6b3baddc-34fa-4d39-87b3-c0a741ff01cc',
  };

  app = initializeApp(config);
  return app;
}

/**
 * Get Firebase Auth instance
 */
export function getFirebaseAuth(): Auth {
  if (!auth) {
    const firebaseApp = initializeFirebase();
    auth = getAuth(firebaseApp);
  }
  return auth;
}

/**
 * Get Firebase Firestore instance with correct database ID
 */
export function getFirebaseFirestore(): Firestore {
  if (!db) {
    const firebaseApp = initializeFirebase();
    const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-6b3baddc-34fa-4d39-87b3-c0a741ff01cc';
    db = getFirestore(firebaseApp, databaseId);
  }
  return db;
}

/**
 * Get Google Auth Provider
 */
export function getGoogleProvider(): GoogleAuthProvider {
  if (!googleProvider) {
    googleProvider = new GoogleAuthProvider();
    googleProvider.addScope('email');
    googleProvider.addScope('profile');
  }
  return googleProvider;
}

// Export singleton instances
export const firebaseApp = {
  get instance() {
    return initializeFirebase();
  },
};

export const firebaseAuth = {
  get instance() {
    return getFirebaseAuth();
  },
};

export const firebaseDb = {
  get instance() {
    return getFirebaseFirestore();
  },
};

export const googleAuthProvider = {
  get instance() {
    return getGoogleProvider();
  },
};