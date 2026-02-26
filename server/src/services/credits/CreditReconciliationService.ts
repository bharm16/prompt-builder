import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import { logger } from '@infrastructure/Logger';
import type { UserCreditService } from './UserCreditService';
import {
  FirestoreCircuitExecutor,
  getFirestoreCircuitExecutor,
} from '@services/firestore/FirestoreCircuitExecutor';

const CHECKPOINT_COLLECTION = 'credit_reconciliation_state';
const CHECKPOINT_DOC_ID = 'incremental_checkpoint';
const ADJUSTMENT_COLLECTION = 'credit_reconciliation_adjustments';
const DEFAULT_INCREMENTAL_SCAN_LIMIT = 500;
const DEFAULT_FULL_PASS_PAGE_SIZE = 200;

type ReconciliationScope = 'incremental' | 'full';

interface ReconciliationCheckpoint {
  lastCreatedAtMs: number;
  lastDocName: string;
}

interface ReconciliationAdjustmentRecord {
  userId: string;
  scope: ReconciliationScope;
  currentBalance: number;
  ledgerBalance: number;
  diff: number;
  status: 'auto_applied' | 'pending_approval';
  requiresManualApproval: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ReconciliationRunResult {
  scope: ReconciliationScope;
  scannedItems: number;
  processedUsers: number;
  positiveCorrections: number;
  queuedNegativeCorrections: number;
  checkpointUpdated: boolean;
}

export class CreditReconciliationService {
  private readonly db = getFirestore();
  private readonly usersCollection = this.db.collection('users');
  private readonly checkpointRef = this.db.collection(CHECKPOINT_COLLECTION).doc(CHECKPOINT_DOC_ID);
  private readonly adjustmentsCollection = this.db.collection(ADJUSTMENT_COLLECTION);
  private readonly log = logger.child({ service: 'CreditReconciliationService' });
  private readonly incrementalScanLimit: number;
  private readonly fullPassPageSize: number;
  private readonly firestoreCircuitExecutor: FirestoreCircuitExecutor;
  private readonly metrics:
    | {
        recordAlert?: (alertName: string, metadata?: Record<string, unknown>) => void;
      }
    | undefined;

  constructor(
    userCreditService: UserCreditService,
    firestoreCircuitExecutor: FirestoreCircuitExecutor = getFirestoreCircuitExecutor(),
    options?: {
      incrementalScanLimit?: number;
      fullPassPageSize?: number;
      metrics?: {
        recordAlert?: (alertName: string, metadata?: Record<string, unknown>) => void;
      };
    }
  ) {
    this.userCreditService = userCreditService;
    this.firestoreCircuitExecutor = firestoreCircuitExecutor;
    this.incrementalScanLimit = Number.isFinite(options?.incrementalScanLimit)
      ? Math.max(1, Math.trunc(options?.incrementalScanLimit as number))
      : DEFAULT_INCREMENTAL_SCAN_LIMIT;
    this.fullPassPageSize = Number.isFinite(options?.fullPassPageSize)
      ? Math.max(1, Math.trunc(options?.fullPassPageSize as number))
      : DEFAULT_FULL_PASS_PAGE_SIZE;
    this.metrics = options?.metrics;
  }

  private readonly userCreditService: UserCreditService;

