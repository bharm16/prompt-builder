import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { logger } from './Logger';

let initialized = false;

function loadServiceAccount(): admin.ServiceAccount | null {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
      return JSON.parse(serviceAccountJson) as admin.ServiceAccount;
    } catch (error) {
      logger.warn('Invalid FIREBASE_SERVICE_ACCOUNT_JSON, falling back to file/ADC', {
        error: (error as Error).message,
      });
    }
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    if (!existsSync(serviceAccountPath)) {
      logger.warn('FIREBASE_SERVICE_ACCOUNT_PATH not found, falling back to ADC', {
        serviceAccountPath,
      });
      return null;
    }

    try {
      return JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as admin.ServiceAccount;
    } catch (error) {
      logger.warn('Failed to read FIREBASE_SERVICE_ACCOUNT_PATH, falling back to ADC', {
        serviceAccountPath,
        error: (error as Error).message,
      });
    }
  }

  return null;
}

function initializeFirebaseAdmin(): admin.app.App {
  if (initialized && admin.apps.length > 0) {
    return admin.app();
  }

  try {
    const serviceAccount = loadServiceAccount();

    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        ...(projectId ? { projectId } : {}),
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        ...(projectId ? { projectId } : {}),
      });
    }

    initialized = true;
    logger.info('Firebase Admin initialized', {
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      hasServiceAccount: Boolean(serviceAccount),
    });

    return admin.app();
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK', error as Error);
    throw error;
  }
}

export function getAuth(): admin.auth.Auth {
  initializeFirebaseAdmin();
  return admin.auth();
}

export function getFirestore(): FirebaseFirestore.Firestore {
  const app = initializeFirebaseAdmin();
  return admin.firestore(app);
}

export { admin };
