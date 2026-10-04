import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

// Railway injects PORT for the public web server. The API must never reuse it,
// otherwise both processes try to bind the same port and one exits with EADDRINUSE.
const webPort = String(process.env.PORT || 8080);
let apiPort = String(process.env.API_PORT || 4000);
if (apiPort === webPort) {
  console.warn(`[start] API_PORT (${apiPort}) collides with the web port; using 4000 for the API`);
  apiPort = '4000';
}

const children = new Set();
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = code;
  for (const child of children) child.kill();
  // Force exit if children do not stop promptly.
  setTimeout(() => process.exit(code), 5000).unref();
}

function run(name, args, env, { restart = false } = {}) {
  let failures = 0;
  let startedAt = 0;
  const launch = () => {
    startedAt = Date.now();
    const child = spawn(process.execPath, args, { stdio: 'inherit', env: { ...process.env, ...env } });
    children.add(child);
    console.log(`[start] ${name} started (pid ${child.pid})`);
    child.on('error', error => console.error(`[start] ${name} failed to spawn: ${error.message}`));
    child.on('exit', (code, signal) => {
      children.delete(child);
      if (shuttingDown) return;
      console.error(`[start] ${name} exited (code=${code}, signal=${signal})`);
      if (!restart) return shutdown(code || 1);
      // Keep the web server alive and retry the API with backoff.
      failures = Date.now() - startedAt > 30000 ? 1 : failures + 1;
      const delay = Math.min(30000, 1000 * 2 ** (failures - 1));
      console.error(`[start] restarting ${name} in ${delay}ms`);
      setTimeout(() => { if (!shuttingDown) launch(); }, delay);
    });
  };
  launch();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('api', ['server/index.mjs'], { API_PORT: apiPort, PORT: apiPort }, { restart: true });
run('web', ['node_modules/next/dist/bin/next', 'start', '--hostname', '0.0.0.0', '--port', webPort], { PORT: webPort });