  async runIncrementalPass(): Promise<ReconciliationRunResult> {
    const checkpoint = await this.loadCheckpoint();
    let query = this.db
      .collectionGroup('credit_transactions')
      .orderBy('createdAtMs', 'asc')
      .orderBy(admin.firestore.FieldPath.documentId(), 'asc')
      .limit(this.incrementalScanLimit);

    if (checkpoint) {
      query = query.startAfter(checkpoint.lastCreatedAtMs, checkpoint.lastDocName);
    }

    const transactionSnapshot = await this.firestoreCircuitExecutor.executeRead(
      'credits.reconciliation.scanIncremental',
      async () => await query.get()
    );

    if (transactionSnapshot.empty) {
      return {
        scope: 'incremental',
        scannedItems: 0,
        processedUsers: 0,
        positiveCorrections: 0,
        queuedNegativeCorrections: 0,
        checkpointUpdated: false,
      };
    }

    const impactedUserIds = new Set<string>();
    for (const doc of transactionSnapshot.docs) {
      const userId = this.extractUserIdFromTransactionPath(doc.ref.path);
      if (!userId) {
        this.log.warn('Skipping credit transaction with unexpected path', {
          path: doc.ref.path,
        });
        continue;
      }
      impactedUserIds.add(userId);
    }

    let positiveCorrections = 0;
    let queuedNegativeCorrections = 0;
    for (const userId of impactedUserIds) {
      const reconciliation = await this.reconcileUser(userId, 'incremental');
      if (!reconciliation) {
        continue;
      }
      if (reconciliation.diff > 0) {
        positiveCorrections += 1;
      } else if (reconciliation.diff < 0) {
        queuedNegativeCorrections += 1;
      }
    }

    const lastDoc = transactionSnapshot.docs[transactionSnapshot.docs.length - 1];
    let checkpointUpdated = false;
    if (lastDoc) {
      const lastCreatedAtMsRaw = lastDoc.data().createdAtMs;
      const lastCreatedAtMs =
        typeof lastCreatedAtMsRaw === 'number' && Number.isFinite(lastCreatedAtMsRaw)
          ? Math.trunc(lastCreatedAtMsRaw)
          : Date.now();
      await this.storeCheckpoint({
        lastCreatedAtMs,
        lastDocName: lastDoc.ref.path,
      });
      checkpointUpdated = true;
    }

    return {
      scope: 'incremental',
      scannedItems: transactionSnapshot.docs.length,
      processedUsers: impactedUserIds.size,
      positiveCorrections,
      queuedNegativeCorrections,
      checkpointUpdated,
    };
  }

  async runFullPass(): Promise<ReconciliationRunResult> {
    let processedUsers = 0;
    let positiveCorrections = 0;
    let queuedNegativeCorrections = 0;
    let scannedItems = 0;
    let cursor: string | null = null;

    while (true) {
      let query = this.usersCollection
        .orderBy(admin.firestore.FieldPath.documentId(), 'asc')
        .limit(this.fullPassPageSize);

      if (cursor) {
        query = query.startAfter(cursor);
      }

      const usersSnapshot = await this.firestoreCircuitExecutor.executeRead(
        'credits.reconciliation.scanUsers',
        async () => await query.get()
      );

      if (usersSnapshot.empty) {
        break;
      }

      for (const doc of usersSnapshot.docs) {
        scannedItems += 1;
        const reconciliation = await this.reconcileUser(doc.id, 'full');
        processedUsers += 1;
        if (!reconciliation) {
          continue;
        }
        if (reconciliation.diff > 0) {
          positiveCorrections += 1;
        } else if (reconciliation.diff < 0) {
          queuedNegativeCorrections += 1;
        }
      }

      const lastDoc = usersSnapshot.docs[usersSnapshot.docs.length - 1];
      if (!lastDoc || usersSnapshot.docs.length < this.fullPassPageSize) {
        break;
      }
      cursor = lastDoc.id;
    }

    return {
      scope: 'full',
      scannedItems,
      processedUsers,
      positiveCorrections,
      queuedNegativeCorrections,
      checkpointUpdated: false,
    };
  }

