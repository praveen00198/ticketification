import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/routes/auth.routes';
import guestRoutes from './modules/guests/routes/guest.routes';
import ticketRoutes from './modules/tickets/routes/ticket.routes';
import verificationRoutes from './modules/verification/routes/verification.routes';
import dashboardRoutes from './modules/dashboard/routes/dashboard.routes';
import eventRoutes from './modules/events/routes/event.routes';
import { adminVerificationRouter } from './modules/events/routes/event-verification.routes';
import { adminLifecycleRouter } from './modules/events/routes/event-lifecycle.routes';
import hostRoutes from './modules/host/host.routes';
import { publicCredentialRouter } from './modules/events/routes/event-credential.routes';
import attendeeRoutes from './modules/events/routes/attendee.routes';
import { publicEventRouter } from './modules/events/routes/public-event.routes';
import { ticketService } from './modules/tickets/services/ticket.service';
import { errorHandler } from './middlewares/error.middleware';
import config from './config/env';
import sharp from 'sharp';
import { logMemory } from './utils/memory-logger';

import { securityHeadersMiddleware } from './middlewares/security-headers.middleware';
import { authMiddleware, AuthenticatedRequest } from './middlewares/auth.middleware';

const app = express();

// Disable technology fingerprint header
app.disable('x-powered-by');

// Enforce standard OWASP security headers on all responses
app.use(securityHeadersMiddleware);

// Standard development origins
const devOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

const trustedOrigins = Array.from(
  new Set([
    ...config.env.corsOrigins,
    ...(!config.env.isProduction ? devOrigins : []),
  ])
).filter((o) => o !== '*'); // Disallow wildcard with credentials: true

if (config.env.isProduction && trustedOrigins.length === 0) {
  throw new Error(
    '[FATAL: CORS Configuration] At least one explicit trusted frontend origin must be configured in production via APP_URL, FRONTEND_URL, or ALLOWED_ORIGINS.'
  );
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, or server-to-server health checks)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/+$/, '');

      // In non-production, permit localhost and configured dev origins
      if (!config.env.isProduction) {
        if (
          trustedOrigins.includes(normalizedOrigin) ||
          normalizedOrigin.startsWith('http://localhost:') ||
          normalizedOrigin.startsWith('http://127.0.0.1:')
        ) {
          return callback(null, true);
        }
      }

      // In production, strictly match against explicit trusted origins
      if (trustedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(new Error('Blocked by CORS policy: Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token', 'x-refresh-token'],
    optionsSuccessStatus: 200,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Top-level QR verification URL redirect handler for mobile phone camera scans
app.get('/verify/:token', (req, res) => {
  const token = req.params.token;
  const frontendUrl =
    process.env.FRONTEND_URL ||
    config.env.appUrl ||
    'https://ticketification.vercel.app';
  return res.redirect(302, `${frontendUrl.replace(/\/+$/, '')}/verify/${token}`);
});

// Legacy backward-compatible redirect: if any legacy URL is accessed, redirect to canonical Supabase Storage URL
app.get('/uploads/tickets/:filename', async (req, res) => {
  const filename = req.params.filename;
  try {
    const cleanToken = filename.replace(/\.(svg|png)$/, '').replace(/^ticket-/, '');
    const ticketRecord = await ticketService.getTicketById(cleanToken);

    if (ticketRecord?.ticket?.assetUrl && ticketRecord.ticket.assetUrl.includes('supabase.co')) {
      return res.redirect(301, ticketRecord.ticket.assetUrl);
    }
  } catch (_e) {}
  return res.status(404).send('Ticket asset not found. Please access ticket via the dashboard console.');
});

// REST API Base Router
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/verify', verificationRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/host', hostRoutes);
app.use('/api/admin/verifications', adminVerificationRouter);
app.use('/api/admin/events', adminLifecycleRouter);
app.use('/api/credentials', publicCredentialRouter);
app.use('/api/attendee', attendeeRoutes);
app.use('/api/public', publicEventRouter);

// Minimal public health check endpoint for load balancers & uptime monitors
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', system: 'Ticketification API', timestamp: new Date().toISOString() });
});

// Protected diagnostic endpoint (strictly accessible to authorized platform administrators)
app.get('/api/health/memory', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Administrative authorization required for internal system diagnostics.',
      },
    });
    return;
  }

  const mem = process.memoryUsage();
  const toMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
  logMemory('health_check_endpoint');

  res.json({
    status: 'OK',
    memory: {
      rss: `${toMB(mem.rss)}MB`,
      heapUsed: `${toMB(mem.heapUsed)}MB`,
      heapTotal: `${toMB(mem.heapTotal)}MB`,
      rssRaw: mem.rss,
      heapUsedRaw: mem.heapUsed,
    },
    sharp: {
      concurrency: sharp.concurrency(),
    },
    uptime: `${(process.uptime() / 60).toFixed(1)} minutes`,
    timestamp: new Date().toISOString(),
  });
});

// Centralized Error Handler Middleware
app.use(errorHandler);

export default app;
