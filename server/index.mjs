import { existsSync } from 'node:fs';

// Direct hosting startup must load settings before SQLite and workers initialize.
// Dynamic imports are required: static imports run before loadEnvFile().
if (existsSync('.env')) process.loadEnvFile('.env');

// Avoid top-level await so Passenger loaders using require() can load this ESM entry.
async function start() {
  const { app } = await import('./app.mjs');
  const { startNotificationWorker } = await import('./notifications.mjs');
  const port = Number(process.env.API_PORT || process.env.PORT || 4000);
  const server = app.listen(port, '0.0.0.0', (error) => {
    if (error) return;
    console.log(`Powerplanet API running on port ${port}`);
    startNotificationWorker();
  });
  server.on('error', failStartup);
}

function failStartup(error) {
  console.error(`API startup failed: ${error.code || error.name}`);
  process.exit(1);
}

start().catch(failStartup);
