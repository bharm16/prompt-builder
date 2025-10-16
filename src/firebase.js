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
} from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { v4 as uuidv4 } from 'uuid';

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
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Firestore functions
export const savePromptToFirestore = async (userId, promptData) => {
  try {
    const uuid = uuidv4();
    const docRef = await addDoc(collection(db, 'prompts'), {
      userId,
      uuid,
      ...promptData,
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
      return {
        id: doc.id,
        ...data,
        timestamp, // Override with converted timestamp
      };
    });
  } catch (error) {
    // Check for index error - silently return empty array
    if (error.code === 'failed-precondition' || error.message?.includes('index')) {
      console.info('Firestore index not yet created. History will be available once the index is built.');
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
    console.info('Total prompts for user:', { userId, count: querySnapshot.size });
    querySnapshot.docs.forEach((doc) => {
      const data = doc.data();
      let timestamp = data.timestamp;
      if (timestamp && timestamp.toDate) {
        timestamp = timestamp.toDate().toISOString();
      }
      console.debug('Prompt details:', {
        id: doc.id,
        timestamp: timestamp,
        timestampType: typeof timestamp,
        input: data.input?.substring(0, 50)
      });
    });
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
    console.info('Found prompts to delete:', { userId, count: querySnapshot.size });

    const deletePromises = querySnapshot.docs.map((doc) =>
      deleteDoc(doc.ref)
    );

    await Promise.all(deletePromises);
    console.info('All prompts deleted successfully:', { userId, count: querySnapshot.size });
    return querySnapshot.size;
  } catch (error) {
    console.error('Error deleting prompts:', error);
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

    console.info('Found prompts to delete for migration:', { userId, count: querySnapshot.size });

    const deletePromises = querySnapshot.docs.map((doc) =>
      deleteDoc(doc.ref)
    );

    await Promise.all(deletePromises);
    console.info('All prompts deleted successfully (migration):', { userId, count: querySnapshot.size });
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

    return {
      id: doc.id,
      ...data,
      timestamp,
    };
  } catch (error) {
    console.error('Error fetching prompt by UUID:', error);
    throw error;
  }
};

export { auth, db, analytics };