  private async reconcileUser(
    userId: string,
    scope: ReconciliationScope
  ): Promise<{ userId: string; diff: number } | null> {
    const userRef = this.usersCollection.doc(userId);
    const userSnapshot = await this.firestoreCircuitExecutor.executeRead(
      'credits.reconciliation.readUser',
      async () => await userRef.get()
    );

    if (!userSnapshot.exists) {
      return null;
    }

    const userData = userSnapshot.data() as Record<string, unknown> | undefined;
    const currentBalanceRaw = userData?.credits;
    const currentBalance =
      typeof currentBalanceRaw === 'number' && Number.isFinite(currentBalanceRaw)
        ? Math.trunc(currentBalanceRaw)
        : 0;

    const transactionSnapshot = await this.firestoreCircuitExecutor.executeRead(
      'credits.reconciliation.readUserTransactions',
      async () =>
        await userRef
          .collection('credit_transactions')
          .orderBy('createdAtMs', 'asc')
          .get()
    );

    let ledgerBalance = 0;
    for (const transactionDoc of transactionSnapshot.docs) {
      const amountRaw = transactionDoc.data().amount;
      if (typeof amountRaw === 'number' && Number.isFinite(amountRaw)) {
        ledgerBalance += Math.trunc(amountRaw);
      }
    }

    const diff = ledgerBalance - currentBalance;
    if (diff === 0) {
      return { userId, diff };
    }

    if (diff > 0) {
      await this.userCreditService.addCredits(userId, diff, {
        source: 'reconciliation',
        reason: 'ledger_positive_correction',
        referenceId: `credit-reconciliation:${scope}:${Date.now()}`,
      });

      await this.recordAdjustment({
        userId,
        scope,
        currentBalance,
        ledgerBalance,
        diff,
        status: 'auto_applied',
        requiresManualApproval: false,
      });

      this.log.warn('Applied positive credit reconciliation correction', {
        userId,
        currentBalance,
        ledgerBalance,
        diff,
      });
      this.metrics?.recordAlert?.('credit_reconciliation_positive_correction', {
        userId,
        diff,
        scope,
      });
      return { userId, diff };
    }

    await this.recordAdjustment({
      userId,
      scope,
      currentBalance,
      ledgerBalance,
      diff,
      status: 'pending_approval',
      requiresManualApproval: true,
    });

    this.log.warn('Queued negative credit reconciliation correction for manual approval', {
      userId,
      currentBalance,
      ledgerBalance,
      diff,
    });
    this.metrics?.recordAlert?.('credit_reconciliation_negative_correction_queued', {
      userId,
      diff,
      scope,
    });

    return { userId, diff };
  }

  private async loadCheckpoint(): Promise<ReconciliationCheckpoint | null> {
    const snapshot = await this.firestoreCircuitExecutor.executeRead(
      'credits.reconciliation.loadCheckpoint',
      async () => await this.checkpointRef.get()
    );
    if (!snapshot.exists) {
      return null;
    }
    const data = snapshot.data() as Partial<ReconciliationCheckpoint> | undefined;
    if (
      !data ||
      typeof data.lastCreatedAtMs !== 'number' ||
      !Number.isFinite(data.lastCreatedAtMs) ||
      typeof data.lastDocName !== 'string' ||
      data.lastDocName.length === 0
    ) {
      return null;
    }

    return {
      lastCreatedAtMs: Math.trunc(data.lastCreatedAtMs),
      lastDocName: data.lastDocName,
    };
  }

  private async storeCheckpoint(checkpoint: ReconciliationCheckpoint): Promise<void> {
    const now = Date.now();
    await this.firestoreCircuitExecutor.executeWrite(
      'credits.reconciliation.storeCheckpoint',
      async () =>
        await this.checkpointRef.set(
          {
            ...checkpoint,
            updatedAtMs: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
    );
  }

  private async recordAdjustment(
    input: Omit<ReconciliationAdjustmentRecord, 'createdAtMs' | 'updatedAtMs'>
  ): Promise<void> {
    const now = Date.now();
    const record: ReconciliationAdjustmentRecord = {
      ...input,
      createdAtMs: now,
      updatedAtMs: now,
    };

    await this.firestoreCircuitExecutor.executeWrite(
      'credits.reconciliation.recordAdjustment',
      async () =>
        await this.adjustmentsCollection.doc().set({
          ...record,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
    );
  }

  private extractUserIdFromTransactionPath(path: string): string | null {
    const segments = path.split('/').filter(Boolean);
    if (segments.length < 4) {
      return null;
    }

    for (let index = 0; index < segments.length - 1; index += 1) {
      if (segments[index] === 'users') {
        const next = segments[index + 1];
        return typeof next === 'string' && next.length > 0 ? next : null;
      }
    }

    return null;
  }
}
