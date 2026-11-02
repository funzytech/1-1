import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Import provisioned config if available
import appletConfig from '../../firebase-applet-config.json';

// Priority 1: Vite Environment Variables (import.meta.env)
// Priority 2: Provisioned firebase-applet-config.json
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.authDomain
);

// Centralized Resilient Singleton Initialization
let appInstance: FirebaseApp;
try {
  appInstance = getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);
} catch (err) {
  console.warn('Firebase initializeApp safe fallback:', err);
  try {
    appInstance = initializeApp(
      {
        apiKey: firebaseConfig.apiKey || 'AIzaSyAopsExVTLcVs9lHEk3kPi7Im-UJbnvgQ8',
        projectId: firebaseConfig.projectId || 'gen-lang-client-0113225813',
      },
      'fallbackApp'
    );
  } catch {
    appInstance = {} as FirebaseApp;
  }
}
export const app: FirebaseApp = appInstance;

let authInstance: Auth;
try {
  authInstance = getAuth(app);
} catch (err) {
  console.warn('Firebase getAuth safe fallback:', err);
  authInstance = {} as Auth;
}
export const auth: Auth = authInstance;

let dbInstance: Firestore;
try {
  dbInstance = appletConfig.firestoreDatabaseId
    ? getFirestore(app, appletConfig.firestoreDatabaseId)
    : getFirestore(app);
} catch (err) {
  console.warn('Firebase getFirestore with custom ID warning, falling back to default:', err);
  try {
    dbInstance = getFirestore(app);
  } catch (err2) {
    console.warn('Firebase getFirestore safe fallback:', err2);
    dbInstance = {} as Firestore;
  }
}
export const db: Firestore = dbInstance;

// Official Google Auth Provider with recommended scopes (Basic profile & email only)
let providerInstance = new GoogleAuthProvider();
try {
  providerInstance.setCustomParameters({
    prompt: 'select_account',
  });
} catch {}
export const googleAuthProvider = providerInstance;

