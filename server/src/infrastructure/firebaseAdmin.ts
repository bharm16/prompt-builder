import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { logger } from './Logger';

let initialized = false;

function initializeFirebaseAdmin(): admin.app.App {
  if (initialized && admin.apps.length > 0) {
    return admin.app();
  }

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const serviceAccount =
      serviceAccountJson
        ? JSON.parse(serviceAccountJson)
        : serviceAccountPath
          ? JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
          : null;

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
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

export function getFirestore(): FirebaseFirestore.Firestore {
  const app = initializeFirebaseAdmin();
  return admin.firestore(app);
}

export { admin };
