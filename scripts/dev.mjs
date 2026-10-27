import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';

if (existsSync('.env')) process.loadEnvFile('.env');

// Check both ports before starting either service, so a failed launch cannot
// leave an API watcher running after the web server exits.
async function checkPort(value, label) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} port must be an integer between 1 and 65535.`);
  }
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', (error) => {
      reject(
        new Error(
          error.code === 'EADDRINUSE'
            ? `${label} port ${port} is already in use. Stop the existing development server (Ctrl+C), then run npm run dev again. No new services were started.`
            : `Cannot use ${label} port ${port}: ${error.message}`,
        ),
      );
    });
    probe.listen(port, '0.0.0.0', () => probe.close(resolve));
  });
}

const children = [];
let stopping = false;
const useProcessGroups = process.platform !== 'win32';

function terminate(child, signal = 'SIGTERM') {
  try {
    // Next and node --watch both have descendants. Signal their whole group,
    // rather than leaving a listening grandchild behind when the launcher exits.
    if (useProcessGroups && child.pid) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if (error.code !== 'ESRCH') console.error(error.message);
  }
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  children.forEach((child) => terminate(child));
  setTimeout(() => children.forEach((child) => terminate(child, 'SIGKILL')), 3000).unref();
}

function start(args) {
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    env: process.env,
    detached: useProcessGroups,
  });
  children.push(child);
  child.once('error', (error) => {
    console.error(`Development server could not start: ${error.message}`);
    stop(1);
  });
  child.once('exit', (code) => {
    if (!stopping) stop(code ?? 1);
  });
}

process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
process.once('exit', () => children.forEach((child) => terminate(child)));

try {
  const apiPort = process.env.API_PORT || 4000;
  const webPort = process.env.PORT || 3000;
  if (Number(apiPort) === Number(webPort)) throw new Error('API_PORT and PORT must be different.');
  await checkPort(apiPort, 'API');
  await checkPort(webPort, 'Website');
  start(['--watch', 'server/index.mjs']);
  start(['node_modules/next/dist/bin/next', 'dev', '--hostname', '0.0.0.0']);
} catch (error) {
  console.error(error.message);
  stop(1);
}
