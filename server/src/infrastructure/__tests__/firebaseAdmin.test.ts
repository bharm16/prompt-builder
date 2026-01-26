import { describe, it, expect, vi, beforeEach } from 'vitest';

const firebaseMock = vi.hoisted(() => {
  const apps: unknown[] = [];
  const appInstance = { name: 'app' };
  const initializeApp = vi.fn(() => {
    apps.push(appInstance);
    return appInstance;
  });
  const app = vi.fn(() => appInstance);
  const firestore = vi.fn(() => ({ firestore: true }));
  const credential = {
    cert: vi.fn((serviceAccount: unknown) => ({ type: 'cert', serviceAccount })),
    applicationDefault: vi.fn(() => ({ type: 'adc' })),
  };

  return {
    apps,
    appInstance,
    initializeApp,
    app,
    firestore,
    credential,
  };
});

const fsMock = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

const warnSpy = vi.hoisted(() => vi.fn());
const infoSpy = vi.hoisted(() => vi.fn());
const errorSpy = vi.hoisted(() => vi.fn());

vi.mock('firebase-admin', () => ({
  default: firebaseMock,
}));

vi.mock('fs', () => ({
  default: {
    existsSync: fsMock.existsSync,
    readFileSync: fsMock.readFileSync,
  },
  existsSync: fsMock.existsSync,
  readFileSync: fsMock.readFileSync,
}));

vi.mock('../Logger', () => ({
  logger: {
    warn: warnSpy,
    info: infoSpy,
    error: errorSpy,
  },
}));

const loadFirebaseAdmin = async () => {
  const module = await import('../firebaseAdmin');
  return module;
};

describe('firebaseAdmin', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    firebaseMock.apps.splice(0, firebaseMock.apps.length);

    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    delete process.env.VITE_FIREBASE_PROJECT_ID;
  });

  describe('error handling', () => {
    it('falls back to ADC when FIREBASE_SERVICE_ACCOUNT_JSON is invalid', async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{invalid';

      const { getFirestore } = await loadFirebaseAdmin();
      getFirestore();

      expect(warnSpy).toHaveBeenCalledWith(
        'Invalid FIREBASE_SERVICE_ACCOUNT_JSON, falling back to file/ADC',
        expect.objectContaining({ error: expect.any(String) })
      );
      expect(firebaseMock.credential.applicationDefault).toHaveBeenCalled();
      expect(firebaseMock.initializeApp).toHaveBeenCalledWith(
        expect.objectContaining({ credential: { type: 'adc' } })
      );
    });

    it('falls back to ADC when FIREBASE_SERVICE_ACCOUNT_PATH is missing', async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH = '/missing.json';
      fsMock.existsSync.mockReturnValue(false);

      const { getFirestore } = await loadFirebaseAdmin();
      getFirestore();

      expect(warnSpy).toHaveBeenCalledWith(
        'FIREBASE_SERVICE_ACCOUNT_PATH not found, falling back to ADC',
        expect.objectContaining({ serviceAccountPath: '/missing.json' })
      );
      expect(firebaseMock.credential.applicationDefault).toHaveBeenCalled();
    });

    it('falls back to ADC when FIREBASE_SERVICE_ACCOUNT_PATH cannot be parsed', async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH = '/bad.json';
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readFileSync.mockReturnValue('{bad');

      const { getFirestore } = await loadFirebaseAdmin();
      getFirestore();

      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to read FIREBASE_SERVICE_ACCOUNT_PATH, falling back to ADC',
        expect.objectContaining({ serviceAccountPath: '/bad.json', error: expect.any(String) })
      );
      expect(firebaseMock.credential.applicationDefault).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('reuses initialized app on subsequent calls', async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'p' });

      const { getFirestore } = await loadFirebaseAdmin();
      getFirestore();
      getFirestore();

      expect(firebaseMock.initializeApp).toHaveBeenCalledTimes(1);
      expect(firebaseMock.app).toHaveBeenCalled();
    });
  });

  describe('core behavior', () => {
    it('initializes with service account JSON and projectId', async () => {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'proj' });
      process.env.VITE_FIREBASE_PROJECT_ID = 'proj-123';

      const { getFirestore } = await loadFirebaseAdmin();
      const firestore = getFirestore();

      expect(firebaseMock.credential.cert).toHaveBeenCalledWith({ project_id: 'proj' });
      expect(firebaseMock.initializeApp).toHaveBeenCalledWith({
        credential: { type: 'cert', serviceAccount: { project_id: 'proj' } },
        projectId: 'proj-123',
      });
      expect(firebaseMock.firestore).toHaveBeenCalledWith(firebaseMock.appInstance);
      expect(firestore).toEqual({ firestore: true });
      expect(infoSpy).toHaveBeenCalledWith('Firebase Admin initialized', {
        projectId: 'proj-123',
        hasServiceAccount: true,
      });
    });
  });
});
