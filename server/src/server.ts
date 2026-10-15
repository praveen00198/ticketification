import dns from 'dns';

// Force Node.js to prioritize IPv4 addresses over IPv6.
// Fixes ENETUNREACH socket errors on cloud container hosts (e.g. Render) lacking IPv6 routes.
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

import { initFonts } from './utils/font-initializer';
// Initialize Fontconfig with bundled Devanagari fonts before Sharp loads
initFonts();

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
import { connectMongoDB, disconnectMongoDB } from './db/mongodb';

// Safe Storage diagnostic logging (zero secrets/tokens logged)
console.log(`[DIAG:Storage] ${JSON.stringify({
  serviceRoleConfigured: !!config.env.supabaseServiceRoleKey,
  supabaseUrlConfigured: !!config.env.supabaseUrl,
  bucketName: config.env.supabaseBucket || 'ticket-images',
  clientType: 'server-service-role',
  hasCustomAuthorizationHeader: false,
})}`);


import { eventJobQueueService } from './modules/events/services/event-job-queue.service';

let serverInstance: any = null;

async function startServer() {
  if (config.env.mongoUri) {
    try {
      await connectMongoDB();
    } catch (err: any) {
      if (config.env.isProduction) {
        console.error(`[FATAL] Mandatory production MongoDB connection failed: ${err.message}`);
        process.exit(1);
      } else {
        console.warn('⚠️ [MongoDB] Development connection standby / warning:', err.message);
      }
    }
  } else if (config.env.isProduction) {
    console.error('[FATAL] MONGODB_URI is mandatory for production operation.');
    process.exit(1);
  }

  // Controlled server-level platform administrator provisioning from allowlist
  if (config.env.initialAdminEmails.length > 0) {
    try {
      const { adminBootstrapService } = await import('./modules/auth/services/admin-bootstrap.service');
      await adminBootstrapService.bootstrapAllAllowlistedAdmins();
    } catch (bootstrapErr: any) {
      console.error(`❌ [AdminBootstrap] Controlled administrator provisioning failed: ${bootstrapErr.message}`);
      if (config.env.isProduction) {
        process.exit(1);
      }
    }
  }

  // Recover abandoned background jobs and start worker polling loop
  try {
    const recoveryResult = await eventJobQueueService.recoverAbandonedJobs();
    if (recoveryResult.recovered > 0 || recoveryResult.failed > 0) {
      console.log(`[JobQueue] Recovered ${recoveryResult.recovered} abandoned jobs, failed ${recoveryResult.failed} exhausted jobs.`);
    }
    eventJobQueueService.startWorker();
    console.log('[JobQueue] Controlled background worker polling started.');
  } catch (jobErr: any) {
    console.error('[JobQueue] Worker startup / recovery notice:', jobErr.message);
  }

  const PORT = config.env.port;
  serverInstance = app.listen(PORT, () => {
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

// ── LIFECYCLE POINT 13: Before process shutdown (Graceful) ──
async function gracefulShutdown(signal: string) {
  logMemory(`${signal.toLowerCase()}_shutdown`);
  console.log(`[Server] ${signal} received, shutting down gracefully...`);

  try {
    await eventJobQueueService.stopWorker(5000);
    console.log('[JobQueue] Background worker stopped cleanly.');
  } catch (stopErr: any) {
    console.error('[JobQueue] Worker shutdown note:', stopErr.message);
  }

  if (serverInstance) {
    serverInstance.close(async () => {
      console.log('[Server] HTTP listener closed cleanly.');
      await disconnectMongoDB();
      process.exit(0);
    });
    // Safety fallback: force exit after 10s if sockets remain open
    setTimeout(() => {
      console.error('[Server] Force terminating after shutdown timeout.');
      process.exit(1);
    }, 10000).unref();
  } else {
    await disconnectMongoDB();
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
