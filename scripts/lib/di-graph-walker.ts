import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

export interface DependencyEdge {
  from: string;
  to: string;
  file: string;
}

/**
 * Walk all *.services.ts files in the given directory and emit
 * dependency edges from `container.register("name", factory, ["dep1", "dep2"])` calls.
 *
 * Matches `container.register(...)` calls only — calls on other receivers
 * (e.g. `eventEmitter.register(...)`, `someBus.register(...)`) are ignored.
 *
 * Only handles cases where the first argument is a string literal and the
 * third argument is an array literal of string literals. Dynamic registrations
 * (variable token, spread deps, etc.) are silently skipped — they either have
 * no deps (e.g. the registerLimiter helper in llm.services.ts passes []) or
 * are not representable as static edges.
 */
export function extractDependencies(servicesDir: string): DependencyEdge[] {
  const edges: DependencyEdge[] = [];

  const files = fs
    .readdirSync(servicesDir)
    .filter((f) => f.endsWith(".services.ts"))
    .sort();

  for (const file of files) {
    const filePath = path.join(servicesDir, file);
    const source = ts.createSourceFile(
      filePath,
      fs.readFileSync(filePath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );

    function visit(node: ts.Node): void {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "register" &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "container"
      ) {
        const [nameArg, , depsArg] = node.arguments;
        if (
          nameArg &&
          ts.isStringLiteral(nameArg) &&
          depsArg &&
          ts.isArrayLiteralExpression(depsArg)
        ) {
          const from = nameArg.text;
          for (const dep of depsArg.elements) {
            if (ts.isStringLiteral(dep)) {
              edges.push({ from, to: dep.text, file });
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(source);
  }

  edges.sort(
    (a, b) =>
      a.from.localeCompare(b.from) ||
      a.to.localeCompare(b.to) ||
      a.file.localeCompare(b.file),
  );

  return edges;
}
