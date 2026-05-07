import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";
import type { Analytics } from "firebase/analytics";
import { logger } from "@/services/LoggingService";
import { sanitizeError } from "@/utils/logging";

const log = logger.child("firebase");

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Use memory-only local cache. Default IndexedDB persistence triggers a
// known Firestore 12.4.0 bug (`INTERNAL ASSERTION FAILED: Unexpected state
// (ID: ca9) CONTEXT: {ve:-1}`) on watch-stream resumes — it spams the
// console 30+ times per sign-in and makes debugging impossible. Memory
// cache is fine for this app: we use REST polling for stateful data
// (credits, sessions) and only use Firestore for live listeners.
const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
});

let analytics: Analytics | null = null;
if (typeof window !== "undefined") {
  import("firebase/analytics")
    .then(({ getAnalytics }) => {
      analytics = getAnalytics(app);
    })
    .catch((error) => {
      const info = sanitizeError(error);
      log.warn("Firebase Analytics initialization failed (ok in development)", {
        operation: "getAnalytics",
        error: info.message,
        errorName: info.name,
      });
    });
}

export { auth, db, analytics };
