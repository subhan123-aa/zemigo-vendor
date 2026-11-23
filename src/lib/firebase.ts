import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const env = import.meta.env as Record<string, string | undefined>;

/**
 * Shared ZemiGo Firebase configuration compatible across:
 * 1. ZemiGo Customer App (`zemigo` — `EXPO_PUBLIC_FIREBASE_*`)
 * 2. ZemiGo Admin Panel (`zemigo-admin` — `VITE_FIREBASE_*`)
 * 3. ZemiGo Vendor Panel (`zemigo-vendor` — `VITE_FIREBASE_*`)
 *
 * Security Note:
 * Only public Firebase Web client keys belong here. Never include Firebase Admin SDK
 * service account credentials in any frontend application.
 */
export const firebaseConfig = {
  apiKey: (
    env.VITE_FIREBASE_API_KEY ||
    env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    ''
  ).trim(),
  authDomain: (
    env.VITE_FIREBASE_AUTH_DOMAIN ||
    env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    ''
  ).trim(),
  projectId: (
    env.VITE_FIREBASE_PROJECT_ID ||
    env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
    ''
  ).trim(),
  storageBucket: (
    env.VITE_FIREBASE_STORAGE_BUCKET ||
    env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    ''
  ).trim(),
  messagingSenderId: (
    env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    ''
  ).trim(),
  appId: (
    env.VITE_FIREBASE_APP_ID ||
    env.EXPO_PUBLIC_FIREBASE_APP_ID ||
    ''
  ).trim(),
};

/**
 * True when real Firebase project credentials are provided via `.env`.
 */
export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

/**
 * Canonical Firestore collection names shared across all three ZemiGo apps.
 */
export const ZEMIGO_COLLECTIONS = {
  users: 'users',
  vendors: 'vendors',
  products: 'products',
  categories: 'categories',
  banners: 'banners',
  orders: 'orders',
  coupons: 'coupons',
  payouts: 'payouts',
  commissions: 'commissions',
  settings: 'settings',
} as const;

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  authInstance = getAuth(appInstance);
  void setPersistence(authInstance, browserLocalPersistence).catch(() => {
    // Fallback to default persistence if restricted by browser storage settings
  });
  dbInstance = getFirestore(appInstance);
  storageInstance = getStorage(appInstance);
  storageInstance.maxUploadRetryTime = 5000;
  storageInstance.maxOperationRetryTime = 5000;
}

export const firebaseApp = appInstance;
export const firebaseAuth = authInstance;
export const firestoreDb = dbInstance;
export const firebaseStorage = storageInstance;
