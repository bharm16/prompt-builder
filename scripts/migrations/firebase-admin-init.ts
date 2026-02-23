import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';

// Load environment variables
dotenv.config();

let db: FirebaseFirestore.Firestore | null = null;

/**
 * Initialize Firebase Admin SDK
 * 
 * Supports two authentication methods:
 * 1. Service Account JSON file (FIREBASE_SERVICE_ACCOUNT_PATH)
 * 2. Application Default Credentials (for Cloud Run, GCE)
 */
export function initializeFirebaseAdmin(): FirebaseFirestore.Firestore {
  if (db) {
    return db;
  }

  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    let serviceAccount: admin.ServiceAccount | null = null;

    if (serviceAccountJson) {
      try {
        serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;
      } catch (error) {
        console.warn('Invalid FIREBASE_SERVICE_ACCOUNT_JSON, falling back to file/ADC', {
          error: (error as Error).message,
        });
      }
    }

    if (!serviceAccount && serviceAccountPath) {
      if (!existsSync(serviceAccountPath)) {
        console.warn('FIREBASE_SERVICE_ACCOUNT_PATH not found, falling back to ADC', {
          serviceAccountPath,
        });
      } else {
        console.log('Initializing Firebase Admin with service account...');
        serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as admin.ServiceAccount;
      }
    }

    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        ...(typeof projectId === 'string' && projectId.length > 0 ? { projectId } : {}),
      });
    } else {
      // Method 2: Application Default Credentials (ADC)
      // This works in Cloud Run, GCE, or with gcloud auth application-default login
      console.log('Initializing Firebase Admin with Application Default Credentials...');
      console.log('Make sure you have run: gcloud auth application-default login');

      admin.initializeApp({
        ...(typeof projectId === 'string' && projectId.length > 0 ? { projectId } : {}),
      });
    }

    db = admin.firestore();
    console.log(`✓ Connected to Firestore project: ${projectId ?? 'default'}\n`);
    
    return db;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to initialize Firebase Admin:', errorMessage);
    console.error('\nTo fix this, either:');
    console.error('1. Set FIREBASE_SERVICE_ACCOUNT_PATH in .env pointing to your service account JSON');
    console.error('2. Run: gcloud auth application-default login');
    console.error('3. Download service account from: https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk\n');
    process.exit(1);
  }
}

export { admin };
