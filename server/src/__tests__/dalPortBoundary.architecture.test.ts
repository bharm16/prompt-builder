import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Architecture test enforcing the DAL port boundary for Task 2 domains.
 *
 * The continuity, asset, and reference-image domains expose Firestore-backed
 * stores through ports. The Firestore implementations live in domain-local
 * `storage/` subdirectories; nothing else in those domains may import the
 * Firebase Admin SDK directly.
 *
 * This test prevents regressions of the "Repository in services" smell — i.e.,
 * a new top-level service in those domains that talks to Firestore instead of
 * depending on the port. New domains can be added below as their DAL is
 * extracted.
 *
 * Out-of-scope domains (sessions, video-generation/jobs, payment stores,
 * credits, etc.) are intentionally excluded — their DAL extraction is a
 * separate piece of work, and policing them now would block unrelated
 * changes.
 */

const REPO_ROOT = process.cwd();

const SCOPES = [
  resolve(REPO_ROOT, "server/src/services/continuity"),
  resolve(REPO_ROOT, "server/src/services/asset"),
] as const;

const FORBIDDEN_IMPORT = "@infrastructure/firebaseAdmin";

const isSourceFile = (path: string): boolean =>
  (path.endsWith(".ts") || path.endsWith(".tsx")) && !path.endsWith(".d.ts");

const isInsideStorageSubdir = (file: string, scope: string): boolean => {
  const rel = relative(scope, file);
  // Match `storage/<file>` or `<sub>/storage/<file>` so domains with nested
  // sub-modules (e.g., asset/reference-images) keep their own storage dirs
  // exempted.
  return rel.split(sep).includes("storage");
};

const isInsideTestsDir = (file: string, scope: string): boolean => {
  const rel = relative(scope, file);
  return rel.split(sep).includes("__tests__");
};

const collectFiles = (dir: string): string[] => {
  const out: string[] = [];
  const stack: string[] = [dir];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const entries = readdirSync(current);
    for (const entry of entries) {
      const full = join(current, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        stack.push(full);
      } else if (stat.isFile() && isSourceFile(full)) {
        out.push(full);
      }
    }
  }
  return out;
};

const fileImportsFirestore = (file: string): boolean => {
  const source = readFileSync(file, "utf8");
  // Match `from "@infrastructure/firebaseAdmin"` or
  // `import "@infrastructure/firebaseAdmin"` — but ignore comment-only
  // mentions by requiring the import keyword on the same line.
  const importRegex = /import[^\n]*['"]@infrastructure\/firebaseAdmin['"]/;
  return importRegex.test(source);
};

describe("DAL port boundary (Task 2 domains)", () => {
  for (const scope of SCOPES) {
    const scopeName = relative(REPO_ROOT, scope);

    it(`only files under ${scopeName}/**/storage/ may import @infrastructure/firebaseAdmin`, () => {
      const files = collectFiles(scope);
      const violations = files
        .filter((file) => !isInsideStorageSubdir(file, scope))
        .filter((file) => !isInsideTestsDir(file, scope))
        .filter(fileImportsFirestore)
        .map((file) => relative(REPO_ROOT, file));

      expect(violations).toEqual([]);
    });
  }

  it(`adapters are present in the expected storage directories`, () => {
    const expected = [
      "server/src/services/continuity/storage/FirestoreContinuitySessionStore.ts",
      "server/src/services/asset/storage/FirestoreAssetStore.ts",
      "server/src/services/asset/reference-images/storage/FirestoreReferenceImageStore.ts",
    ];
    const missing = expected.filter((rel) => {
      try {
        statSync(resolve(REPO_ROOT, rel));
        return false;
      } catch {
        return true;
      }
    });
    expect(missing).toEqual([]);
  });
});
