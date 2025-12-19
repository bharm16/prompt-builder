import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  type Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { getAnalytics, type Analytics } from 'firebase/analytics';
import { v4 as uuidv4 } from 'uuid';
import { setSentryUser, addSentryBreadcrumb } from './sentry';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Analytics (optional - may fail in dev or if blocked)
let analytics: Analytics | null = null;
try {
  analytics = getAnalytics(app);
} catch (error) {
  console.warn('Firebase Analytics initialization failed (this is okay in development)', error);
}

const googleProvider = new GoogleAuthProvider();

// Types for prompt data
export interface HighlightCache {
  updatedAt?: string | Timestamp;
  [key: string]: unknown;
}

export interface VersionEntry {
  timestamp?: string | Timestamp;
  [key: string]: unknown;
}

export interface PromptData {
  highlightCache?: HighlightCache | null;
  versions?: VersionEntry[];
  [key: string]: unknown;
}

export interface SavedPromptResult {
  id: string;
  uuid: string;
}

export interface FirestorePrompt extends DocumentData {
  userId: string;
  uuid: string;
  timestamp?: Timestamp | string;
  highlightCache?: HighlightCache | null;
  versions?: VersionEntry[];
  [key: string]: unknown;
}

export interface PromptDocument {
  id: string;
  uuid?: string;
  timestamp: string;
  highlightCache?: HighlightCache | null;
  versions?: VersionEntry[];
  userId?: string;
  [key: string]: unknown;
}

interface FirestoreError extends Error {
  code?: string;
  message?: string;
}

function isFirestoreError(error: unknown): error is FirestoreError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

function convertTimestamp(timestamp: Timestamp | string | undefined): string {
  if (!timestamp) {
    return new Date().toISOString();
  }
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  if ('toDate' in timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  return new Date().toISOString();
}

function convertHighlightCache(cache: HighlightCache | null | undefined): HighlightCache | null {
  if (!cache) {
    return null;
  }
  const converted = { ...cache };
  if (converted.updatedAt && typeof converted.updatedAt === 'object' && 'toDate' in converted.updatedAt) {
    converted.updatedAt = (converted.updatedAt as Timestamp).toDate().toISOString();
  }
  return converted;
}

function convertVersions(versions: VersionEntry[] | undefined): VersionEntry[] {
  if (!Array.isArray(versions)) {
    return [];
  }
  return versions.map((entry) => {
    const item = { ...entry };
    if (item.timestamp && typeof item.timestamp === 'object' && 'toDate' in item.timestamp) {
      item.timestamp = (item.timestamp as Timestamp).toDate().toISOString();
    }
    return item;
  });
}

// Auth functions
export async function signInWithGoogle(): Promise<FirebaseUser> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    
    // Set Sentry user context
    setSentryUser(result.user);
    addSentryBreadcrumb('auth', 'User signed in with Google', {
      userId: result.user.uid,
    });
    
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
    
    // Clear Sentry user context
    setSentryUser(null);
    addSentryBreadcrumb('auth', 'User signed out');
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

// Firestore functions
export async function savePromptToFirestore(
  userId: string,
  promptData: PromptData
): Promise<SavedPromptResult> {
  try {
    const uuid = uuidv4();
    const payload: PromptData = {
      highlightCache: promptData.highlightCache ?? null,
      versions: Array.isArray(promptData.versions) ? promptData.versions : [],
      ...promptData,
    };
    const docRef = await addDoc(collection(db, 'prompts'), {
      userId,
      uuid,
      ...payload,
      timestamp: serverTimestamp(),
    });
    return { id: docRef.id, uuid };
  } catch (error) {
    console.error('Error saving prompt:', error);
    throw error;
  }
}

export async function getUserPrompts(
  userId: string,
  limitCount: number = 10
): Promise<PromptDocument[]> {
  try {
    const q = query(
      collection(db, 'prompts'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data() as FirestorePrompt;
      const timestamp = convertTimestamp(data.timestamp);
      const highlightCache = convertHighlightCache(data.highlightCache);
      const versions = convertVersions(data.versions);
      
      return {
        id: doc.id,
        ...data,
        timestamp,
        highlightCache,
        versions,
      };
    });
  } catch (error) {
    // Check for index error - silently return empty array
    if (isFirestoreError(error) && (error.code === 'failed-precondition' || error.message?.includes('index'))) {
      return [];
    }

    // For other errors, log and throw
    console.error('Error fetching prompts:', error);
    throw error;
  }
}

// Check user's prompts (simple query without orderBy to avoid index)
export async function checkUserPromptsRaw(userId: string): Promise<PromptDocument[]> {
  try {
    const q = query(
      collection(db, 'prompts'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data() as FirestorePrompt;
      const timestamp = convertTimestamp(data.timestamp);
      
      return {
        id: doc.id,
        ...data,
        timestamp
      };
    });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    throw error;
  }
}

// Delete user's prompts (simple query without orderBy to avoid index)
export async function deleteUserPromptsRaw(userId: string): Promise<number> {
  try {
    const q = query(
      collection(db, 'prompts'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    

    const deletePromises = querySnapshot.docs.map((doc) =>
      deleteDoc(doc.ref)
    );

    await Promise.all(deletePromises);
    
    return querySnapshot.size;
  } catch (error) {
    console.error('Error deleting prompts:', error);
    throw error;
  }
}

export async function updatePromptHighlightsInFirestore(
  docId: string,
  { highlightCache, versionEntry }: { highlightCache?: HighlightCache | null; versionEntry?: VersionEntry }
): Promise<void> {
  try {
    if (!docId) return;
    const updatePayload: Record<string, unknown> = {};
    if (highlightCache) {
      updatePayload.highlightCache = {
        ...highlightCache,
        updatedAt: new Date().toISOString(),
      };
    }
    if (versionEntry) {
      updatePayload.versions = arrayUnion({
        ...versionEntry,
        timestamp: versionEntry.timestamp || new Date().toISOString(),
      });
    }
    if (Object.keys(updatePayload).length === 0) {
      return;
    }
    await updateDoc(doc(db, 'prompts', docId), updatePayload);
  } catch (error) {
    console.error('Error updating prompt highlights:', error);
    throw error;
  }
}

// Delete all user's prompts (for migration)
export async function deleteAllUserPrompts(userId: string): Promise<number> {
  try {
    const q = query(
      collection(db, 'prompts'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);

    

    const deletePromises = querySnapshot.docs.map((doc) =>
      deleteDoc(doc.ref)
    );

    await Promise.all(deletePromises);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error deleting prompts during migration:', error);
    throw error;
  }
}

// Get prompt by UUID
export async function getPromptByUuid(uuid: string): Promise<PromptDocument | null> {
  try {
    const q = query(
      collection(db, 'prompts'),
      where('uuid', '==', uuid),
      limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data() as FirestorePrompt;

    const timestamp = convertTimestamp(data.timestamp);
    const highlightCache = convertHighlightCache(data.highlightCache);
    const versions = convertVersions(data.versions);

    return {
      id: doc.id,
      ...data,
      timestamp,
      highlightCache,
      versions,
    };
  } catch (error) {
    console.error('Error fetching prompt by UUID:', error);
    throw error;
  }
}

export { auth, db, analytics };

