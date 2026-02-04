import { spawn } from 'node:child_process';
import process from 'node:process';

const HEALTH_URL = process.env.DEV_SERVER_HEALTH_URL || 'http://localhost:3001/health';
const HEALTH_TIMEOUT_MS = Number(process.env.DEV_SERVER_HEALTH_TIMEOUT_MS || 60000);
const HEALTH_POLL_INTERVAL_MS = Number(process.env.DEV_SERVER_HEALTH_POLL_INTERVAL_MS || 200);

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

function spawnNpm(args, name) {
  const child = spawn(npmCmd, args, {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    // Let the orchestrator decide how to handle exits.
    console.log(`[dev:start] ${name} exited`, { code, signal });
  });

  child.on('error', (err) => {
    console.error(`[dev:start] Failed to start ${name}`, err);
  });

  return child;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth({
  url,
  timeoutMs,
  pollIntervalMs,
  isServerAlive,
}) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    if (!isServerAlive()) {
      throw new Error('Backend process exited before becoming healthy');
    }

    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
      lastError = new Error(`Health check returned ${res.status}`);
    } catch (err) {
      lastError = err;
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(
    `Timed out waiting for backend health check at ${url} after ${timeoutMs}ms` +
    (lastError ? ` (last error: ${String(lastError)})` : '')
  );
}

function killProcess(child) {
  if (!child || child.killed) return;

  try {
    child.kill('SIGTERM');
  } catch {
    // Ignore kill errors.
  }
}

async function main() {
  console.log('[dev:start] Starting backend…');
  const server = spawnNpm(['run', 'server'], 'server');

  let serverExited = false;
  server.on('exit', () => {
    serverExited = true;
  });

  console.log('[dev:start] Waiting for backend health…', { url: HEALTH_URL });
  await waitForHealth({
    url: HEALTH_URL,
    timeoutMs: HEALTH_TIMEOUT_MS,
    pollIntervalMs: HEALTH_POLL_INTERVAL_MS,
    isServerAlive: () => !serverExited,
  });

  console.log('[dev:start] Backend healthy. Starting Vite…');
  const vite = spawnNpm(['run', 'dev'], 'vite');

  const shutdown = (reason) => {
    console.log('[dev:start] Shutting down…', { reason });
    killProcess(vite);
    killProcess(server);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // If either process exits, shut down the other and exit.
  server.on('exit', (code) => {
    shutdown('server-exit');
    process.exit(code ?? 1);
  });
  vite.on('exit', (code) => {
    shutdown('vite-exit');
    process.exit(code ?? 1);
  });
}

main().catch((err) => {
  console.error('[dev:start] Fatal error', err);
  process.exit(1);
});

