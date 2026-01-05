import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { logger } from './Logger';

let initialized = false;

function initializeFirebaseAdmin(): admin.app.App {
  if (initialized && admin.apps.length > 0) {
    return admin.app();
  }

  try {
    const defaultServiceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');
    const serviceAccountPath =
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
      (existsSync(defaultServiceAccountPath) ? defaultServiceAccountPath : undefined);

    if (serviceAccountPath) {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
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
      hasServiceAccount: Boolean(serviceAccountPath),
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
