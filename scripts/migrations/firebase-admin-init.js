import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

// Load environment variables
dotenv.config();

let db = null;

/**
 * Initialize Firebase Admin SDK
 * 
 * Supports two authentication methods:
 * 1. Service Account JSON file (FIREBASE_SERVICE_ACCOUNT_PATH)
 * 2. Application Default Credentials (for Cloud Run, GCE)
 */
export function initializeFirebaseAdmin() {
  if (db) {
    return db;
  }

  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    
    if (serviceAccountPath) {
      // Method 1: Service account JSON file
      console.log('Initializing Firebase Admin with service account...');
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      });
    } else {
      // Method 2: Application Default Credentials (ADC)
      // This works in Cloud Run, GCE, or with gcloud auth application-default login
      console.log('Initializing Firebase Admin with Application Default Credentials...');
      console.log('Make sure you have run: gcloud auth application-default login');
      
      admin.initializeApp({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      });
    }

    db = admin.firestore();
    console.log(`✓ Connected to Firestore project: ${process.env.VITE_FIREBASE_PROJECT_ID}\n`);
    
    return db;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    console.error('\nTo fix this, either:');
    console.error('1. Set FIREBASE_SERVICE_ACCOUNT_PATH in .env pointing to your service account JSON');
    console.error('2. Run: gcloud auth application-default login');
    console.error('3. Download service account from: https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk\n');
    process.exit(1);
  }
}

export { admin };
