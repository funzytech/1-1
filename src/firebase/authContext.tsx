import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  User,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleAuthProvider, isFirebaseConfigured } from './config';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  provider: string;
  emailVerified: boolean;
  createdAt?: string;
  lastLoginAt: string;
}

export interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  clearError: () => void;
  signInWithGoogle: (preferredName?: string) => Promise<User | null>;
  signOutUser: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Set persistent session in browser storage
  useEffect(() => {
    if (isFirebaseConfigured) {
      setPersistence(auth, browserLocalPersistence).catch((err) => {
        console.warn('Firebase persistence warning:', err);
      });
    }
  }, []);

  // Sync profile document with Firestore
  const syncUserProfile = async (firebaseUser: User, customName?: string) => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const snapshot = await getDoc(userRef);

      const now = new Date().toISOString();
      const existingData = snapshot.exists() ? (snapshot.data() as UserProfile) : null;

      const profileData: UserProfile = {
        uid: firebaseUser.uid,
        displayName:
          customName?.trim() ||
          existingData?.displayName ||
          firebaseUser.displayName ||
          'Google User',
        email: firebaseUser.email || existingData?.email || '',
        photoURL: firebaseUser.photoURL || existingData?.photoURL || '',
        provider: 'google.com',
        emailVerified: firebaseUser.emailVerified,
        createdAt: existingData?.createdAt || now,
        lastLoginAt: now,
      };

      await setDoc(userRef, profileData, { merge: true });
      setUserProfile(profileData);
      return profileData;
    } catch (err) {
      console.warn('Firestore profile sync note (database permissions or offline):', err);
      // Fallback local representation if Firestore is restricted
      const fallbackProfile: UserProfile = {
        uid: firebaseUser.uid,
        displayName: customName?.trim() || firebaseUser.displayName || 'Google User',
        email: firebaseUser.email || '',
        photoURL: firebaseUser.photoURL || '',
        provider: 'google.com',
        emailVerified: firebaseUser.emailVerified,
        lastLoginAt: new Date().toISOString(),
      };
      setUserProfile(fallbackProfile);
      return fallbackProfile;
    }
  };

  // Primary Auth State Listener
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          await syncUserProfile(currentUser);
        } else {
          setUserProfile(null);
        }
        setLoading(false);
      },
      (authError) => {
        console.error('Firebase Auth State Error:', authError);
        setError('Authentication service error: ' + authError.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Map Firebase Error Codes to human-friendly messages
  const mapFirebaseError = (errorCode: string, defaultMessage: string): string => {
    switch (errorCode) {
      case 'auth/popup-closed-by-user':
        return 'Sign-in cancelled before completion.';
      case 'auth/popup-blocked':
        return 'The Google sign-in pop-up was blocked by your browser. Please allow popups or disable strict popup blockers for this site.';
      case 'auth/unauthorized-domain':
        return 'This domain is not authorized in Firebase Authentication. Please add this domain under Firebase Console > Authentication > Settings > Authorized domains.';
      case 'auth/operation-not-allowed':
        return 'Google sign-in is not enabled in Firebase Console. Please enable Google provider in Firebase Console > Authentication > Sign-in method.';
      case 'auth/network-request-failed':
        return 'Network connection error. Please check your internet connectivity.';
      case 'auth/cancelled-popup-request':
        return 'Another sign-in attempt is already underway.';
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with the same email using a different sign-in method.';
      case 'auth/user-not-found':
        return 'No registered account found with this email address.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/missing-email':
        return 'Please enter an email address.';
      case 'auth/internal-error':
        return 'An internal authentication error occurred. Please try again.';
      default:
        return defaultMessage || 'An authentication error occurred. Please try again.';
    }
  };

  // Google Sign-In with Popup
  const signInWithGoogle = async (preferredName?: string): Promise<User | null> => {
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const authenticatedUser = result.user;
      setUser(authenticatedUser);
      await syncUserProfile(authenticatedUser, preferredName);
      return authenticatedUser;
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      const code = errorObj.code || '';
      const mappedMsg = mapFirebaseError(code, errorObj.message || 'Authentication failed');
      setError(mappedMsg);
      console.warn('Google Sign-In caught error:', code, errorObj.message);
      throw new Error(mappedMsg);
    }
  };

  // Send Password Reset Email Flow
  const sendPasswordReset = async (email: string): Promise<void> => {
    setError(null);
    if (!email || !email.includes('@')) {
      const err = 'Please enter a valid email address for password reset.';
      setError(err);
      throw new Error(err);
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      const code = errorObj.code || '';
      const mappedMsg = mapFirebaseError(code, errorObj.message || 'Failed to send password reset email.');
      setError(mappedMsg);
      console.warn('Password reset caught error:', code, errorObj.message);
      throw new Error(mappedMsg);
    }
  };

  // Sign Out
  const signOutUser = async (): Promise<void> => {
    setError(null);
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      const msg = errorObj.message || 'Failed to sign out';
      setError(msg);
      throw new Error(msg);
    }
  };

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      userProfile,
      loading,
      isAuthenticated: Boolean(user),
      error,
      clearError,
      signInWithGoogle,
      signOutUser,
      sendPasswordReset,
    }),
    [user, userProfile, loading, error]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
