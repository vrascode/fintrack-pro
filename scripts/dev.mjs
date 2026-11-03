import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { checkDatabase, loadEnvironment, root } from './doctor.mjs';

const require = createRequire(import.meta.url);
const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill();
}
function launch(args, env = process.env, cwd = root) {
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    stdio: 'inherit',
    windowsHide: true,
  });
  children.add(child);
  child.once('error', () => stop(1));
  child.once('exit', (code) => {
    children.delete(child);
    if (!stopping) stop(code || 1);
  });
  return child;
}
async function portAvailable(port) {
  const server = createServer();
  return new Promise((resolvePort, reject) => {
    server.once('error', (error) =>
      error.code === 'EADDRINUSE' ? resolvePort(false) : reject(error),
    );
    server.listen(port, '127.0.0.1', () => server.close(() => resolvePort(true)));
  });
}
try {
  loadEnvironment();
  await checkDatabase();
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid API PORT.');
  const base = `http://127.0.0.1:${port}/v1`;
  if (await portAvailable(port)) {
    launch(['--env-file-if-exists=.env', 'apps/api/dist/main.js']);
  }
  let ready = false;
  for (let attempt = 0; attempt < 50 && !stopping; attempt++) {
    try {
      const response = await fetch(`${base}/health/ready`, { signal: AbortSignal.timeout(1000) });
      const body = await response.json();
      if (response.ok && body.service === 'fintrack-api' && body.scope === 'database') {
        ready = true;
        break;
      }
    } catch {
      /* readiness retry */
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  if (!ready) throw new Error('API is not ready. Check its logs and DATABASE_URL.');
  if (!(await portAvailable(8081))) {
    throw new Error(
      'Port 8081 is occupied. Existing frontend preserved; use it or stop it before npm.cmd run dev.',
    );
  }
  launch(
    [require.resolve('expo/bin/cli'), 'start', '--web', '--port', '8081'],
    {
      ...process.env,
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || `http://localhost:${port}/v1`,
    },
    resolve(root, 'apps/mobile'),
  );
  console.log(
    'FinTrack Pro: http://localhost:8081/login — Ctrl+C stops only processes started here.',
  );
} catch (error) {
  console.error(error.message);
  stop(1);
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
