import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
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
} from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
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
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (error) {
  console.warn('Firebase Analytics initialization failed (this is okay in development)', error);
}

const googleProvider = new GoogleAuthProvider();

// Auth functions
export const signInWithGoogle = async () => {
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
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
    
    // Clear Sentry user context
    setSentryUser(null);
    addSentryBreadcrumb('auth', 'User signed out');
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Firestore functions
export const savePromptToFirestore = async (userId, promptData) => {
  try {
    const uuid = uuidv4();
    const payload = {
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
};

export const getUserPrompts = async (userId, limitCount = 10) => {
  try {
    const q = query(
      collection(db, 'prompts'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      // Convert Firestore timestamp to ISO string
      let timestamp = data.timestamp;
      if (timestamp && timestamp.toDate) {
        // It's a Firestore Timestamp object
        timestamp = timestamp.toDate().toISOString();
      } else if (!timestamp) {
        // Fallback for missing timestamp
        timestamp = new Date().toISOString();
      }
      let highlightCache = data.highlightCache ?? null;
      if (highlightCache) {
        const converted = { ...highlightCache };
        if (converted.updatedAt?.toDate) {
          converted.updatedAt = converted.updatedAt.toDate().toISOString();
        }
        highlightCache = converted;
      }
      let versions = Array.isArray(data.versions) ? data.versions : [];
      versions = versions.map((entry) => {
        const item = { ...entry };
        if (item.timestamp?.toDate) {
          item.timestamp = item.timestamp.toDate().toISOString();
        }
        return item;
      });
      return {
        id: doc.id,
        ...data,
        timestamp, // Override with converted timestamp
        highlightCache,
        versions,
      };
    });
  } catch (error) {
    // Check for index error - silently return empty array
    if (error.code === 'failed-precondition' || error.message?.includes('index')) {
      
      return [];
    }

    // For other errors, log and throw
    console.error('Error fetching prompts:', error);
    throw error;
  }
};

// Check user's prompts (simple query without orderBy to avoid index)
export const checkUserPromptsRaw = async (userId) => {
  try {
    const q = query(
      collection(db, 'prompts'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      let timestamp = data.timestamp;
      if (timestamp && timestamp.toDate) {
        timestamp = timestamp.toDate().toISOString();
      } else if (!timestamp) {
        timestamp = new Date().toISOString();
      }
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
};

// Delete user's prompts (simple query without orderBy to avoid index)
export const deleteUserPromptsRaw = async (userId) => {
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
};

export const updatePromptHighlightsInFirestore = async (docId, { highlightCache, versionEntry }) => {
  try {
    if (!docId) return;
    const updatePayload = {};
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
};

// Delete all user's prompts (for migration)
export const deleteAllUserPrompts = async (userId) => {
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
};

// Get prompt by UUID
export const getPromptByUuid = async (uuid) => {
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
    const data = doc.data();

    // Convert Firestore timestamp to ISO string
    let timestamp = data.timestamp;
    if (timestamp && timestamp.toDate) {
      timestamp = timestamp.toDate().toISOString();
    } else if (!timestamp) {
      timestamp = new Date().toISOString();
    }

    let highlightCache = data.highlightCache ?? null;
    if (highlightCache) {
      const converted = { ...highlightCache };
      if (converted.updatedAt?.toDate) {
        converted.updatedAt = converted.updatedAt.toDate().toISOString();
      }
      highlightCache = converted;
    }

    let versions = Array.isArray(data.versions) ? data.versions : [];
    versions = versions.map((entry) => {
      const item = { ...entry };
      if (item.timestamp?.toDate) {
        item.timestamp = item.timestamp.toDate().toISOString();
      }
      return item;
    });

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
};

export { auth, db, analytics };
