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
} from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

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
const analytics = getAnalytics(app);
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
    const docRef = await addDoc(collection(db, 'prompts'), {
      userId,
      ...promptData,
      timestamp: serverTimestamp(),
    });
    return docRef.id;
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
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    // Check for index error - silently return empty array
    if (error.code === 'failed-precondition' || error.message?.includes('index')) {
      console.log('Firestore index not yet created. History will be available once the index is built.');
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
    console.log(`Total prompts for user: ${querySnapshot.size}`);
    querySnapshot.docs.forEach((doc) => {
      const data = doc.data();
      console.log('Prompt:', doc.id, {
        timestamp: data.timestamp,
        timestampType: typeof data.timestamp,
        input: data.input?.substring(0, 50)
      });
    });
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    console.log(`Found ${querySnapshot.size} prompts to delete`);

    const deletePromises = querySnapshot.docs.map((doc) =>
      deleteDoc(doc.ref)
    );

    await Promise.all(deletePromises);
    console.log('All prompts deleted successfully');
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

    console.log(`Found ${querySnapshot.size} prompts to delete`);

    const deletePromises = querySnapshot.docs.map((doc) =>
      deleteDoc(doc.ref)
    );

    await Promise.all(deletePromises);
    console.log('All prompts deleted successfully');
    return querySnapshot.size;
  } catch (error) {
    console.error('Error deleting prompts:', error);
    throw error;
  }
};

export { auth, db, analytics };
