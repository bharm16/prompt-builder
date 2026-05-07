#!/usr/bin/env node
/**
 * Admin: Set a user's credit balance to an absolute value (Firestore users/{uid}.credits).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=... \
 *   tsx --tsconfig server/tsconfig.json scripts/ops/set-user-credits.ts \
 *       --email=user@example.com --credits=1000 [--apply]
 *
 *   # or by UID
 *   tsx --tsconfig server/tsconfig.json scripts/ops/set-user-credits.ts \
 *       --uid=abc123 --credits=1000 --apply
 *
 * Defaults to a dry run unless --apply is passed.
 *
 * Also records an audit row in users/{uid}/credit_transactions matching the
 * shape written by UserCreditService (type: "add", source: "admin_adjustment").
 */

import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import {
  initializeApp,
  cert,
  getApps,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

interface Options {
  email: string | null;
  uid: string | null;
  credits: number;
  apply: boolean;
  reason: string;
}

function parseOptions(argv: string[]): Options {
  const getArg = (flag: string): string | null => {
    const hit = argv.find((a) => a.startsWith(`${flag}=`));
    return hit ? hit.slice(flag.length + 1) : null;
  };

  const email = getArg("--email");
  const uid = getArg("--uid");
  const creditsRaw = getArg("--credits");
  const reason = getArg("--reason") ?? "manual admin adjustment";
  const apply = argv.includes("--apply");

  if (!email && !uid) {
    throw new Error("Must provide --email=<addr> or --uid=<uid>");
  }
  if (creditsRaw === null) {
    throw new Error("Must provide --credits=<integer>");
  }
  const credits = Number.parseInt(creditsRaw, 10);
  if (!Number.isFinite(credits) || credits < 0) {
    throw new Error(`Invalid --credits value: ${creditsRaw}`);
  }

  return { email, uid, credits, apply, reason };
}

async function resolveUid(
  email: string | null,
  uid: string | null,
): Promise<{ uid: string; email: string | null }> {
  if (uid) {
    const user = await getAuth().getUser(uid);
    return { uid: user.uid, email: user.email ?? null };
  }
  const user = await getAuth().getUserByEmail(email!);
  return { uid: user.uid, email: user.email ?? null };
}

async function run(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));

  if (getApps().length === 0) {
    const credPathRaw =
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
    if (credPathRaw) {
      const credPath = isAbsolute(credPathRaw)
        ? credPathRaw
        : resolve(process.cwd(), credPathRaw);
      const serviceAccount = JSON.parse(
        await readFile(credPath, "utf8"),
      ) as ServiceAccount;
      initializeApp({
        credential: cert(serviceAccount),
        ...(projectId ? { projectId } : {}),
      });
    } else {
      initializeApp(projectId ? { projectId } : undefined);
    }
  }

  const db = getFirestore();

  const { uid, email } = await resolveUid(options.email, options.uid);
  const userRef = db.collection("users").doc(uid);
  const before = await userRef.get();
  const priorCredits =
    typeof before.data()?.credits === "number"
      ? (before.data()!.credits as number)
      : 0;

  console.log("=".repeat(60));
  console.log(`Target user:     ${email ?? "(no email)"} (uid: ${uid})`);
  console.log(`User doc exists: ${before.exists}`);
  console.log(`Credits before:  ${priorCredits}`);
  console.log(`Credits after:   ${options.credits}`);
  console.log(`Delta:           ${options.credits - priorCredits}`);
  console.log(`Mode:            ${options.apply ? "APPLY" : "DRY RUN"}`);
  console.log("=".repeat(60));

  if (!options.apply) {
    console.log("\nDry run only. Re-run with --apply to commit the change.");
    return;
  }

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(userRef);
    const nowTs = FieldValue.serverTimestamp();
    if (!snapshot.exists) {
      tx.set(userRef, {
        credits: options.credits,
        createdAt: nowTs,
        updatedAt: nowTs,
      });
    } else {
      tx.update(userRef, {
        credits: options.credits,
        updatedAt: nowTs,
      });
    }

    const txRef = userRef.collection("credit_transactions").doc();
    const delta = options.credits - priorCredits;
    tx.set(txRef, {
      type: "add",
      amount: delta,
      source: "admin_adjustment",
      reason: options.reason,
      priorCredits,
      nextCredits: options.credits,
      createdAtMs: Date.now(),
      createdAt: nowTs,
    });
  });

  const after = await userRef.get();
  console.log(
    `\nDone. Credits now: ${after.data()?.credits} (ledger row written at ${Timestamp.now().toDate().toISOString()})`,
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
