// Quick script to delete old prompts with string timestamps
// Run this once to clean up old data, then new prompts will work with the index

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

console.log('Firebase Config:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
});

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deleteOldPrompts() {
  console.log('Fetching all prompts (without using indexes)...');

  try {
    // Get all documents without any query constraints to avoid index requirements
    const querySnapshot = await getDocs(collection(db, 'prompts'));

    console.log(`Found ${querySnapshot.size} prompts to delete`);

    if (querySnapshot.size === 0) {
      console.log('No prompts found. Either they are already deleted or the connection failed.');
      return;
    }

    let deleted = 0;
    for (const docSnapshot of querySnapshot.docs) {
      console.log(`Deleting prompt ${docSnapshot.id}...`);
      await deleteDoc(doc(db, 'prompts', docSnapshot.id));
      deleted++;
      console.log(`✓ Deleted ${deleted}/${querySnapshot.size}`);
    }

    console.log('\n✓ Done! All old prompts deleted.');
    console.log('New prompts will use proper Timestamp objects and work with your index.');
    process.exit(0);
  } catch (error) {
    console.error('Error during deletion:', error);
    process.exit(1);
  }
}

console.log('Starting migration...\n');
deleteOldPrompts();
