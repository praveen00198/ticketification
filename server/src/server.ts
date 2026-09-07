import dns from 'dns';

// Force Node.js to prioritize IPv4 addresses over IPv6.
// Fixes ENETUNREACH socket errors on cloud container hosts (e.g. Render) lacking IPv6 routes.
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

import { logMemory } from './utils/memory-logger';
import sharp from 'sharp';

// ── LIFECYCLE POINT 1: Application startup ──
logMemory('startup');

// Log Sharp runtime configuration for production verification
console.log(`[DIAG] sharp.versions=${JSON.stringify(sharp.versions)}`);
console.log(`[DIAG] sharp.cache=${JSON.stringify(sharp.cache())}`);
console.log(`[DIAG] sharp.concurrency=${sharp.concurrency()}`);
console.log(`[DIAG] node.version=${process.version}`);
console.log(`[DIAG] platform=${process.platform} arch=${process.arch}`);

import app from './app';
import config from './config/env';

// Safe Storage diagnostic logging (zero secrets/tokens logged)
console.log(`[DIAG:Storage] ${JSON.stringify({
  serviceRoleConfigured: !!config.env.supabaseServiceRoleKey,
  supabaseUrlConfigured: !!config.env.supabaseUrl,
  bucketName: config.env.supabaseBucket || 'ticket-images',
  clientType: 'server-service-role',
  hasCustomAuthorizationHeader: false,
})}`);


async function startServer() {
  const PORT = config.env.port;
  app.listen(PORT, () => {
    console.log(`[Server] Operational console API listening on http://localhost:${PORT}`);
    console.log(`[Environment] Node ENV: ${config.env.nodeEnv}`);
    // ── LIFECYCLE POINT 2: Server ready/listening ──
    logMemory('server_ready');
  });
}

// ── LIFECYCLE POINT 11: uncaughtException ──
process.on('uncaughtException', (err) => {
  logMemory('uncaught_exception', { error: err.message.substring(0, 100) });
  console.error('[FATAL] Uncaught Exception:', err);
  process.exit(1);
});

// ── LIFECYCLE POINT 12: unhandledRejection ──
process.on('unhandledRejection', (reason: any) => {
  const msg = reason?.message || String(reason);
  logMemory('unhandled_rejection', { error: msg.substring(0, 100) });
  console.error('[FATAL] Unhandled Rejection:', reason);
});

// ── LIFECYCLE POINT 13: Before process shutdown ──
process.on('SIGTERM', () => {
  logMemory('sigterm_shutdown');
  console.log('[Server] SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logMemory('sigint_shutdown');
  console.log('[Server] SIGINT received, shutting down...');
  process.exit(0);
});

startServer();
